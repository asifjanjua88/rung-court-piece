'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { roomApi } from '@/services/api.service'
import { useRoomStore } from '@/store/room.store'
import Spinner from '@/components/ui/Spinner'

interface Props { open: boolean; onClose: () => void }

const POSITIONS = [1, 2, 3] as const
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export default function CreateRoomModal({ open, onClose }: Props) {
  const router = useRouter()
  const setCurrentRoom = useRoomStore(s => s.setCurrentRoom)
  const [type, setType]         = useState<'public' | 'private'>('public')
  const [computers, setComputers] = useState<Record<number, string>>({})
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const toggleComputer = (pos: number) => {
    setComputers(prev => {
      const next = { ...prev }
      if (next[pos]) delete next[pos]
      else next[pos] = 'medium'
      return next
    })
  }

  const setDifficulty = (pos: number, diff: string) =>
    setComputers(prev => ({ ...prev, [pos]: diff }))

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    try {
      const computerSlots = Object.entries(computers).map(([pos, diff]) => ({
        position: Number(pos),
        difficulty: diff,
      }))
      const { data } = await roomApi.create({ type, computerSlots })
      setCurrentRoom(data.room)
      onClose()
      router.push(`/room/${data.room.id}`)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create room.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="🏠 Create Room">
      <div className="space-y-6">

        {/* Room Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Room Type</label>
          <div className="grid grid-cols-2 gap-3">
            {(['public', 'private'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all
                  ${type === t
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {t === 'public' ? '🌐 Public' : '🔒 Private'}
                <p className="text-xs font-normal mt-0.5 opacity-70">
                  {t === 'public' ? 'Anyone can join' : '6-digit code to join'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Computer Players */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Computer Players
          </label>
          <p className="text-xs text-slate-500 mb-3">
            You are at position 0. Add computers to other slots.
          </p>
          <div className="space-y-2">
            {POSITIONS.map(pos => (
              <div key={pos} className="flex items-center gap-3">
                <button onClick={() => toggleComputer(pos)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm text-left transition-all
                    ${computers[pos]
                      ? 'border-gold/50 bg-gold/5 text-gold'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                  <span className="font-medium">Position {pos}</span>
                  <span className="ml-2 text-xs opacity-60">
                    {computers[pos] ? '🤖 Computer' : '👤 Human (waiting)'}
                  </span>
                </button>
                {computers[pos] && (
                  <select value={computers[pos]} onChange={e => setDifficulty(pos, e.target.value)}
                    className="form-input w-28 py-2 text-xs">
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary py-2.5">Cancel</button>
          <button onClick={handleCreate} disabled={loading}
            className="btn-primary py-2.5 flex items-center justify-center gap-2">
            {loading ? <Spinner size="sm" /> : null}
            Create Room
          </button>
        </div>
      </div>
    </Modal>
  )
}
