import { Response } from 'express'
import { db } from '../../db/postgres'
import { redis } from '../../db/redis'
import { AdminRequest } from '../../middleware/admin.middleware'

/**
 * GET /api/v1/admin/rooms?status=waiting|ready|in_progress|completed&page=1
 */
export const listRooms = async (req: AdminRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 50)
  const offset = (page - 1) * limit
  const status = req.query.status as string

  try {
    const params: unknown[] = []
    let where = ''
    if (status) {
      params.push(status)
      where = `WHERE r.status = $1`
    }

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT r.id, r.type, r.status, r.created_at,
                u.display_name AS creator_name,
                COUNT(rs.position) AS filled_slots,
                SUM(CASE WHEN rs.slot_type = 'human' THEN 1 ELSE 0 END) AS human_slots,
                SUM(CASE WHEN rs.slot_type = 'computer' THEN 1 ELSE 0 END) AS computer_slots
         FROM rooms r
         JOIN users u ON u.id = r.creator_id
         LEFT JOIN room_slots rs ON rs.room_id = r.id
         ${where}
         GROUP BY r.id, u.display_name
         ORDER BY r.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM rooms r ${where}`, params),
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
    console.error('[admin:listRooms]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/admin/rooms/:id
 */
export const getRoom = async (req: AdminRequest, res: Response) => {
  try {
    const [room, slots] = await Promise.all([
      db.query(
        `SELECT r.id, r.type, r.status, r.created_at,
                u.display_name AS creator_name, u.email AS creator_email
         FROM rooms r JOIN users u ON u.id = r.creator_id
         WHERE r.id = $1`,
        [req.params.id]
      ),
      db.query(
        `SELECT rs.position, rs.slot_type, rs.difficulty,
                u.display_name, u.email, u.identity_type
         FROM room_slots rs
         LEFT JOIN users u ON u.id = rs.player_id
         WHERE rs.room_id = $1
         ORDER BY rs.position`,
        [req.params.id]
      ),
    ])

    if (room.rows.length === 0) return res.status(404).json({ error: 'ROOM_NOT_FOUND' })

    return res.status(200).json({ room: room.rows[0], slots: slots.rows })
  } catch (err) {
    console.error('[admin:getRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * DELETE /api/v1/admin/rooms/:id
 * Force-delete any room regardless of status
 */
export const forceDeleteRoom = async (req: AdminRequest, res: Response) => {
  try {
    const result = await db.query(
      'SELECT access_code, type FROM rooms WHERE id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'ROOM_NOT_FOUND' })

    const room = result.rows[0]
    await db.query('DELETE FROM rooms WHERE id = $1', [req.params.id])

    if (room.type === 'private' && room.access_code) {
      await redis.del(`room_code:${room.access_code}`)
    }
    await redis.del('public_rooms')

    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id)
       VALUES ($1, 'force_delete_room', 'room', $2)`,
      [req.admin!.id, req.params.id]
    )

    return res.status(200).json({ message: 'Room deleted.' })
  } catch (err) {
    console.error('[admin:forceDeleteRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
