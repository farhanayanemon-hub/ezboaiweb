import { redirect, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { db, users } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { OtpService } from '$lib/server/otp-service.js'
import { sendOtpEmail } from '$lib/server/email.js'
import { authSanitizers } from '$lib/utils/sanitization.js'
import { SecurityLogger } from '$lib/server/security-monitoring.js'
import { encode } from '@auth/core/jwt'
import { env } from '$env/dynamic/private'
import { getPublicOrigin } from '$lib/server/settings-store.js'

export const load: PageServerLoad = async ({ url, locals }) => {
  const session = await locals.auth()
  if (session?.user) {
    throw redirect(302, '/newchat')
  }

  const email = url.searchParams.get('email')
  if (!email) {
    throw redirect(302, '/register')
  }

  return {
    email: authSanitizers.email(email) || email,
    expiryMinutes: OtpService.getExpiryMinutes(),
  }
}

export const actions: Actions = {
  verify: async ({ request, cookies, url }) => {
    const data = await request.formData()
    const email = data.get('email')?.toString()
    const code = data.get('code')?.toString()

    if (!email || !code) {
      return fail(400, { error: 'Email and verification code are required', email })
    }

    const sanitizedEmail = authSanitizers.email(email)
    if (!sanitizedEmail) {
      return fail(400, { error: 'Invalid email address', email })
    }

    const result = await OtpService.verifyOtp(sanitizedEmail, code, 'registration')

    if (!result.success) {
      return fail(400, { error: result.error, email: sanitizedEmail })
    }

    // OTP verified! Retrieve pending registration metadata
    const metadata = result.metadata || {}
    const displayName = metadata.name || sanitizedEmail.split('@')[0]
    const passwordHash = metadata.passwordHash || null

    let userRecord: { id: string; email: string; name: string | null; isAdmin: boolean }

    try {
      const existing = await db
        .select({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.email, sanitizedEmail))
        .limit(1)

      if (existing.length === 0) {
        // Create new user in users table now that email is verified
        const [newUser] = await db
          .insert(users)
          .values({
            email: sanitizedEmail,
            password: passwordHash,
            name: displayName,
            planTier: 'free',
            emailVerified: new Date(),
          })
          .returning({ id: users.id, email: users.email, name: users.name, isAdmin: users.isAdmin })

        userRecord = newUser
        SecurityLogger.registrationSuccess(userRecord.id, userRecord.email!, 'otp_verified');
      } else {
        userRecord = existing[0]
        await db
          .update(users)
          .set({
            emailVerified: new Date(),
            password: passwordHash || undefined,
          })
          .where(eq(users.id, userRecord.id))
      }

      SecurityLogger.emailVerificationSuccess(sanitizedEmail);
      console.log(`[OTP Verify] Account successfully created & verified for: ${sanitizedEmail}`)
    } catch (err) {
      console.error('[OTP Verify] Failed to create or update user:', err)
      return fail(500, { error: 'Failed to create user account. Please try again.', email: sanitizedEmail })
    }

    // Auto-login: Issue Auth.js session cookie
    try {
      const isProduction = env.NODE_ENV === 'production'
      const publicOrigin = await getPublicOrigin()
      const isHttps = publicOrigin?.startsWith('https://') || url.protocol === 'https:' || isProduction
      const cookieName = isHttps ? '__Secure-authjs.session-token' : 'authjs.session-token'
      const secret = env.AUTH_SECRET || env.NEXTAUTH_SECRET || 'ezboai-auth-secret'

      const sessionToken = await encode({
        token: {
          sub: userRecord.id,
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name,
          isAdmin: userRecord.isAdmin,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        },
        secret,
        salt: cookieName,
      })

      cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isHttps,
        maxAge: 30 * 24 * 60 * 60,
      })

      console.log(`[OTP Verify] Auto-login session cookie established for: ${userRecord.email}`)
    } catch (sessionErr) {
      console.error('[OTP Verify] Auto-login failed, redirecting to login:', sessionErr)
      throw redirect(302, '/login?message=Account verified! Please sign in.')
    }

    throw redirect(302, '/newchat?welcome=true')
  },

  resend: async ({ request }) => {
    const data = await request.formData()
    const email = data.get('email')?.toString()

    if (!email) {
      return fail(400, { error: 'Email is required', email })
    }

    const sanitizedEmail = authSanitizers.email(email)
    if (!sanitizedEmail) {
      return fail(400, { error: 'Invalid email address', email })
    }

    // Check for pending OTP registration in otp_code table first
    const pendingOtp = await OtpService.getPendingOtp(sanitizedEmail, 'registration')
    let recipientName = sanitizedEmail.split('@')[0]

    if (pendingOtp?.metadata?.name) {
      recipientName = pendingOtp.metadata.name
    } else {
      const [existingUser] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.email, sanitizedEmail))
        .limit(1)

      if (existingUser?.name) {
        recipientName = existingUser.name
      } else if (!pendingOtp) {
        return fail(400, { error: 'No pending registration found. Please register again.', email: sanitizedEmail })
      }
    }

    try {
      const resendResult = await OtpService.resendOtp(sanitizedEmail, 'registration')
      const otpCode = resendResult?.code || (await OtpService.createOtp(sanitizedEmail, 'registration', pendingOtp?.metadata))

      await sendOtpEmail({
        email: sanitizedEmail,
        name: recipientName,
        otpCode,
        expiryMinutes: OtpService.getExpiryMinutes(),
      })

      console.log(`[OTP Resend] New OTP sent to ${sanitizedEmail}`)
      return { resent: true, email: sanitizedEmail }
    } catch (err) {
      console.error('[OTP Resend] Failed to send OTP:', err)
      return fail(500, { error: 'Failed to send verification code. Please try again.', email: sanitizedEmail })
    }
  },
}
