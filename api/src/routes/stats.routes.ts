import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { myStats, leaderboard, history } from '../controllers/stats.controller'

export const statsRoutes = Router()

// Leaderboard is public (but still needs a valid token for rate-limit identity)
statsRoutes.get('/leaderboard', leaderboard)

// Authenticated routes
statsRoutes.use(authMiddleware)
statsRoutes.get('/my-stats', myStats)
statsRoutes.get('/history',  history)
