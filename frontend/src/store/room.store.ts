import { create } from 'zustand'
import { Room, PublicRoomSummary } from '@/types/room.types'

interface RoomStore {
  currentRoom: Room | null
  publicRooms: PublicRoomSummary[]
  setCurrentRoom: (room: Room | null) => void
  setPublicRooms: (rooms: PublicRoomSummary[]) => void
}

export const useRoomStore = create<RoomStore>(set => ({
  currentRoom: null,
  publicRooms: [],
  setCurrentRoom: room  => set({ currentRoom: room }),
  setPublicRooms: rooms => set({ publicRooms: rooms }),
}))
