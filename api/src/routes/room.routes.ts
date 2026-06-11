import { Router } from 'express'
import {
  createRoom,
  joinPublicRoom,
  joinPrivateRoom,
  addComputerPlayer,
  listPublicRooms,
  getRoomCode,
  getRoom,
  quickPlay,
  deleteRoom,
} from '../controllers/room.controller'
import { authMiddleware } from '../middleware/auth.middleware'

export const roomRoutes = Router()

roomRoutes.use(authMiddleware)

roomRoutes.get('/public',        listPublicRooms)
roomRoutes.post('/create',       createRoom)
roomRoutes.post('/quick-play',   quickPlay)
roomRoutes.post('/join/public',  joinPublicRoom)
roomRoutes.post('/join/private', joinPrivateRoom)
roomRoutes.post('/add-computer', addComputerPlayer)
roomRoutes.get('/:id/code',      getRoomCode)
roomRoutes.get('/:id',           getRoom)       // must come after named routes
roomRoutes.delete('/:id',        deleteRoom)
