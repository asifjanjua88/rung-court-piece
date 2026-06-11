import { Server } from 'socket.io'
import http from 'http'
import jwt from 'jsonwebtoken'
import Redis from 'ioredis'
import { Pool } from 'pg'
import { GameRoom, RoomSlot } from './game/GameRoom'
import { Card, Suit } from './game/Deck'

// ── Minimal HTTP for Docker healthcheck ───────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
  } else {
    res.writeHead(404); res.end()
  }
})
const PORT = process.env.GAME_ENGINE_PORT || 4001

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const db = new Pool({
  host:     process.env.POSTGRES_HOST,
  port:     Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

/** Load room slots from the database and convert to GameRoom format */
async function loadRoomSlots(roomId: string): Promise<RoomSlot[]> {
  const result = await db.query(
    `SELECT rs.position, rs.slot_type, rs.player_id, rs.difficulty, rs.bot_name,
            u.display_name
     FROM room_slots rs
     LEFT JOIN users u ON u.id = rs.player_id
     WHERE rs.room_id = $1
     ORDER BY rs.position`,
    [roomId]
  )
  return result.rows.map(row => ({
    position:    row.position as 0 | 1 | 2 | 3,
    type:        row.slot_type as 'human' | 'computer',
    playerId:    row.slot_type === 'computer'
                   ? `computer-${row.position}`
                   : row.player_id,
    difficulty:  row.difficulty ?? 'medium',
    displayName: row.slot_type === 'computer'
                   ? (row.bot_name ?? `Bot ${row.position}`)
                   : (row.display_name ?? 'Player'),
  }))
}

// ── Redis subscriber — listens for room:ready from API ────────────────────────
const AUTO_START_DELAY = 5000  // 5 seconds countdown

const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
})

subscriber.subscribe('room:ready', (err) => {
  if (err) console.error('[GameEngine] Redis subscribe error:', err)
  else     console.log('[GameEngine] Subscribed to room:ready channel')
})

subscriber.on('message', async (_channel: string, message: string) => {
  try {
    const data = JSON.parse(message) as {
      roomId: string
      autoFilled: boolean
      vacantPositionsFilled: number[]
      difficulty: string
    }

    const { roomId } = data

    console.log(`[GameEngine] Room ${roomId} ready — auto-starting in ${AUTO_START_DELAY / 1000}s`)

    // Notify connected clients (show countdown in UI)
    io.to(roomId).emit('room_ready', {
      roomId,
      countdown: AUTO_START_DELAY / 1000,
      message: `Game starting in ${AUTO_START_DELAY / 1000} seconds…`,
    })

    if (data.autoFilled && data.vacantPositionsFilled?.length > 0) {
      io.to(roomId).emit('room_autofilled', {
        roomId,
        vacantPositionsFilled: data.vacantPositionsFilled,
        difficulty: data.difficulty,
        message: `Computer players joined empty slots.`,
      })
    }

    // Auto-start after countdown
    setTimeout(async () => {
      try {
        // Always reload slots from DB — they may have changed since room was created
        const freshSlots = await loadRoomSlots(roomId)
        if (freshSlots.length === 0) {
          console.warn(`[GameEngine] Room ${roomId} — no slots found in DB, skipping auto-start`)
          return
        }

        let room = rooms.get(roomId)
        if (!room) {
          room = new GameRoom(roomId, freshSlots, io)
          rooms.set(roomId, room)
        } else {
          room.updateSlots(freshSlots)
        }

        console.log(`[GameEngine] Room ${roomId} — auto-starting game`)
        room.startGame()
      } catch (err) {
        console.error(`[GameEngine] Auto-start error for room ${roomId}:`, err)
      }
    }, AUTO_START_DELAY)

  } catch (err) {
    console.error('[GameEngine] Failed to handle room:ready event:', err)
  }
})

// ── Socket.io server ──────────────────────────────────────────────────────────
const io = new Server(server, {
  path: '/ws',
  cors: { origin: '*' },
})

// Active game rooms: roomId → GameRoom
const rooms = new Map<string, GameRoom>()

// Track which room each connected player is in (for disconnect routing)
const playerRoom = new Map<string, string>()   // playerId → roomId

// ── JWT auth on WebSocket handshake ───────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  console.log(`[Auth] Socket handshake — token present: ${!!token}, JWT_SECRET present: ${!!process.env.JWT_SECRET}`)
  if (!token) {
    console.log('[Auth] Rejected: no token')
    return next(new Error('Unauthorized'))
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string; identityType: string
    }
    socket.data.user = payload
    console.log(`[Auth] Accepted: userId=${payload.id}, type=${payload.identityType}`)
    next()
  } catch (err) {
    console.log('[Auth] Rejected: invalid token —', (err as Error).message)
    next(new Error('Invalid token'))
  }
})

// ── Connection handler ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const { id: playerId } = socket.data.user
  console.log(`Player connected: ${playerId}`)

  // ── Join a game room ────────────────────────────────────────────────────────
  socket.on('join_room', async (payload: { roomId: string }) => {
    const { roomId } = payload
    console.log(`[join_room] Player ${playerId} joining room ${roomId}`)
    try {
      if (!rooms.has(roomId)) {
        // Load room configuration from the database
        const slots = await loadRoomSlots(roomId)
        if (slots.length === 0) {
          socket.emit('game_error', { error: 'Room not found or not yet configured.' })
          return
        }
        rooms.set(roomId, new GameRoom(roomId, slots, io))
      }
      rooms.get(roomId)!.join(socket, playerId)
      playerRoom.set(playerId, roomId)        // remember which room this player is in
    } catch (err) {
      console.error(`[join_room] Error for room ${roomId}:`, err)
      socket.emit('game_error', { error: 'Failed to join room.' })
    }
  })

  // ── Start game (creator only — kept as manual fallback) ─────────────────────
  socket.on('start_game', (payload: { roomId: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.startGame()
  })

  // ── Start next round (after round_over) ─────────────────────────────────────
  socket.on('next_round', (payload: { roomId: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.startNextRound()
  })

  // ── Request current game snapshot (game page uses this on mount) ────────────
  socket.on('request_game_state', (payload: { roomId: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) {
      // Room not in memory yet — try to load it so we can send state
      loadRoomSlots(payload.roomId).then(slots => {
        if (slots.length === 0) return
        const newRoom = new GameRoom(payload.roomId, slots, io)
        rooms.set(payload.roomId, newRoom)
        newRoom.join(socket, playerId)   // join + sends state if game started
      }).catch(err => console.error('[request_game_state] load error:', err))
      return
    }
    room.sendStateTo(socket, playerId)
  })

  // ── Deal cards (dealing-team player clicks "Deal") ──────────────────────────
  socket.on('deal_cards', (payload: { roomId: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.onDealCards(playerId)
  })

  // ── Select hidden rung (Rung Holder) ────────────────────────────────────────
  socket.on('select_hidden_rung', (payload: { roomId: string; card: Card }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.onSelectHiddenRung(playerId, payload.card)
  })

  // ── Call color ──────────────────────────────────────────────────────────────
  socket.on('call_color', (payload: { roomId: string; suit: Suit }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.onCallColor(playerId, payload.suit)
  })

  // ── Pass color call ──────────────────────────────────────────────────────────
  socket.on('pass_color_call', (payload: { roomId: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.onPassColorCall(playerId)
  })

  // ── Play a card ─────────────────────────────────────────────────────────────
  socket.on('play_card', (payload: { roomId: string; card: Card }) => {
    const room = rooms.get(payload.roomId)
    if (!room) { socket.emit('game_error', { error: 'Room not found' }); return }
    room.onPlayCard(playerId, payload.card)
  })

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${playerId}`)
    const roomId = playerRoom.get(playerId)
    if (roomId) {
      rooms.get(roomId)?.disconnect(playerId)
      playerRoom.delete(playerId)
    }
  })
})

server.on('upgrade', (req) => {
  console.log(`[HTTP] WebSocket upgrade received: ${req.url}`)
})

server.listen(PORT, () => {
  console.log(`Game engine running on port ${PORT}`)
})
