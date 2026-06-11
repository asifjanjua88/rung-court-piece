import { db } from '../db/postgres'

// ─── My Stats ─────────────────────────────────────────────────────────────────

export async function getMyStats(userId: string) {
  const [overview, recentGames, streaks, scenarioBreakdown] = await Promise.all([

    // Overall win/loss record
    db.query(
      `SELECT
         COUNT(gr.id)                                          AS total_games,
         SUM(CASE WHEN gr.winning_team =
               CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
             THEN 1 ELSE 0 END)                               AS wins,
         SUM(CASE WHEN gr.winning_team !=
               CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
             THEN 1 ELSE 0 END)                               AS losses,
         ROUND(
           100.0 * SUM(CASE WHEN gr.winning_team =
               CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
             THEN 1 ELSE 0 END)
           / NULLIF(COUNT(gr.id), 0), 1
         )                                                     AS win_rate_pct,
         COUNT(DISTINCT gr.room_id)                           AS rooms_played,
         MAX(gr.completed_at)                                 AS last_played_at
       FROM game_rounds gr
       JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
       WHERE rs.slot_type = 'human'`,
      [userId]
    ),

    // Last 10 games
    db.query(
      `SELECT
         gr.id, gr.round_number, gr.scenario, gr.trump_suit,
         gr.winning_team, gr.completed_at,
         CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END AS my_team,
         CASE WHEN gr.winning_team =
              CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
         THEN true ELSE false END AS won
       FROM game_rounds gr
       JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
       WHERE rs.slot_type = 'human'
       ORDER BY gr.completed_at DESC
       LIMIT 10`,
      [userId]
    ),

    // Current win/loss streak
    db.query(
      `WITH ordered AS (
         SELECT
           gr.completed_at,
           CASE WHEN gr.winning_team =
                CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
           THEN 'W' ELSE 'L' END AS result
         FROM game_rounds gr
         JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
         WHERE rs.slot_type = 'human'
         ORDER BY gr.completed_at DESC
         LIMIT 20
       ),
       streak AS (
         SELECT result, COUNT(*) AS cnt
         FROM (
           SELECT result,
             ROW_NUMBER() OVER () - ROW_NUMBER() OVER (PARTITION BY result ORDER BY (SELECT 1)) AS grp
           FROM ordered
         ) t
         WHERE grp = 0
         GROUP BY result, grp
         LIMIT 1
       )
       SELECT * FROM streak`,
      [userId]
    ),

    // Scenario A vs B performance
    db.query(
      `SELECT
         gr.scenario,
         COUNT(*)                                              AS total,
         SUM(CASE WHEN gr.winning_team =
               CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
             THEN 1 ELSE 0 END)                               AS wins
       FROM game_rounds gr
       JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
       WHERE rs.slot_type = 'human'
       GROUP BY gr.scenario`,
      [userId]
    ),
  ])

  const scenarioMap: Record<string, { total: number; wins: number }> = {}
  for (const row of scenarioBreakdown.rows) {
    scenarioMap[row.scenario] = { total: parseInt(row.total), wins: parseInt(row.wins) }
  }

  return {
    overview:  overview.rows[0],
    recentGames: recentGames.rows,
    currentStreak: streaks.rows[0] || null,
    scenarios: scenarioMap,
  }
}

// ─── Public Leaderboard ───────────────────────────────────────────────────────

export async function getLeaderboard(limit = 20, offset = 0) {
  const result = await db.query(
    `SELECT
       u.id,
       u.display_name,
       COUNT(gr.id)                                           AS total_games,
       SUM(CASE WHEN gr.winning_team =
             CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
           THEN 1 ELSE 0 END)                                AS wins,
       SUM(CASE WHEN gr.winning_team !=
             CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
           THEN 1 ELSE 0 END)                                AS losses,
       ROUND(
         100.0 * SUM(CASE WHEN gr.winning_team =
               CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
             THEN 1 ELSE 0 END)
         / NULLIF(COUNT(gr.id), 0), 1
       )                                                      AS win_rate_pct,
       MAX(gr.completed_at)                                   AS last_played_at
     FROM users u
     JOIN room_slots rs ON rs.player_id = u.id AND rs.slot_type = 'human'
     JOIN game_rounds gr ON gr.room_id = rs.room_id
     WHERE u.identity_type = 'email'
     GROUP BY u.id
     HAVING COUNT(gr.id) >= 1
     ORDER BY wins DESC, win_rate_pct DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  const countResult = await db.query(
    `SELECT COUNT(DISTINCT u.id)
     FROM users u
     JOIN room_slots rs ON rs.player_id = u.id AND rs.slot_type = 'human'
     JOIN game_rounds gr ON gr.room_id = rs.room_id
     WHERE u.identity_type = 'email'`
  )

  return {
    data:  result.rows,
    total: parseInt(countResult.rows[0].count),
  }
}

// ─── Match History (paginated) ────────────────────────────────────────────────

export async function getMatchHistory(userId: string, limit = 20, offset = 0) {
  const [rows, total] = await Promise.all([
    db.query(
      `SELECT
         gr.id, gr.round_number, gr.scenario, gr.trump_suit,
         gr.winning_team, gr.kothi_counter, gr.completed_at,
         r.type AS room_type,
         CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END AS my_team,
         CASE WHEN gr.winning_team =
              CASE WHEN rs.position IN (0,2) THEN 'A' ELSE 'B' END
         THEN true ELSE false END AS won
       FROM game_rounds gr
       JOIN rooms r ON r.id = gr.room_id
       JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
       WHERE rs.slot_type = 'human'
       ORDER BY gr.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    db.query(
      `SELECT COUNT(gr.id)
       FROM game_rounds gr
       JOIN room_slots rs ON rs.room_id = gr.room_id AND rs.player_id = $1
       WHERE rs.slot_type = 'human'`,
      [userId]
    ),
  ])

  return {
    data:  rows.rows,
    total: parseInt(total.rows[0].count),
  }
}
