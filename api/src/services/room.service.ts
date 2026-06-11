import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/postgres'
import { redis } from '../db/redis'
import { scheduleAutoFill, cancelAutoFill } from './room-watcher.service'

export type RoomType = 'public' | 'private'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface CreateRoomInput {
  type: RoomType
  creatorId: string
  computerSlots?: { position: 0 | 1 | 2 | 3; difficulty: Difficulty }[]
}

// Human-like bot names assigned by position (1, 2, 3)
const BOT_NAMES: Record<number, string> = {
  1: 'Faisal',
  2: 'John',
  3: 'Qasim',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function getRoomWithSlots(roomId: string) {
  const roomResult = await db.query(
    `SELECT r.id, r.type, r.status, r.access_code, r.creator_id,
            json_agg(
              json_build_object(
                'position', rs.position,
                'slotType',  rs.slot_type,
                'playerId',  rs.player_id,
                'difficulty',rs.difficulty,
                'displayName', COALESCE(u.display_name, rs.bot_name)
              ) ORDER BY rs.position
            ) AS slots
     FROM rooms r
     LEFT JOIN room_slots rs ON rs.room_id = r.id
     LEFT JOIN users u ON u.id = rs.player_id
     WHERE r.id = $1
     GROUP BY r.id`,
    [roomId]
  )
  return roomResult.rows[0] ?? null
}

function filledSlotCount(slots: { slotType: string; playerId?: string | null }[]): number {
  return slots.filter(s => s.slotType === 'computer' || s.playerId).length
}

/** Publish to game engine that the room is ready to start */
async function publishRoomReady(roomId: string, filledPositions: number[] = []): Promise<void> {
  await redis.publish('room:ready', JSON.stringify({
    roomId,
    autoFilled: filledPositions.length > 0,
    vacantPositionsFilled: filledPositions,
    difficulty: process.env.ROOM_AUTOFILL_DIFFICULTY || 'medium',
  }))
}

// ─── Create Room ──────────────────────────────────────────────────────────────

export async function createRoom(input: CreateRoomInput) {
  const { type, creatorId, computerSlots = [] } = input
  const roomId = uuidv4()
  const accessCode = type === 'private' ? generateAccessCode() : null

  // Validate: creator cannot fill all 4 slots with computers
  if (computerSlots.length > 3) throw new Error('TOO_MANY_COMPUTER_SLOTS')

  // Validate: computer slots must not include position 0 (creator's slot)
  if (computerSlots.some(s => s.position === 0)) throw new Error('INVALID_COMPUTER_POSITION')

  // Validate no duplicate positions
  const positions = computerSlots.map(s => s.position)
  if (new Set(positions).size !== positions.length) throw new Error('DUPLICATE_POSITION')

  await db.query(
    `INSERT INTO rooms (id, type, status, access_code, creator_id)
     VALUES ($1, $2, 'waiting', $3, $4)`,
    [roomId, type, accessCode, creatorId]
  )

  // Insert creator in position 0
  await db.query(
    `INSERT INTO room_slots (room_id, position, slot_type, player_id)
     VALUES ($1, 0, 'human', $2)`,
    [roomId, creatorId]
  )

  // Insert computer slots with bot names
  for (const cs of computerSlots) {
    const botName = BOT_NAMES[cs.position] || `Bot-${cs.position}`
    await db.query(
      `INSERT INTO room_slots (room_id, position, slot_type, difficulty, bot_name)
       VALUES ($1, $2, 'computer', $3, $4)`,
      [roomId, cs.position, cs.difficulty, botName]
    )
  }

  // Cache public rooms list in Redis (invalidate)
  if (type === 'public') await redis.del('public_rooms')

  // Store access code in Redis for fast lookup (private rooms)
  if (accessCode) {
    await redis.set(`room_code:${accessCode}`, roomId)
  }

  const room = await getRoomWithSlots(roomId)

  // Auto-ready if all 4 slots are filled (e.g. 1 human + 3 computers)
  if (filledSlotCount(room.slots) === 4) {
    await db.query(`UPDATE rooms SET status = 'ready' WHERE id = $1`, [roomId])
    room.status = 'ready'
    await publishRoomReady(roomId)
  } else if (type === 'public') {
    // Schedule auto-fill for vacant opponent slots after wait period
    scheduleAutoFill(roomId)
  }

  return room
}

// ─── Quick Play ───────────────────────────────────────────────────────────────
// Creates a private room instantly filled with 3 computer opponents.
// Game auto-starts in ~5 seconds via the room:ready Redis event.

export async function quickPlay(creatorId: string) {
  const roomId = uuidv4()
  const accessCode = generateAccessCode()

  await db.query(
    `INSERT INTO rooms (id, type, status, access_code, creator_id)
     VALUES ($1, 'private', 'ready', $2, $3)`,
    [roomId, accessCode, creatorId]
  )

  // Creator at position 0
  await db.query(
    `INSERT INTO room_slots (room_id, position, slot_type, player_id)
     VALUES ($1, 0, 'human', $2)`,
    [roomId, creatorId]
  )

  // Three computer opponents with human-like names
  const computers = [
    { position: 1, name: 'Faisal' },
    { position: 2, name: 'John'   },
    { position: 3, name: 'Qasim'  },
  ]
  for (const c of computers) {
    await db.query(
      `INSERT INTO room_slots (room_id, position, slot_type, difficulty, bot_name)
       VALUES ($1, $2, 'computer', 'medium', $3)`,
      [roomId, c.position, c.name]
    )
  }

  await redis.set(`room_code:${accessCode}`, roomId)

  const room = await getRoomWithSlots(roomId)

  // Notify game engine — it will auto-start in ~5 seconds
  await publishRoomReady(roomId)

  return room
}

// ─── Get Room ─────────────────────────────────────────────────────────────────

export async function getRoom(roomId: string) {
  const room = await getRoomWithSlots(roomId)
  if (!room) throw new Error('ROOM_NOT_FOUND')
  return room
}

// ─── Join Public Room ─────────────────────────────────────────────────────────

export async function joinPublicRoom(roomId: string, playerId: string) {
  const room = await getRoomWithSlots(roomId)
  if (!room) throw new Error('ROOM_NOT_FOUND')
  if (room.type !== 'public') throw new Error('NOT_A_PUBLIC_ROOM')
  if (room.status !== 'waiting') throw new Error('ROOM_NOT_OPEN')

  return insertPlayerIntoRoom(room, playerId)
}

// ─── Join Private Room ────────────────────────────────────────────────────────

export async function joinPrivateRoom(accessCode: string, playerId: string) {
  const roomId = await redis.get(`room_code:${accessCode}`)
  if (!roomId) throw new Error('INVALID_CODE')

  const room = await getRoomWithSlots(roomId)
  if (!room) throw new Error('ROOM_NOT_FOUND')
  if (room.status !== 'waiting') throw new Error('ROOM_NOT_OPEN')

  return insertPlayerIntoRoom(room, playerId)
}

// ─── Shared slot insertion logic ──────────────────────────────────────────────

async function insertPlayerIntoRoom(room: any, playerId: string) {
  // Already in room?
  if (room.slots.some((s: any) => s.playerId === playerId)) {
    throw new Error('ALREADY_IN_ROOM')
  }

  // Find next empty human slot (positions 0-3 that have no slot row yet)
  const takenPositions = new Set(room.slots.map((s: any) => s.position))
  let emptyPosition: number | null = null
  for (let i = 0; i <= 3; i++) {
    if (!takenPositions.has(i)) { emptyPosition = i; break }
  }

  if (emptyPosition === null) throw new Error('ROOM_FULL')

  await db.query(
    `INSERT INTO room_slots (room_id, position, slot_type, player_id)
     VALUES ($1, $2, 'human', $3)`,
    [room.id, emptyPosition, playerId]
  )

  await redis.del('public_rooms')

  const updated = await getRoomWithSlots(room.id)

  // Auto-ready when all 4 slots filled
  if (filledSlotCount(updated.slots) === 4) {
    await db.query(`UPDATE rooms SET status = 'ready' WHERE id = $1`, [room.id])
    updated.status = 'ready'
    cancelAutoFill(room.id)
    await publishRoomReady(room.id)
  }

  return updated
}

// ─── Add Computer Player ──────────────────────────────────────────────────────

export async function addComputerPlayer(
  roomId: string,
  requesterId: string,
  position: 0 | 1 | 2 | 3,
  difficulty: Difficulty
) {
  const room = await getRoomWithSlots(roomId)
  if (!room) throw new Error('ROOM_NOT_FOUND')
  if (room.creator_id !== requesterId) throw new Error('NOT_CREATOR')
  if (room.status !== 'waiting') throw new Error('ROOM_NOT_OPEN')

  const takenPositions = new Set(room.slots.map((s: any) => s.position))
  if (takenPositions.has(position)) throw new Error('SLOT_TAKEN')

  const botName = BOT_NAMES[position] || `Bot-${position}`
  await db.query(
    `INSERT INTO room_slots (room_id, position, slot_type, difficulty, bot_name)
     VALUES ($1, $2, 'computer', $3, $4)`,
    [roomId, position, difficulty, botName]
  )

  const updated = await getRoomWithSlots(roomId)

  if (filledSlotCount(updated.slots) === 4) {
    await db.query(`UPDATE rooms SET status = 'ready' WHERE id = $1`, [roomId])
    updated.status = 'ready'
    cancelAutoFill(roomId)
    await publishRoomReady(roomId)
  }

  return updated
}

// ─── List Public Rooms ────────────────────────────────────────────────────────

export async function listPublicRooms() {
  const cached = await redis.get('public_rooms')
  if (cached) return JSON.parse(cached)

  const result = await db.query(
    `SELECT r.id, r.status,
            COUNT(rs.position) AS filled_slots,
            u.display_name AS creator_name
     FROM rooms r
     JOIN users u ON u.id = r.creator_id
     LEFT JOIN room_slots rs ON rs.room_id = r.id
     WHERE r.type = 'public' AND r.status IN ('waiting', 'ready')
     GROUP BY r.id, u.display_name
     ORDER BY r.created_at DESC
     LIMIT 50`,
    []
  )

  const rooms = result.rows
  await redis.setex('public_rooms', 10, JSON.stringify(rooms)) // cache 10 seconds
  return rooms
}

// ─── Get Room Code (creator only) ────────────────────────────────────────────

export async function getRoomCode(roomId: string, requesterId: string) {
  const result = await db.query(
    'SELECT creator_id, access_code, type FROM rooms WHERE id = $1',
    [roomId]
  )
  if (result.rows.length === 0) throw new Error('ROOM_NOT_FOUND')
  const room = result.rows[0]
  if (room.creator_id !== requesterId) throw new Error('NOT_CREATOR')
  if (room.type !== 'private') throw new Error('NOT_A_PRIVATE_ROOM')
  return { accessCode: room.access_code }
}

// ─── Delete Room ──────────────────────────────────────────────────────────────

export async function deleteRoom(roomId: string, requesterId: string) {
  const result = await db.query(
    'SELECT creator_id, status, access_code, type FROM rooms WHERE id = $1',
    [roomId]
  )
  if (result.rows.length === 0) throw new Error('ROOM_NOT_FOUND')
  const room = result.rows[0]
  if (room.creator_id !== requesterId) throw new Error('NOT_CREATOR')
  if (room.status === 'in_progress') throw new Error('GAME_IN_PROGRESS')

  await db.query('DELETE FROM rooms WHERE id = $1', [roomId])

  if (room.type === 'private' && room.access_code) {
    await redis.del(`room_code:${room.access_code}`)
  }
  await redis.del('public_rooms')

  // Cancel any pending auto-fill timer for this room
  cancelAutoFill(roomId)
}
