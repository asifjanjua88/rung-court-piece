import { Router } from 'express'
import {
  guestLogin,
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  upgradeGuest,
} from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth.middleware'
import { authLimiter } from '../middleware/rate-limit'

export const authRoutes = Router()

authRoutes.post('/guest',            authLimiter, guestLogin)
authRoutes.post('/register',         authLimiter, register)
authRoutes.post('/verify-email',     authLimiter, verifyEmail)
authRoutes.post('/login',            authLimiter, login)
authRoutes.post('/forgot-password',  authLimiter, forgotPassword)
authRoutes.post('/reset-password',   authLimiter, resetPassword)
authRoutes.post('/refresh-token',    authLimiter, refreshToken)
authRoutes.post('/upgrade-guest',    authMiddleware, upgradeGuest)
