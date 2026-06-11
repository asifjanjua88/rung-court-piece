import { Response } from 'express'
import { db } from '../../db/postgres'
import { AdminRequest } from '../../middleware/admin.middleware'

/**
 * GET /api/v1/admin/history?page=1&scenario=A|B
 */
export const getGameHistory = async (req: AdminRequest, res: Response) => {
  const page     = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit    = Math.min(100, parseInt(req.query.limit as string) || 50)
  const offset   = (page - 1) * limit
  const scenario = req.query.scenario as string

  try {
    const params: unknown[] = []
    let where = ''
    if (scenario === 'A' || scenario === 'B') {
      params.push(scenario)
      where = `WHERE gr.scenario = $1`
    }

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT gr.id, gr.round_number, gr.scenario, gr.trump_suit,
                gr.winning_team, gr.kothi_counter, gr.completed_at,
                r.type AS room_type
         FROM game_rounds gr
         JOIN rooms r ON r.id = gr.room_id
         ${where}
         ORDER BY gr.completed_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM game_rounds gr ${where}`, params),
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
    console.error('[admin:getGameHistory]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/admin/history/leaderboard?limit=20
 * Top players by wins
 */
export const getLeaderboard = async (req: AdminRequest, res: Response) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)

  try {
    const result = await db.query(
      `SELECT u.id, u.display_name, u.email,
              COUNT(gr.id) AS total_games,
              SUM(CASE WHEN gr.winning_team =
                CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
              THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN gr.winning_team !=
                CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
              THEN 1 ELSE 0 END) AS losses,
              ROUND(
                100.0 * SUM(CASE WHEN gr.winning_team =
                  CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
                THEN 1 ELSE 0 END)
                / NULLIF(COUNT(gr.id), 0), 1
              ) AS win_rate_pct
       FROM users u
       JOIN room_slots rs ON rs.player_id = u.id AND rs.slot_type = 'human'
       JOIN game_rounds gr ON gr.room_id = rs.room_id
       WHERE u.identity_type = 'email'
       GROUP BY u.id
       HAVING COUNT(gr.id) > 0
       ORDER BY wins DESC, win_rate_pct DESC
       LIMIT $1`,
      [limit]
    )

    return res.status(200).json({ data: result.rows })
  } catch (err) {
    console.error('[admin:getLeaderboard]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/admin/history/shame-board?limit=20
 * Players with most Kothi (donkey) rounds received
 */
export const getShameBoard = async (req: AdminRequest, res: Response) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)

  try {
    // Kothi counter: team A gets Kothi when counter reaches -4,
    // team B gets Kothi when counter reaches +4
    // We track per-room Kothi counts
    const result = await db.query(
      `SELECT u.id, u.display_name,
              COUNT(DISTINCT gr.room_id) AS rooms_played,
              SUM(CASE WHEN (rs.position IN (0,2) AND gr.winning_team = 'B')
                         OR (rs.position IN (1,3) AND gr.winning_team = 'A')
                  THEN 1 ELSE 0 END) AS losses,
              kc.team_a_kothi,
              kc.team_b_kothi
       FROM users u
       JOIN room_slots rs ON rs.player_id = u.id AND rs.slot_type = 'human'
       JOIN game_rounds gr ON gr.room_id = rs.room_id
       JOIN kothi_counters kc ON kc.room_id = gr.room_id
       WHERE u.identity_type = 'email'
       GROUP BY u.id, kc.team_a_kothi, kc.team_b_kothi
       ORDER BY losses DESC
       LIMIT $1`,
      [limit]
    )

    return res.status(200).json({ data: result.rows })
  } catch (err) {
    console.error('[admin:getShameBoard]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
