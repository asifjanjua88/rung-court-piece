import { Response } from 'express'
import { db } from '../../db/postgres'
import { AdminRequest } from '../../middleware/admin.middleware'

/**
 * GET /api/v1/admin/dashboard
 * Returns platform-wide statistics
 */
export const getStats = async (_req: AdminRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalEmail,
      totalGuest,
      newSignupsToday,
      newSignupsWeek,
      activeToday,
      gamesPlayedToday,
      gamesPlayedWeek,
      gamesPlayedAllTime,
      activeRooms,
      scenarioBreakdown,
      avgTricksPerGame,
    ] = await Promise.all([

      // Total registered users (email only)
      db.query(`SELECT COUNT(*) FROM users WHERE identity_type = 'email'`),

      // Email accounts
      db.query(`SELECT COUNT(*) FROM users WHERE identity_type = 'email'`),

      // Guest accounts still alive
      db.query(`SELECT COUNT(*) FROM users WHERE identity_type = 'guest' AND guest_expires_at > NOW()`),

      // New email signups today
      db.query(`SELECT COUNT(*) FROM users
                WHERE identity_type = 'email'
                AND created_at >= CURRENT_DATE`),

      // New email signups this week
      db.query(`SELECT COUNT(*) FROM users
                WHERE identity_type = 'email'
                AND created_at >= date_trunc('week', NOW())`),

      // Distinct players who played a game today
      db.query(`SELECT COUNT(DISTINCT rs.player_id)
                FROM game_rounds gr
                JOIN room_slots rs ON rs.room_id = gr.room_id
                WHERE gr.completed_at >= CURRENT_DATE
                AND rs.slot_type = 'human'`),

      // Games completed today
      db.query(`SELECT COUNT(*) FROM game_rounds WHERE completed_at >= CURRENT_DATE`),

      // Games completed this week
      db.query(`SELECT COUNT(*) FROM game_rounds WHERE completed_at >= date_trunc('week', NOW())`),

      // Games all time
      db.query(`SELECT COUNT(*) FROM game_rounds`),

      // Active rooms right now
      db.query(`SELECT status, COUNT(*) as count
                FROM rooms
                WHERE status IN ('waiting','ready','in_progress')
                GROUP BY status`),

      // Scenario A vs B breakdown
      db.query(`SELECT scenario, COUNT(*) as count FROM game_rounds GROUP BY scenario`),

      // Average tricks per game (approximation — rounds)
      db.query(`SELECT ROUND(AVG(round_number), 1) as avg_rounds FROM game_rounds`),
    ])

    const activeRoomsMap: Record<string, number> = {}
    for (const row of activeRooms.rows) {
      activeRoomsMap[row.status] = parseInt(row.count)
    }

    const scenarioMap: Record<string, number> = {}
    for (const row of scenarioBreakdown.rows) {
      scenarioMap[`scenario_${row.scenario}`] = parseInt(row.count)
    }

    return res.status(200).json({
      users: {
        total: parseInt(totalUsers.rows[0].count),
        email: parseInt(totalEmail.rows[0].count),
        guestActive: parseInt(totalGuest.rows[0].count),
        newToday: parseInt(newSignupsToday.rows[0].count),
        newThisWeek: parseInt(newSignupsWeek.rows[0].count),
      },
      activity: {
        activePlayersToday: parseInt(activeToday.rows[0].count),
        gamesPlayedToday: parseInt(gamesPlayedToday.rows[0].count),
        gamesPlayedThisWeek: parseInt(gamesPlayedWeek.rows[0].count),
        gamesPlayedAllTime: parseInt(gamesPlayedAllTime.rows[0].count),
        averageRoundsPerGame: parseFloat(avgTricksPerGame.rows[0]?.avg_rounds || '0'),
      },
      rooms: {
        waiting: activeRoomsMap['waiting'] || 0,
        ready: activeRoomsMap['ready'] || 0,
        inProgress: activeRoomsMap['in_progress'] || 0,
      },
      gameBreakdown: scenarioMap,
    })
  } catch (err) {
    console.error('[admin:getStats]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/admin/audit-log?page=1&limit=50
 */
export const getAuditLog = async (req: AdminRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
  const offset = (page - 1) * limit

  try {
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT al.id, au.username, al.action, al.target_type,
                al.target_id, al.detail, al.created_at
         FROM admin_audit_log al
         JOIN admin_users au ON au.id = al.admin_id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query('SELECT COUNT(*) FROM admin_audit_log'),
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
    console.error('[admin:getAuditLog]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
