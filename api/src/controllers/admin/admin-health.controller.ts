import { Response } from 'express'
import { db } from '../../db/postgres'
import { redis } from '../../db/redis'
import { AdminRequest } from '../../middleware/admin.middleware'

const startTime = Date.now()

/**
 * GET /api/v1/admin/health
 * System health: DB, Redis, uptime, WebSocket connections
 */
export const getHealth = async (_req: AdminRequest, res: Response) => {
  const checks = await Promise.allSettled([
    // PostgreSQL ping
    db.query('SELECT 1'),
    // Redis ping
    redis.ping(),
  ])

  const postgresOk = checks[0].status === 'fulfilled'
  const redisOk    = checks[1].status === 'fulfilled'

  const uptimeMs   = Date.now() - startTime
  const uptimeHrs  = (uptimeMs / 1000 / 60 / 60).toFixed(2)

  // Active WebSocket room count from Redis pub/sub not tracked here —
  // game engine reports it separately; we report API process uptime only
  const memUsage = process.memoryUsage()

  return res.status(postgresOk && redisOk ? 200 : 503).json({
    status: postgresOk && redisOk ? 'healthy' : 'degraded',
    services: {
      postgresql: postgresOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
    api: {
      uptimeHours: parseFloat(uptimeHrs),
      nodeVersion: process.version,
      memoryMB: {
        rss:      (memUsage.rss / 1024 / 1024).toFixed(1),
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
        heapTotal:(memUsage.heapTotal / 1024 / 1024).toFixed(1),
      },
    },
    checkedAt: new Date().toISOString(),
  })
}
