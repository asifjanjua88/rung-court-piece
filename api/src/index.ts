import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRoutes } from './routes/auth.routes'
import { roomRoutes } from './routes/room.routes'
import { statsRoutes } from './routes/stats.routes'
import { adminRoutes } from './routes/admin.routes'

const app = express()
const PORT = process.env.API_PORT || 4000

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/rooms', roomRoutes)
app.use('/api/v1/stats', statsRoutes)
app.use('/api/v1/admin', adminRoutes)

// Docker healthcheck endpoint (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`)
})
