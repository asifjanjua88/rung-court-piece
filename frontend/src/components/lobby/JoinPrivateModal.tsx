'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { roomApi } from '@/services/api.service'
import { useRoomStore } from '@/store/room.store'
import Spinner from '@/components/ui/Spinner'

interface Props { open: boolean; onClose: () => void }

export default function JoinPrivateModal({ open, onClose }: Props) {
  const router = useRouter()
  const setCurrentRoom = useRoomStore(s => s.setCurrentRoom)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleDigit = (i: number, val: string) => {
    const v = val.replace(/\D/, '').slice(-1)
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    setDigits(text.split('').concat(Array(6 - text.length).fill('')))
    refs.current[Math.min(text.length, 5)]?.focus()
  }

  const code = digits.join('')

  const handleJoin = async () => {
    if (code.length !== 6) { setError('Enter all 6 digits.'); return }
    setError('')
    setLoading(true)
    try {
      const { data } = await roomApi.joinPrivate(code)
      setCurrentRoom(data.room)
      onClose()
      router.push(`/room/${data.room.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid or expired code.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="🔒 Join Private Room">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-400 mb-5">
            Enter the 6-digit code shared by the room creator.
          </p>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input key={i}
                ref={el => { refs.current[i] = el }}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-slate-700
                           border-2 border-slate-600 rounded-xl text-slate-100
                           focus:outline-none focus:border-gold transition-colors"
              />
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary py-2.5">Cancel</button>
          <button onClick={handleJoin} disabled={loading || code.length < 6}
            className="btn-primary py-2.5 flex items-center justify-center gap-2">
            {loading ? <Spinner size="sm" /> : null}
            Join Room
          </button>
        </div>
      </div>
    </Modal>
  )
}
