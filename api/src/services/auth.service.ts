import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/postgres'
import { redis } from '../db/redis'
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_GUEST_EXPIRES_IN = process.env.JWT_GUEST_EXPIRES_IN || '1d'
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!
const TOKEN_TTL = 60 * 15 // 15 minutes in seconds

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccess(id: string, identityType: string, guest = false): string {
  return jwt.sign(
    { id, identityType },
    JWT_SECRET,
    { expiresIn: guest ? JWT_GUEST_EXPIRES_IN : JWT_EXPIRES_IN }
  )
}

function signRefresh(id: string): string {
  return jwt.sign({ id }, REFRESH_SECRET, { expiresIn: '30d' })
}

// ─── Guest ────────────────────────────────────────────────────────────────────

export async function createGuest(name: string): Promise<{ accessToken: string; user: object; isReturning: boolean }> {
  // Normalise: trim, collapse spaces, max 20 chars
  const displayName = name.trim().replace(/\s+/g, ' ').slice(0, 20)
  if (!displayName) throw new Error('NAME_REQUIRED')

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7-day window

  // ── Find existing guest with this name (case-insensitive) ───────────────────
  // This lets a player re-open the browser and get the SAME UUID back,
  // so the game engine recognises them as the same person.
  const existing = await db.query(
    `SELECT id, display_name FROM users
     WHERE lower(display_name) = lower($1)
       AND identity_type = 'guest'
       AND guest_expires_at > NOW()
     LIMIT 1`,
    [displayName]
  )

  if (existing.rows.length > 0) {
    // Returning guest — extend expiry and re-issue token
    const { id, display_name } = existing.rows[0]
    await db.query(
      `UPDATE users SET guest_expires_at = $1 WHERE id = $2`,
      [expiresAt, id]
    )
    const accessToken = signAccess(id, 'guest', true)
    return { accessToken, user: { id, displayName: display_name, identityType: 'guest' }, isReturning: true }
  }

  // ── New guest — check name is not taken by any active user ──────────────────
  const taken = await db.query(
    `SELECT id FROM users WHERE lower(display_name) = lower($1) LIMIT 1`,
    [displayName]
  )
  if (taken.rows.length > 0) throw new Error('NAME_TAKEN')

  // Create new guest account
  const id = uuidv4()
  await db.query(
    `INSERT INTO users (id, identity_type, display_name, is_verified, guest_expires_at)
     VALUES ($1, 'guest', $2, true, $3)`,
    [id, displayName, expiresAt]
  )

  const accessToken = signAccess(id, 'guest', true)
  return { accessToken, user: { id, displayName, identityType: 'guest' }, isReturning: false }
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<void> {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) throw new Error('EMAIL_TAKEN')

  const passwordHash = await bcrypt.hash(password, 12)
  const id = uuidv4()

  await db.query(
    `INSERT INTO users (id, identity_type, display_name, email, password_hash, is_verified)
     VALUES ($1, 'email', $2, $3, $4, false)`,
    [id, displayName, email.toLowerCase(), passwordHash]
  )

  const token = uuidv4()
  await redis.setex(`email_verify:${token}`, TOKEN_TTL, id)
  await sendVerificationEmail(email, token)
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  const userId = await redis.get(`email_verify:${token}`)
  if (!userId) throw new Error('TOKEN_INVALID_OR_EXPIRED')

  await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId])
  await redis.del(`email_verify:${token}`)
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string; user: object }> {
  const result = await db.query(
    'SELECT id, display_name, password_hash, is_verified FROM users WHERE email = $1 AND identity_type = $2',
    [email.toLowerCase(), 'email']
  )
  if (result.rows.length === 0) throw new Error('INVALID_CREDENTIALS')

  const user = result.rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) throw new Error('INVALID_CREDENTIALS')

  if (!user.is_verified) throw new Error('EMAIL_NOT_VERIFIED')

  const accessToken = signAccess(user.id, 'email')
  const refreshToken = signRefresh(user.id)

  // Store refresh token in Redis (30 days)
  await redis.setex(`refresh:${user.id}`, 60 * 60 * 24 * 30, refreshToken)

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, displayName: user.display_name, identityType: 'email' },
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  token: string
): Promise<{ accessToken: string }> {
  let payload: { id: string }
  try {
    payload = jwt.verify(token, REFRESH_SECRET) as { id: string }
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN')
  }

  const stored = await redis.get(`refresh:${payload.id}`)
  if (!stored || stored !== token) throw new Error('INVALID_REFRESH_TOKEN')

  const accessToken = signAccess(payload.id, 'email')
  return { accessToken }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  const result = await db.query(
    'SELECT id FROM users WHERE email = $1 AND identity_type = $2',
    [email.toLowerCase(), 'email']
  )
  // Always respond the same — prevent email enumeration
  if (result.rows.length === 0) return

  const userId = result.rows[0].id

  // Invalidate any existing reset token for this user
  const existingKey = await redis.get(`reset_user:${userId}`)
  if (existingKey) await redis.del(`reset:${existingKey}`)

  const token = uuidv4()
  await redis.setex(`reset:${token}`, TOKEN_TTL, userId)
  await redis.setex(`reset_user:${userId}`, TOKEN_TTL, token)

  await sendPasswordResetEmail(email, token)
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await redis.get(`reset:${token}`)
  if (!userId) throw new Error('TOKEN_INVALID_OR_EXPIRED')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])

  // Invalidate used tokens
  await redis.del(`reset:${token}`)
  await redis.del(`reset_user:${userId}`)

  // Invalidate any active refresh tokens (force re-login)
  await redis.del(`refresh:${userId}`)
}

// ─── Upgrade Guest ────────────────────────────────────────────────────────────

export async function upgradeGuest(
  guestId: string,
  email: string,
  password: string,
  displayName: string
): Promise<void> {
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
  )
  if (existing.rows.length > 0) throw new Error('EMAIL_TAKEN')

  const passwordHash = await bcrypt.hash(password, 12)

  await db.query(
    `UPDATE users
     SET identity_type = 'email', email = $1, password_hash = $2,
         display_name = $3, is_verified = false, guest_expires_at = NULL
     WHERE id = $4 AND identity_type = 'guest'`,
    [email.toLowerCase(), passwordHash, displayName, guestId]
  )

  const token = uuidv4()
  await redis.setex(`email_verify:${token}`, TOKEN_TTL, guestId)
  await sendVerificationEmail(email, token)
}
