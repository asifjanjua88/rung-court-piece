import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { AdminRequest } from '../../middleware/admin.middleware'

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET!

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
})

/**
 * POST /api/v1/admin/auth/login
 * Body: { username, password }
 */
export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' })
  }

  const { username, password } = parsed.data
  const result = await db.query(
    'SELECT id, username, password_hash, must_change_password, is_active FROM admin_users WHERE username = $1',
    [username]
  )

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
  }

  const admin = result.rows[0]
  if (!admin.is_active) {
    return res.status(403).json({ error: 'ACCOUNT_DISABLED' })
  }

  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
  }

  // Update last login time
  await db.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id])

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: 'admin' },
    ADMIN_JWT_SECRET,
    { expiresIn: '8h' }
  )

  return res.status(200).json({
    token,
    mustChangePassword: admin.must_change_password,
    username: admin.username,
  })
}

/**
 * POST /api/v1/admin/auth/change-password
 * Requires: admin JWT
 * Body: { currentPassword, newPassword }
 */
export const changePassword = async (req: AdminRequest, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1]
  let adminId: string
  try {
    const payload = jwt.verify(token!, ADMIN_JWT_SECRET) as { id: string; role: string }
    if (payload.role !== 'admin') throw new Error()
    adminId = payload.id
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: parsed.error.errors.map(e => e.message),
    })
  }

  const { currentPassword, newPassword } = parsed.data
  const result = await db.query('SELECT password_hash FROM admin_users WHERE id = $1', [adminId])
  if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' })

  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash)
  if (!valid) return res.status(401).json({ error: 'INVALID_CURRENT_PASSWORD' })

  const newHash = await bcrypt.hash(newPassword, 12)
  await db.query(
    'UPDATE admin_users SET password_hash = $1, must_change_password = FALSE WHERE id = $2',
    [newHash, adminId]
  )

  return res.status(200).json({ message: 'Password changed successfully.' })
}
