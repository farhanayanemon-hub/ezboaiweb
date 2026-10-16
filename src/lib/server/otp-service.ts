import { randomInt } from 'crypto'
import { db, otpCodes } from './db/index.js'
import { eq, and, lt, desc } from 'drizzle-orm'

const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 5

export interface OtpVerifyResult {
  success: boolean
  error?: string
  metadata?: any
}

export class OtpService {
  static generateCode(): string {
    return randomInt(100000, 999999).toString()
  }

  /**
   * Create an OTP with optional metadata (e.g. pending registration name and passwordHash)
   */
  static async createOtp(
    email: string,
    purpose: string = 'registration',
    metadata?: any
  ): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim()

    // Delete existing pending OTPs for the same email and purpose
    await db.delete(otpCodes).where(
      and(eq(otpCodes.email, normalizedEmail), eq(otpCodes.purpose, purpose))
    )

    const code = this.generateCode()
    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + OTP_EXPIRY_MINUTES)

    const serializedMetadata = metadata !== undefined && metadata !== null
      ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
      : null

    await db.insert(otpCodes).values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      code,
      purpose,
      metadata: serializedMetadata,
      expires,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      verified: false,
    })

    return code
  }

  /**
   * Get pending OTP for an email and purpose (if any exists)
   */
  static async getPendingOtp(
    email: string,
    purpose: string = 'registration'
  ): Promise<{ id: string; email: string; metadata?: any; expires: Date } | null> {
    const normalizedEmail = email.toLowerCase().trim()
    const [record] = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, normalizedEmail), eq(otpCodes.purpose, purpose)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)

    if (!record) return null

    let parsedMetadata: any = null
    if (record.metadata) {
      try {
        parsedMetadata = JSON.parse(record.metadata)
      } catch {
        parsedMetadata = record.metadata
      }
    }

    return {
      id: record.id,
      email: record.email,
      metadata: parsedMetadata,
      expires: record.expires,
    }
  }

  /**
   * Resend an OTP while preserving any existing metadata
   */
  static async resendOtp(
    email: string,
    purpose: string = 'registration'
  ): Promise<{ code: string; metadata?: any } | null> {
    const normalizedEmail = email.toLowerCase().trim()
    const pending = await this.getPendingOtp(normalizedEmail, purpose)
    if (!pending) return null

    const newCode = await this.createOtp(normalizedEmail, purpose, pending.metadata)
    return { code: newCode, metadata: pending.metadata }
  }

  /**
   * Verify an OTP and retrieve the stored metadata if verification succeeds
   */
  static async verifyOtp(
    email: string,
    code: string,
    purpose: string = 'registration'
  ): Promise<OtpVerifyResult> {
    const normalizedEmail = email.toLowerCase().trim()
    const cleanCode = code.trim()

    const [record] = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, normalizedEmail), eq(otpCodes.purpose, purpose)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)

    if (!record) {
      return { success: false, error: 'No verification code found. Please request a new one.' }
    }

    if (new Date() > record.expires) {
      await db.delete(otpCodes).where(eq(otpCodes.id, record.id))
      return { success: false, error: 'Verification code has expired. Please request a new one.' }
    }

    if (record.attempts >= record.maxAttempts) {
      await db.delete(otpCodes).where(eq(otpCodes.id, record.id))
      return { success: false, error: 'Too many attempts. Please request a new code.' }
    }

    if (record.code !== cleanCode) {
      await db
        .update(otpCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(otpCodes.id, record.id))
      const remaining = record.maxAttempts - record.attempts - 1
      return { success: false, error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }
    }

    let parsedMetadata: any = null
    if (record.metadata) {
      try {
        parsedMetadata = JSON.parse(record.metadata)
      } catch {
        parsedMetadata = record.metadata
      }
    }

    // OTP successfully verified - delete used OTP record
    await db.delete(otpCodes).where(eq(otpCodes.id, record.id))

    return {
      success: true,
      metadata: parsedMetadata,
    }
  }

  static async cleanupExpired(): Promise<void> {
    await db.delete(otpCodes).where(lt(otpCodes.expires, new Date()))
  }

  static getExpiryMinutes(): number {
    return OTP_EXPIRY_MINUTES
  }
}
