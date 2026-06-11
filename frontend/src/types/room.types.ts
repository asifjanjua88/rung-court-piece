export type RoomType = 'public' | 'private'
export type RoomStatus = 'waiting' | 'ready' | 'in_progress' | 'completed'
export type SlotType = 'human' | 'computer'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Slot {
  position: 0 | 1 | 2 | 3
  type: SlotType
  playerId?: string
  displayName?: string
  difficulty?: Difficulty
}

export interface Room {
  id: string
  type: RoomType
  status: RoomStatus
  creatorId: string
  slots: Slot[]
  accessCode?: string
}

// Lightweight summary returned by GET /rooms/public
export interface PublicRoomSummary {
  id: string
  status: RoomStatus
  filled_slots: string | number
  creator_name: string
}
