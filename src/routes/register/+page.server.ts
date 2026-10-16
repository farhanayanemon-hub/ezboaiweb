import { redirect, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { db, users } from "$lib/server/db/index.js"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { isOAuthProviderEnabled } from '$lib/server/auth-config'
import { verifyTurnstileToken, isTurnstileEnabled, getTurnstileErrorMessage } from '$lib/server/turnstile'
import { getTurnstileSiteKey, isOtpVerificationEnabled } from '$lib/server/settings-store'
import { sendOtpEmail } from '$lib/server/email.js'
import { OtpService } from '$lib/server/otp-service.js'
import { env } from '$env/dynamic/private'
import { authSanitizers, validatePasswordSafety } from '$lib/utils/sanitization.js'
import { validatePassword, BALANCED_PASSWORD_POLICY } from '$lib/utils/password-validation.js'
import { validateEmailForAuth } from '$lib/utils/email-validation.js'
import { getClientIP } from '$lib/server/rate-limiting.js'
import { SecurityLogger } from '$lib/server/security-monitoring.js'
import { handleAuthError, createAuthError, handleDatabaseError, AUTH_ERRORS, AUTH_STATUS_CODES, sanitizeErrorForLogging } from '$lib/utils/error-handling.js'

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth()

  // If user is already logged in, redirect to new chat page
  if (session?.user) {
    throw redirect(302, '/newchat')
  }

  // Load OAuth provider availability and Turnstile settings from database
  try {
    const [
      googleEnabled, 
      appleEnabled, 
      twitterEnabled, 
      facebookEnabled,
      turnstileEnabled,
      turnstileSiteKey
    ] = await Promise.all([
      isOAuthProviderEnabled('google'),
      isOAuthProviderEnabled('apple'),
      isOAuthProviderEnabled('twitter'),
      isOAuthProviderEnabled('facebook'),
      isTurnstileEnabled(),
      getTurnstileSiteKey()
    ]);
    
    const turnstileFinalSiteKey = turnstileEnabled ? (turnstileSiteKey || env.TURNSTILE_SITE_KEY || '') : '';
    
    return {
      oauthProviders: {
        google: googleEnabled,
        apple: appleEnabled,
        twitter: twitterEnabled,
        facebook: facebookEnabled
      },
      turnstile: {
        enabled: turnstileEnabled,
        siteKey: turnstileFinalSiteKey
      }
    }
  } catch (error) {
    console.error('Failed to load provider settings for register page:', error);
    
    // Fallback - assume providers are available if settings can't be loaded
    return {
      oauthProviders: {
        google: true,
        apple: true,
        twitter: true,
        facebook: true
      },
      turnstile: {
        enabled: false,
        siteKey: ''
      }
    }
  }
}

export const actions: Actions = {
  register: async ({ request, getClientAddress }) => {
    const data = await request.formData()
    const rawEmail = data.get('email') as string
    const rawPassword = data.get('password') as string
    const turnstileToken = data.get('cf-turnstile-response') as string

    // Get client IP for security logging
    const clientIP = getClientIP(request);

    // Sanitize and validate inputs for security
    const email = authSanitizers.email(rawEmail)
    const passwordSafetyCheck = validatePasswordSafety(rawPassword)

    // Basic validation
    if (!email || !passwordSafetyCheck.isValid) {
      SecurityLogger.registrationFailure(rawEmail || 'unknown', 'Invalid input data', clientIP);
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.MISSING_FIELDS);
    }

    // Comprehensive password validation
    const passwordValidation = validatePassword(rawPassword, BALANCED_PASSWORD_POLICY, { email })

    if (!passwordValidation.isValid) {
      SecurityLogger.registrationFailure(email, 'Password validation failed', clientIP);
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.INVALID_PASSWORD);
    }

    // Comprehensive RFC-compliant email validation
    const emailValidation = validateEmailForAuth(rawEmail)
    if (!emailValidation.isValid) {
      SecurityLogger.registrationFailure(rawEmail, 'Email validation failed', clientIP);
      return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.INVALID_EMAIL);
    }

    // Use the normalized email from validation
    const validatedEmail = emailValidation.normalizedEmail
    
    // Verify Turnstile token if enabled
    const turnstileEnabled = await isTurnstileEnabled()
    if (turnstileEnabled) {
      if (!turnstileToken) {
        return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, 'Please complete the security verification');
      }

      const verification = await verifyTurnstileToken(turnstileToken, clientIP)

      if (!verification.success) {
        const sanitizedError = sanitizeErrorForLogging(verification.error);
        console.warn('Turnstile verification failed during registration:', sanitizedError);
        return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, 'Security verification failed. Please try again.');
      }
    }
    
    try {
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, validatedEmail)).limit(1)

      if (existingUser.length > 0) {
        const existing = existingUser[0]
        if (existing.emailVerified) {
          SecurityLogger.registrationFailure(validatedEmail, 'Account already exists', clientIP);
          return createAuthError(AUTH_STATUS_CODES.BAD_REQUEST, AUTH_ERRORS.EMAIL_ALREADY_EXISTS);
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(rawPassword, 12)
      const rawName = data.get('name') as string
      const displayName = rawName?.trim() || validatedEmail.split('@')[0]

      // Store pending registration data in OTP metadata - deferred user creation
      const otpCode = await OtpService.createOtp(validatedEmail, 'registration', {
        name: displayName,
        passwordHash: hashedPassword,
      })

      try {
        await sendOtpEmail({
          email: validatedEmail,
          name: displayName,
          otpCode,
          expiryMinutes: OtpService.getExpiryMinutes(),
        })
        SecurityLogger.emailVerificationSent(validatedEmail, 'pending_otp');
        console.log(`[Registration] OTP verification email sent to ${validatedEmail}`)
      } catch (emailError) {
        console.error(`[Registration] Failed to send OTP email:`, emailError)
        SecurityLogger.emailVerificationFailure(validatedEmail, 'Failed to send OTP email');
      }

      throw redirect(302, `/verify-otp?email=${encodeURIComponent(validatedEmail)}`)
      
    } catch (error) {
      // Re-throw redirects (SvelteKit redirects have a status property)
      if (typeof error === 'object' && error !== null && 'status' in error && 'location' in error) {
        throw error
      }

      // Handle database and other errors securely
      SecurityLogger.registrationFailure(validatedEmail, 'System error during registration', clientIP);
      return handleDatabaseError(error, 'user registration');
    }
  }
}