import { Response } from 'express'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { AdminRequest } from '../../middleware/admin.middleware'

async function auditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: object
) {
  await db.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, detail ? JSON.stringify(detail) : null]
  )
}

/**
 * GET /api/v1/admin/users?page=1&limit=50&search=&type=email|guest
 */
export const listUsers = async (req: AdminRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
  const offset = (page - 1) * limit
  const search = (req.query.search as string) || ''
  const type   = (req.query.type as string) || ''

  try {
    const conditions: string[] = []
    const params: unknown[] = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`)
    }
    if (type === 'email' || type === 'guest') {
      params.push(type)
      conditions.push(`u.identity_type = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT u.id, u.identity_type, u.display_name, u.email,
                u.is_verified, u.created_at, u.guest_expires_at,
                CASE WHEN us.user_id IS NOT NULL AND us.lifted_at IS NULL THEN TRUE ELSE FALSE END AS is_suspended,
                COUNT(DISTINCT rs.room_id) AS games_played
         FROM users u
         LEFT JOIN user_suspensions us ON us.user_id = u.id
         LEFT JOIN room_slots rs ON rs.player_id = u.id AND rs.slot_type = 'human'
         ${where}
         GROUP BY u.id, us.user_id, us.lifted_at
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM users u ${where}`, params),
    ])

    return res.status(200).json({
      data: rows.rows,
      pagination: {
        page, limit,
        total: parseInt(total.rows[0].count),
        pages: Math.ceil(parseInt(total.rows[0].count) / limit),
      },
    })
  } catch (err) {
    console.error('[admin:listUsers]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/admin/users/:id
 */
export const getUser = async (req: AdminRequest, res: Response) => {
  try {
    const [user, gameStats, recentGames, suspension] = await Promise.all([
      db.query(
        `SELECT id, identity_type, display_name, email, is_verified, created_at, guest_expires_at
         FROM users WHERE id = $1`,
        [req.params.id]
      ),
      db.query(
        `SELECT
           COUNT(gr.id) AS total_games,
           SUM(CASE WHEN gr.winning_team = CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN gr.winning_team != CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END THEN 1 ELSE 0 END) AS losses
         FROM game_rounds gr
         JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1`,
        [req.params.id]
      ),
      db.query(
        `SELECT gr.id, gr.round_number, gr.scenario, gr.trump_suit,
                gr.winning_team, gr.completed_at
         FROM game_rounds gr
         JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
         ORDER BY gr.completed_at DESC LIMIT 10`,
        [req.params.id]
      ),
      db.query(
        `SELECT reason, suspended_at, lifted_at FROM user_suspensions WHERE user_id = $1`,
        [req.params.id]
      ),
    ])

    if (user.rows.length === 0) return res.status(404).json({ error: 'USER_NOT_FOUND' })

    return res.status(200).json({
      user: user.rows[0],
      stats: gameStats.rows[0],
      recentGames: recentGames.rows,
      suspension: suspension.rows[0] || null,
    })
  } catch (err) {
    console.error('[admin:getUser]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

const suspendSchema = z.object({ reason: z.string().min(1).max(500) })

/**
 * POST /api/v1/admin/users/:id/suspend
 */
export const suspendUser = async (req: AdminRequest, res: Response) => {
  const parsed = suspendSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION_ERROR' })

  try {
    await db.query(
      `INSERT INTO user_suspensions (user_id, reason, suspended_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET reason = $2, suspended_by = $3, suspended_at = NOW(), lifted_at = NULL`,
      [req.params.id, parsed.data.reason, req.admin!.id]
    )
    await auditLog(req.admin!.id, 'suspend_user', 'user', req.params.id, { reason: parsed.data.reason })
    return res.status(200).json({ message: 'User suspended.' })
  } catch (err) {
    console.error('[admin:suspendUser]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/admin/users/:id/unsuspend
 */
export const unsuspendUser = async (req: AdminRequest, res: Response) => {
  try {
    await db.query(
      `UPDATE user_suspensions SET lifted_at = NOW() WHERE user_id = $1`,
      [req.params.id]
    )
    await auditLog(req.admin!.id, 'unsuspend_user', 'user', req.params.id)
    return res.status(200).json({ message: 'User unsuspended.' })
  } catch (err) {
    console.error('[admin:unsuspendUser]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * DELETE /api/v1/admin/users/:id/guest
 * Delete expired or specific guest accounts
 */
export const deleteGuestUser = async (req: AdminRequest, res: Response) => {
  try {
    const result = await db.query(
      `DELETE FROM users WHERE id = $1 AND identity_type = 'guest' RETURNING id`,
      [req.params.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'GUEST_NOT_FOUND' })
    }
    await auditLog(req.admin!.id, 'delete_guest_user', 'user', req.params.id)
    return res.status(200).json({ message: 'Guest user deleted.' })
  } catch (err) {
    console.error('[admin:deleteGuestUser]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
