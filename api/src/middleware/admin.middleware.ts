import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AdminRequest extends Request {
  admin?: { id: string; username: string }
}

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET!

export function adminMiddleware(req: AdminRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' })

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as {
      id: string
      username: string
      role: string
    }
    if (payload.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' })
    req.admin = { id: payload.id, username: payload.username }
    next()
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
}
