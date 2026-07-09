import { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, FastForward } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003'

const ReplayPanel = ({ onReplayFrame, onReplayEnd }) => {
  const [isOpen,    setIsOpen]    = useState(false)
  const [frames,    setFrames]    = useState([])
  const [current,   setCurrent]   = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [speed,     setSpeed]     = useState(5)
  const [loading,   setLoading]   = useState(false)
  const [hoursBack, setHoursBack] = useState(1)
  const intervalRef = useRef(null)

  const fetchReplay = async () => {
    setLoading(true)
    const to   = new Date()
    const from = new Date(Date.now() - hoursBack * 3600 * 1000)
    try {
      const data = await fetch(`${API}/api/replay?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json())
      setFrames(data)
      setCurrent(0)
      setPlaying(false)
      console.log(`[Replay] Loaded ${data.length} frames`)
    } catch (e) {
      console.error('Replay fetch error:', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (playing && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrent(prev => {
          const next = prev + 1
          if (next >= frames.length) {
            setPlaying(false)
            onReplayEnd?.()
            return prev
          }
          onReplayFrame?.(frames[next])
          return next
        })
      }, Math.max(50, 200 / speed))
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [playing, frames, speed])

  const handleSeek = (e) => {
    const idx = parseInt(e.target.value)
    setCurrent(idx)
    if (frames[idx]) onReplayFrame?.(frames[idx])
  }

  const progressPct = frames.length > 0 ? (current / (frames.length - 1)) * 100 : 0
  const currentFrame = frames[current]
  const currentTime  = currentFrame ? new Date(currentFrame.timestamp).toLocaleTimeString('vi-VN') : '—'

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
          color: '#8B5CF6', padding: '6px 14px', borderRadius: 8, fontSize: 12,
          fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s'
        }}
      >
        <SkipBack size={13} /> Replay
      </button>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid rgba(139,92,246,0.25)',
      borderRadius: 12, padding: '16px 20px', animation: 'slideDown 0.2s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: 6 }}>
          <SkipBack size={14} /> Replay Mode
        </div>
        <button
          onClick={() => { setIsOpen(false); setPlaying(false); onReplayEnd?.() }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >×</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select
          value={hoursBack}
          onChange={e => setHoursBack(Number(e.target.value))}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}
        >
          <option value={0.5}>30 phút</option>
          <option value={1}>1 giờ</option>
          <option value={4}>4 giờ</option>
          <option value={8}>8 giờ</option>
        </select>
        <button
          onClick={fetchReplay}
          disabled={loading}
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8B5CF6', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
        >
          {loading ? 'Đang tải...' : 'Tải dữ liệu'}
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
          {frames.length > 0 ? `${frames.length} frames` : ''}
        </span>
      </div>

      {frames.length > 0 && (
        <>
          {/* Seek bar */}
          <input
            type="range" min={0} max={frames.length - 1} value={current}
            onChange={handleSeek}
            style={{ width: '100%', marginBottom: 8, accentColor: '#8B5CF6' }}
          />

          {/* Time + Progress */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 10, color: 'var(--text-muted)' }}>
            <span>🕐 {currentTime}</span>
            <span>{Math.round(progressPct)}% • Frame {current + 1}/{frames.length}</span>
          </div>

          {/* Playback controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setCurrent(0); if (frames[0]) onReplayFrame?.(frames[0]) }}
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
            >
              <SkipBack size={13} />
            </button>

            <button
              onClick={() => setPlaying(p => !p)}
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
              {playing ? 'Dừng' : 'Phát'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <FastForward size={12} style={{ color: 'var(--text-muted)' }} />
              <input
                type="range" min={1} max={20} value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                style={{ width: 70, accentColor: '#8B5CF6' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 24 }}>{speed}x</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ReplayPanel
