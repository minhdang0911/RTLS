import { useRef, useEffect } from 'react'
import { ZONES, FLOOR_WIDTH, FLOOR_HEIGHT, EMPLOYEES } from '../utils/zoneColors'

const GRAY_AREAS = [
  { label: 'Cầu thang', x: 4,  y: 8, w: 3, h: 7 },
  { label: 'Tủ linh kiện', x: 7, y: 8, w: 4, h: 7 },
  { label: 'Sàn thượng',   x: 16, y: 0, w: 3, h: 15 },
]

const parseColor = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const FloorMap = ({ employees }) => {
  const canvasRef = useRef(null)
  const empsRef   = useRef(employees)
  const animRef   = useRef(null)
  const pulseRef  = useRef(0)

  useEffect(() => { empsRef.current = employees }, [employees])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const sx = W / FLOOR_WIDTH
    const sy = H / FLOOR_HEIGHT

    const draw = () => {
      pulseRef.current += 0.035
      const p = pulseRef.current

      /* ── Background ── */
      ctx.fillStyle = '#080C14'
      ctx.fillRect(0, 0, W, H)

      /* ── Grid ── */
      for (let x = 0; x <= FLOOR_WIDTH; x++) {
        ctx.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.02)'
        ctx.lineWidth = x % 5 === 0 ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, H); ctx.stroke()
      }
      for (let y = 0; y <= FLOOR_HEIGHT; y++) {
        ctx.strokeStyle = y % 5 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.02)'
        ctx.lineWidth = y % 5 === 0 ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(W, y * sy); ctx.stroke()
      }

      /* ── Zones ── */
      ZONES.forEach(zone => {
        const zx = zone.x * sx, zy = zone.y * sy
        const zw = zone.w * sx, zh = zone.h * sy
        const [r, g, b] = parseColor(zone.color)

        // Zone fill gradient
        const grad = ctx.createLinearGradient(zx, zy, zx, zy + zh)
        grad.addColorStop(0, `rgba(${r},${g},${b},0.12)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`)
        ctx.fillStyle = grad
        ctx.fillRect(zx, zy, zw, zh)

        // Zone border
        ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`
        ctx.lineWidth = 1.5
        ctx.strokeRect(zx, zy, zw, zh)

        // Zone header bar
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
        ctx.fillRect(zx, zy, zw, 32)

        // Zone name
        ctx.fillStyle = `rgba(${r},${g},${b},1)`
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(zone.name, zx + zw / 2, zy + 14)

        // Zone id tag
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
        ctx.font = '10px Inter, sans-serif'
        ctx.fillText(`Zone ${zone.id.split('_')[1].toUpperCase()}`, zx + zw / 2, zy + 27)
      })

      /* ── Gray / Untracked Areas ── */
      GRAY_AREAS.forEach(({ label, x, y, w, h }) => {
        // hatching pattern
        ctx.save()
        ctx.beginPath()
        ctx.rect(x * sx, y * sy, w * sx, h * sy)
        ctx.clip()
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 1
        for (let i = -h; i < w + h; i += 1.5) {
          ctx.beginPath()
          ctx.moveTo((x + i) * sx, y * sy)
          ctx.lineTo((x + i - h) * sx, (y + h) * sy)
          ctx.stroke()
        }
        ctx.restore()

        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(x * sx, y * sy, w * sx, h * sy)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(x * sx, y * sy, w * sx, h * sy)
        ctx.setLineDash([])

        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, (x + w / 2) * sx, (y + h / 2) * sy + 4)
      })

      /* ── Employees ── */
      Object.values(empsRef.current).forEach(emp => {
        const info = EMPLOYEES[emp.tag_id]
        if (!info) return
        const [r, g, b] = parseColor(info.color)
        const px = emp.x * sx
        const py = emp.y * sy

        // Outer glow rings
        ;[
          { radius: 22 + 6 * Math.sin(p),     alpha: 0.2 + 0.15 * Math.sin(p),     lw: 1.5 },
          { radius: 30 + 6 * Math.sin(p + 1), alpha: 0.08 + 0.07 * Math.sin(p + 1), lw: 1 },
        ].forEach(({ radius, alpha, lw }) => {
          ctx.beginPath()
          ctx.arc(px, py, radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
          ctx.lineWidth = lw
          ctx.stroke()
        })

        // Shadow glow
        ctx.shadowColor = info.color
        ctx.shadowBlur = 20

        // Dot
        ctx.beginPath()
        ctx.arc(px, py, 13, 0, Math.PI * 2)
        const dotGrad = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, 13)
        dotGrad.addColorStop(0, `rgba(${r},${g},${b},1)`)
        dotGrad.addColorStop(1, `rgba(${Math.max(r-40,0)},${Math.max(g-40,0)},${Math.max(b-40,0)},1)`)
        ctx.fillStyle = dotGrad
        ctx.fill()
        ctx.shadowBlur = 0

        // White ring
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // ID label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(emp.tag_id.replace('EMP_', ''), px, py + 3.5)

        // Name below dot
        ctx.font = '500 9px Inter, sans-serif'
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
        ctx.fillText(info.name.split(' ').pop(), px, py + 29)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </div>
          <div>
            <div className="section-label">Mặt bằng — Realtime</div>
            <div className="section-sub">Nhà máy iKY · UWB tracking</div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', padding: '3px 10px', borderRadius: 8 }}>
          {FLOOR_WIDTH}m × {FLOOR_HEIGHT}m
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={760}
        height={570}
        className="map-canvas"
      />

      <div className="map-footer">
        <div className="map-legend">
          {ZONES.map(z => (
            <div key={z.id} className="legend-item">
              <span className="legend-rect" style={{ background: z.color }} />
              {z.name}
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)', margin: '0 2px' }} />
          {Object.entries(EMPLOYEES).map(([id, info]) => (
            <div key={id} className="legend-item">
              <span className="legend-dot" style={{ background: info.color, boxShadow: `0 0 5px ${info.color}` }} />
              {info.name.split(' ').pop()}
            </div>
          ))}
        </div>
        <span className="map-scale">1 ô = 1m</span>
      </div>
    </div>
  )
}

export default FloorMap
