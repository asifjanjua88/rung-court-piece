import { Router } from 'express'
import { adminMiddleware } from '../middleware/admin.middleware'
import { authLimiter } from '../middleware/rate-limit'
import * as adminAuth   from '../controllers/admin/admin-auth.controller'
import * as dashboard   from '../controllers/admin/admin-dashboard.controller'
import * as users       from '../controllers/admin/admin-users.controller'
import * as rooms       from '../controllers/admin/admin-rooms.controller'
import * as history     from '../controllers/admin/admin-history.controller'
import * as health      from '../controllers/admin/admin-health.controller'

export const adminRoutes = Router()

// ── Auth (no middleware) ──────────────────────────────────────────────────────
adminRoutes.post('/auth/login',           authLimiter, adminAuth.login)
adminRoutes.post('/auth/change-password', authLimiter, adminAuth.changePassword)

// ── All routes below require admin JWT ───────────────────────────────────────
adminRoutes.use(adminMiddleware)

// Dashboard
adminRoutes.get('/dashboard',             dashboard.getStats)

// Users
adminRoutes.get('/users',                 users.listUsers)
adminRoutes.get('/users/:id',             users.getUser)
adminRoutes.post('/users/:id/suspend',    users.suspendUser)
adminRoutes.post('/users/:id/unsuspend',  users.unsuspendUser)
adminRoutes.delete('/users/:id/guest',    users.deleteGuestUser)

// Rooms
adminRoutes.get('/rooms',                 rooms.listRooms)
adminRoutes.get('/rooms/:id',             rooms.getRoom)
adminRoutes.delete('/rooms/:id',          rooms.forceDeleteRoom)

// Game history
adminRoutes.get('/history',               history.getGameHistory)
adminRoutes.get('/history/leaderboard',   history.getLeaderboard)
adminRoutes.get('/history/shame-board',   history.getShameBoard)

// System health
adminRoutes.get('/health',                health.getHealth)

// Audit log
adminRoutes.get('/audit-log',             dashboard.getAuditLog)
