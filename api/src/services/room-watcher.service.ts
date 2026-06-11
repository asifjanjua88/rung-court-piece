/**
 * RoomWatcher
 *
 * When a public room is created, a countdown timer starts.
 * After ROOM_AUTOFILL_WAIT_SECONDS, any slot that is still vacant
 * (no real human joined) is automatically filled with a computer player
 * at the configured difficulty level.
 *
 * Rules:
 *  - Only applies to PUBLIC rooms
 *  - Only fills VACANT slots (position has no row in room_slots yet)
 *  - Creator's slot (position 0) is always a real player — never touched
 *  - Any real player who joined before the timer fires keeps their slot
 *  - If the room is already full, ready, deleted, or in_progress → skip
 *  - If ROOM_AUTOFILL_WAIT_SECONDS = 0 → feature is disabled
 */

import { db } from '../db/postgres'
import { redis } from '../db/redis'

const WAIT_SECONDS = parseInt(process.env.ROOM_AUTOFILL_WAIT_SECONDS || '30', 10)
const DIFFICULTY = (process.env.ROOM_AUTOFILL_DIFFICULTY || 'medium') as 'easy' | 'medium' | 'hard'

// In-memory map of active timers: roomId → NodeJS.Timeout
// This is fine for single-instance API. For multi-instance, use Redis TTL events (see note below).
const activeTimers = new Map<string, NodeJS.Timeout>()

// ─── Schedule auto-fill for a newly created public room ───────────────────────

export function scheduleAutoFill(roomId: string): void {
  if (WAIT_SECONDS === 0) return  // feature disabled

  // Cancel any existing timer for this room (safety)
  cancelAutoFill(roomId)

  const timer = setTimeout(() => {
    activeTimers.delete(roomId)
    runAutoFill(roomId).catch(err =>
      console.error(`[RoomWatcher] Auto-fill error for room ${roomId}:`, err)
    )
  }, WAIT_SECONDS * 1000)

  activeTimers.set(roomId, timer)

  console.log(
    `[RoomWatcher] Room ${roomId} — auto-fill scheduled in ${WAIT_SECONDS}s`
  )
}

// ─── Cancel a pending auto-fill (called when room is deleted or filled) ───────

export function cancelAutoFill(roomId: string): void {
  const existing = activeTimers.get(roomId)
  if (existing) {
    clearTimeout(existing)
    activeTimers.delete(roomId)
    console.log(`[RoomWatcher] Room ${roomId} — auto-fill cancelled`)
  }
}

// ─── Core auto-fill logic ─────────────────────────────────────────────────────

async function runAutoFill(roomId: string): Promise<void> {
  console.log(`[RoomWatcher] Room ${roomId} — checking for vacant slots...`)

  // Fetch current room state
  const roomResult = await db.query(
    `SELECT r.id, r.type, r.status
     FROM rooms r
     WHERE r.id = $1`,
    [roomId]
  )

  if (roomResult.rows.length === 0) {
    console.log(`[RoomWatcher] Room ${roomId} — no longer exists, skipping`)
    return
  }

  const room = roomResult.rows[0]

  // Only act on public rooms still in waiting state
  if (room.type !== 'public') return
  if (room.status !== 'waiting') {
    console.log(`[RoomWatcher] Room ${roomId} — status is '${room.status}', skipping`)
    return
  }

  // Get occupied positions
  const slotsResult = await db.query(
    `SELECT position FROM room_slots WHERE room_id = $1`,
    [roomId]
  )

  const occupiedPositions = new Set<number>(slotsResult.rows.map((r: { position: number }) => r.position))

  // Find all 4 positions — fill only the vacant ones
  const allPositions = [0, 1, 2, 3]
  const vacantPositions = allPositions.filter(p => !occupiedPositions.has(p))

  if (vacantPositions.length === 0) {
    console.log(`[RoomWatcher] Room ${roomId} — all slots filled, nothing to do`)
    return
  }

  console.log(
    `[RoomWatcher] Room ${roomId} — filling ${vacantPositions.length} vacant slot(s): ` +
    `positions [${vacantPositions.join(', ')}] with computer (${DIFFICULTY})`
  )

  // Human-like names for computer players (matches room.service.ts)
  const BOT_NAMES: Record<number, string> = { 0: 'Ali', 1: 'Faisal', 2: 'John', 3: 'Qasim' }

  // Insert computer players for all vacant positions (with human-like names)
  for (const position of vacantPositions) {
    const botName = BOT_NAMES[position] || `Player-${position}`
    await db.query(
      `INSERT INTO room_slots (room_id, position, slot_type, difficulty, bot_name)
       VALUES ($1, $2, 'computer', $3, $4)
       ON CONFLICT (room_id, position) DO NOTHING`,
      [roomId, position, DIFFICULTY, botName]
    )
  }

  // Mark room as ready — all 4 slots now filled
  await db.query(
    `UPDATE rooms SET status = 'ready' WHERE id = $1`,
    [roomId]
  )

  // Invalidate public rooms cache
  await redis.del('public_rooms')

  console.log(`[RoomWatcher] Room ${roomId} — status set to 'ready' with computers filling gaps`)

  // Notify game engine via Redis pub/sub that room is ready
  await redis.publish('room:ready', JSON.stringify({
    roomId,
    autoFilled: true,
    vacantPositionsFilled: vacantPositions,
    difficulty: DIFFICULTY,
  }))
}

/*
 * NOTE — Multi-instance scaling:
 * If you ever run multiple API container replicas, the in-memory timer approach
 * means only the instance that created the room will fire the auto-fill.
 * To support multi-instance: replace setTimeout with Redis key expiry events
 * (notify-keyspace-events = Ex), store "autofill:{roomId}" key with TTL,
 * and have a Redis subscriber on each instance handle the expiry event
 * with a distributed lock (SETNX) so only one instance executes the fill.
 * For Phase 1 (single instance), the in-memory approach is correct and simple.
 */
