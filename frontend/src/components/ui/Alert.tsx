type AlertType = 'error' | 'success' | 'info'

interface AlertProps { type: AlertType; message: string; onClose?: () => void }

export default function Alert({ type, message, onClose }: AlertProps) {
  const cls = { error: 'alert-error', success: 'alert-success', info: 'alert-info' }[type]
  const icons = { error: '⚠️', success: '✅', info: 'ℹ️' }

  return (
    <div className={`${cls} flex items-start gap-3 animate-slide-up`}>
      <span>{icons[type]}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 leading-none">×</button>
      )}
    </div>
  )
}
