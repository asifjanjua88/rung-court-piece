import { Response } from 'express'
import { z } from 'zod'
import * as roomService from '../services/room.service'
import { AuthRequest } from '../middleware/auth.middleware'

// ─── Validation schemas ───────────────────────────────────────────────────────

const difficultyEnum = z.enum(['easy', 'medium', 'hard'])
const positionEnum = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])

const createRoomSchema = z.object({
  type: z.enum(['public', 'private']),
  computerSlots: z.array(
    z.object({
      position: positionEnum,
      difficulty: difficultyEnum,
    })
  ).max(3).optional(),
})

const joinPublicSchema = z.object({
  roomId: z.string().uuid(),
})

const joinPrivateSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
})

const addComputerSchema = z.object({
  roomId: z.string().uuid(),
  position: positionEnum,
  difficulty: difficultyEnum,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: 'VALIDATION_ERROR',
    details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
  })
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/rooms/create
 * Body: { type: 'public'|'private', computerSlots?: [{ position, difficulty }] }
 * Creates a new room. Creator occupies position 0.
 */
export const createRoom = async (req: AuthRequest, res: Response) => {
  const parsed = createRoomSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const room = await roomService.createRoom({
      type: parsed.data.type,
      creatorId: req.user!.id,
      computerSlots: parsed.data.computerSlots as any,
    })
    return res.status(201).json({ room })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'TOO_MANY_COMPUTER_SLOTS')
        return res.status(400).json({ error: err.message, message: 'Maximum 3 computer players allowed.' })
      if (err.message === 'INVALID_COMPUTER_POSITION')
        return res.status(400).json({ error: err.message, message: 'Computer cannot occupy position 0 (creator slot).' })
      if (err.message === 'DUPLICATE_POSITION')
        return res.status(400).json({ error: err.message, message: 'Duplicate slot positions provided.' })
    }
    console.error('[createRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/rooms/join/public
 * Body: { roomId }
 */
export const joinPublicRoom = async (req: AuthRequest, res: Response) => {
  const parsed = joinPublicSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const room = await roomService.joinPublicRoom(parsed.data.roomId, req.user!.id)
    return res.status(200).json({ room })
  } catch (err: unknown) {
    if (err instanceof Error) {
      const clientErrors: Record<string, [number, string]> = {
        ROOM_NOT_FOUND:    [404, 'Room not found.'],
        NOT_A_PUBLIC_ROOM: [400, 'This is a private room. Use a code to join.'],
        ROOM_NOT_OPEN:     [400, 'Room is no longer accepting players.'],
        ALREADY_IN_ROOM:   [400, 'You are already in this room.'],
        ROOM_FULL:         [400, 'Room is full.'],
      }
      const mapped = clientErrors[err.message]
      if (mapped) return res.status(mapped[0]).json({ error: err.message, message: mapped[1] })
    }
    console.error('[joinPublicRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/rooms/join/private
 * Body: { code } — 6-digit access code
 */
export const joinPrivateRoom = async (req: AuthRequest, res: Response) => {
  const parsed = joinPrivateSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const room = await roomService.joinPrivateRoom(parsed.data.code, req.user!.id)
    return res.status(200).json({ room })
  } catch (err: unknown) {
    if (err instanceof Error) {
      const clientErrors: Record<string, [number, string]> = {
        INVALID_CODE:    [400, 'Invalid or expired room code.'],
        ROOM_NOT_FOUND:  [404, 'Room not found.'],
        ROOM_NOT_OPEN:   [400, 'Room is no longer accepting players.'],
        ALREADY_IN_ROOM: [400, 'You are already in this room.'],
        ROOM_FULL:       [400, 'Room is full.'],
      }
      const mapped = clientErrors[err.message]
      if (mapped) return res.status(mapped[0]).json({ error: err.message, message: mapped[1] })
    }
    console.error('[joinPrivateRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/rooms/add-computer
 * Body: { roomId, position, difficulty }
 * Creator only — adds a computer player to an empty slot
 */
export const addComputerPlayer = async (req: AuthRequest, res: Response) => {
  const parsed = addComputerSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)

  try {
    const room = await roomService.addComputerPlayer(
      parsed.data.roomId,
      req.user!.id,
      parsed.data.position,
      parsed.data.difficulty
    )
    return res.status(200).json({ room })
  } catch (err: unknown) {
    if (err instanceof Error) {
      const clientErrors: Record<string, [number, string]> = {
        ROOM_NOT_FOUND:  [404, 'Room not found.'],
        NOT_CREATOR:     [403, 'Only the room creator can add computer players.'],
        ROOM_NOT_OPEN:   [400, 'Room is no longer accepting changes.'],
        SLOT_TAKEN:      [400, 'That slot is already occupied.'],
      }
      const mapped = clientErrors[err.message]
      if (mapped) return res.status(mapped[0]).json({ error: err.message, message: mapped[1] })
    }
    console.error('[addComputerPlayer]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/rooms/public
 * Returns list of open public rooms
 */
export const listPublicRooms = async (_req: AuthRequest, res: Response) => {
  try {
    const rooms = await roomService.listPublicRooms()
    return res.status(200).json({ rooms })
  } catch (err) {
    console.error('[listPublicRooms]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/rooms/:id/code
 * Creator only — returns 6-digit access code for a private room
 */
export const getRoomCode = async (req: AuthRequest, res: Response) => {
  try {
    const result = await roomService.getRoomCode(req.params.id, req.user!.id)
    return res.status(200).json(result)
  } catch (err: unknown) {
    if (err instanceof Error) {
      const clientErrors: Record<string, [number, string]> = {
        ROOM_NOT_FOUND:      [404, 'Room not found.'],
        NOT_CREATOR:         [403, 'Only the creator can view the room code.'],
        NOT_A_PRIVATE_ROOM:  [400, 'This room does not have an access code.'],
      }
      const mapped = clientErrors[err.message]
      if (mapped) return res.status(mapped[0]).json({ error: err.message, message: mapped[1] })
    }
    console.error('[getRoomCode]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * GET /api/v1/rooms/:id
 * Returns full room data (slots, status, type) for any member
 */
export const getRoom = async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomService.getRoom(req.params.id)
    return res.status(200).json({ room })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ROOM_NOT_FOUND')
      return res.status(404).json({ error: 'ROOM_NOT_FOUND', message: 'Room not found.' })
    console.error('[getRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * POST /api/v1/rooms/quick-play
 * Creates a private room instantly filled with 3 computer opponents.
 * Game auto-starts via room:ready Redis event (~5 seconds after connecting).
 */
export const quickPlay = async (req: AuthRequest, res: Response) => {
  try {
    const room = await roomService.quickPlay(req.user!.id)
    return res.status(201).json({ room })
  } catch (err) {
    console.error('[quickPlay]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}

/**
 * DELETE /api/v1/rooms/:id
 * Creator only — deletes a waiting or ready room
 */
export const deleteRoom = async (req: AuthRequest, res: Response) => {
  try {
    await roomService.deleteRoom(req.params.id, req.user!.id)
    return res.status(200).json({ message: 'Room deleted.' })
  } catch (err: unknown) {
    if (err instanceof Error) {
      const clientErrors: Record<string, [number, string]> = {
        ROOM_NOT_FOUND:   [404, 'Room not found.'],
        NOT_CREATOR:      [403, 'Only the creator can delete the room.'],
        GAME_IN_PROGRESS: [400, 'Cannot delete a room while a game is in progress.'],
      }
      const mapped = clientErrors[err.message]
      if (mapped) return res.status(mapped[0]).json({ error: err.message, message: mapped[1] })
    }
    console.error('[deleteRoom]', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
