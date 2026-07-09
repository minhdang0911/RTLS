import { useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Toast Container ──────────────────────────────────────────────────────────
export const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

const ICONS  = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const COLORS = {
  success: { bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.35)',  icon: '#22C55E', bar: '#22C55E' },
  error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  icon: '#EF4444', bar: '#EF4444' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', icon: '#F59E0B', bar: '#F59E0B' },
  info:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', icon: '#3B82F6', bar: '#3B82F6' },
}

const Toast = ({ toast, onRemove }) => {
  const Icon   = ICONS[toast.type]  || Info
  const colors = COLORS[toast.type] || COLORS.info

  return (
    <div
      style={{
        pointerEvents: 'all',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: '#111827',
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.bar}`,
        borderRadius: 10,
        padding: '12px 14px',
        minWidth: 280, maxWidth: 360,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'toastSlideIn 0.25s ease-out',
      }}
    >
      <Icon size={16} color={colors.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 0, flexShrink: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Custom Confirm Dialog ────────────────────────────────────────────────────
export const ConfirmDialog = ({ dialog, onResolve }) => {
  if (!dialog) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={() => onResolve(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111827', border: '1px solid #374151',
          borderRadius: 14, padding: '28px 32px', width: 360,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          animation: 'scaleUp 0.2s ease-out'
        }}
      >
        {/* Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#EF4444" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>
            {dialog.title || 'Xác nhận'}
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 24 }}>
          {dialog.message}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => onResolve(false)}
            style={{
              background: 'transparent', border: '1px solid #374151',
              color: '#9CA3AF', borderRadius: 8, padding: '8px 18px',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
          >
            Hủy
          </button>
          <button
            onClick={() => onResolve(true)}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#EF4444', borderRadius: 8, padding: '8px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
          >
            {dialog.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── useToast hook ────────────────────────────────────────────────────────────
let _toastId = 0

export const useToast = () => {
  const [toasts,  setToasts]  = useState([])
  const [dialog,  setDialog]  = useState(null)
  const resolveRef = useRef(null)

  const toast = useCallback((message, { type = 'info', title, duration = 4000 } = {}) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type, title }])
    if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const confirm = useCallback(({ title, message, confirmText }) => {
    return new Promise(resolve => {
      resolveRef.current = resolve
      setDialog({ title, message, confirmText })
    })
  }, [])

  const handleResolve = useCallback((result) => {
    setDialog(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  return { toasts, toast, removeToast, dialog, confirm, handleResolve }
}
