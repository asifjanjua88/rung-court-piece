import { Request, Response } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service'
import { AuthRequest } from '../middleware/auth.middleware'

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2).max(30),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const verifyEmailSchema = z.object({
  token: z.string().uuid(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

const upgradeGuestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(30),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: 'VALIDATION_ERROR',
    details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
  })
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/guest
 * No body required — generates a temporary guest account instantly
 */
export const guestLogin = async (_req: Request, res: Response) => {
  try {
    const result = await authService.createGuest()
    return res.status(201).json(result)
  } catch (err) {
    console.error('[guestLogin]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/register
 * Body: { email, password, displayName }
 * Creates unverified account and sends verification email
 */
export const register = async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const { email, password, displayName } = parsed.data
    await authService.registerUser(email, password, displayName)
    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'This email is already registered.' })
    }
    console.error('[register]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/verify-email
 * Body: { token }
 * Verifies the email address using the token sent by email
 */
export const verifyEmail = async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    await authService.verifyEmail(parsed.data.token)
    return res.status(200).json({ message: 'Email verified successfully. You can now log in.' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'TOKEN_INVALID_OR_EXPIRED') {
      return res.status(400).json({ error: 'TOKEN_INVALID_OR_EXPIRED', message: 'Verification link is invalid or has expired.' })
    }
    console.error('[verifyEmail]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Returns access token + refresh token
 */
export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const { email, password } = parsed.data
    const result = await authService.loginUser(email, password)
    return res.status(200).json(result)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' })
      }
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        return res.status(403).json({
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in.',
        })
      }
    }
    console.error('[login]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 * Sends reset link — always returns 200 to prevent email enumeration
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    await authService.forgotPassword(parsed.data.email)
    // Always same response — no hint whether email exists
    return res.status(200).json({
      message: 'If this email is registered, a password reset link has been sent.',
    })
  } catch (err) {
    console.error('[forgotPassword]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/reset-password
 * Body: { token, password }
 * Resets password using token from email link
 */
export const resetPassword = async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.password)
    return res.status(200).json({ message: 'Password reset successfully. Please log in.' })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'TOKEN_INVALID_OR_EXPIRED') {
      return res.status(400).json({ error: 'TOKEN_INVALID_OR_EXPIRED', message: 'Reset link is invalid or has expired.' })
    }
    console.error('[resetPassword]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/refresh-token
 * Body: { refreshToken }
 * Returns new access token using valid refresh token
 */
export const refreshToken = async (req: Request, res: Response) => {
  const parsed = refreshTokenSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const result = await authService.refreshAccessToken(parsed.data.refreshToken)
    return res.status(200).json(result)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN', message: 'Session expired. Please log in again.' })
    }
    console.error('[refreshToken]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/auth/upgrade-guest
 * Requires: JWT (guest)
 * Body: { email, password, displayName }
 * Promotes guest account to full account, preserving game history
 */
export const upgradeGuest = async (req: AuthRequest, res: Response) => {
  if (req.user?.identityType !== 'guest') {
    return res.status(400).json({ error: 'NOT_A_GUEST', message: 'Only guest accounts can be upgraded.' })
  }

  const parsed = upgradeGuestSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const { email, password, displayName } = parsed.data
    await authService.upgradeGuest(req.user.id, email, password, displayName)
    return res.status(200).json({
      message: 'Account upgraded. Please verify your email to continue.',
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'This email is already registered.' })
    }
    console.error('[upgradeGuest]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
