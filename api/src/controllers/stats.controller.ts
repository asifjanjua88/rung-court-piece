import { Request, Response } from 'express'
import * as statsService from '../services/stats.service'

// GET /api/v1/stats/my-stats
export async function myStats(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    const data = await statsService.getMyStats(userId)
    res.json({ data })
  } catch (err) {
    console.error('[stats] myStats error', err)
    res.status(500).json({ error: 'internal_error' })
  }
}

// GET /api/v1/stats/leaderboard?limit=20&page=1
export async function leaderboard(req: Request, res: Response) {
  try {
    const limit  = Math.min(parseInt(String(req.query.limit  || '20'), 10), 100)
    const page   = Math.max(parseInt(String(req.query.page   || '1'),  10), 1)
    const offset = (page - 1) * limit

    const { data, total } = await statsService.getLeaderboard(limit, offset)
    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[stats] leaderboard error', err)
    res.status(500).json({ error: 'internal_error' })
  }
}

// GET /api/v1/stats/history?limit=20&page=1
export async function history(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id
    const limit  = Math.min(parseInt(String(req.query.limit  || '20'), 10), 100)
    const page   = Math.max(parseInt(String(req.query.page   || '1'),  10), 1)
    const offset = (page - 1) * limit

    const { data, total } = await statsService.getMatchHistory(userId, limit, offset)
    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[stats] history error', err)
    res.status(500).json({ error: 'internal_error' })
  }
}
