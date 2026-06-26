import { useRef, useEffect } from 'react'
import { ZONES, FLOOR_WIDTH, FLOOR_HEIGHT, EMPLOYEES } from '../utils/zoneColors'

const GRAY_AREAS = [
  { label: 'Cau thang', x: 4,  y: 8, w: 3, h: 7 },
  { label: 'Tu linh kien', x: 7,  y: 8, w: 4, h: 7 },
  { label: 'San thuong', x: 16, y: 0, w: 3, h: 15 },
]

const parseColor = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

const FloorMap = ({ employees }) => {
  const canvasRef   = useRef(null)
  const empsRef     = useRef(employees)
  const animRef     = useRef(null)
  const pulseRef    = useRef(0)

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
      pulseRef.current += 0.04
      const p = pulseRef.current

      /* background */
      ctx.fillStyle = '#0B1120'
      ctx.fillRect(0, 0, W, H)

      /* grid */
      ctx.lineWidth = 1
      for (let x = 0; x <= FLOOR_WIDTH; x++) {
        ctx.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)'
        ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, H); ctx.stroke()
      }
      for (let y = 0; y <= FLOOR_HEIGHT; y++) {
        ctx.strokeStyle = y % 5 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)'
        ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(W, y * sy); ctx.stroke()
      }

      /* untracked areas */
      GRAY_AREAS.forEach(({ label, x, y, w, h }) => {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(x * sx, y * sy, w * sx, h * sy)
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'
        ctx.lineWidth = 1
        ctx.strokeRect(x * sx, y * sy, w * sx, h * sy)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.font = '10px "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, (x + w / 2) * sx, (y + h / 2) * sy + 4)
      })

      /* zones */
      ZONES.forEach(zone => {
        const zx = zone.x * sx, zy = zone.y * sy
        const zw = zone.w * sx, zh = zone.h * sy
        const [r, g, b] = parseColor(zone.color)

        ctx.fillStyle = `rgba(${r},${g},${b},0.1)`
        ctx.fillRect(zx, zy, zw, zh)

        ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`
        ctx.lineWidth = 1.5
        ctx.strokeRect(zx, zy, zw, zh)

        ctx.fillStyle = zone.color
        ctx.font = 'bold 11px "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(zone.name, zx + zw / 2, zy + 22)

        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
        ctx.font = '10px "Segoe UI", sans-serif'
        ctx.fillText(`Zone ${zone.id.split('_')[1].toUpperCase()}`, zx + zw / 2, zy + 38)
      })

      /* employees */
      Object.values(empsRef.current).forEach(emp => {
        const info = EMPLOYEES[emp.tag_id]
        if (!info) return
        const [r, g, b] = parseColor(info.color)
        const px = emp.x * sx, py = emp.y * sy

        /* outer pulse rings */
        ;[
          { r: 18 + 5 * Math.sin(p),     a: 0.25 + 0.2 * Math.sin(p),     lw: 1.5 },
          { r: 24 + 5 * Math.sin(p + 1), a: 0.1  + 0.1 * Math.sin(p + 1), lw: 1   },
        ].forEach(({ r: pr, a, lw }) => {
          ctx.beginPath()
          ctx.arc(px, py, pr, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`
          ctx.lineWidth = lw
          ctx.stroke()
        })

        /* glow + dot */
        ctx.shadowColor = info.color
        ctx.shadowBlur = 16
        ctx.beginPath()
        ctx.arc(px, py, 12, 0, Math.PI * 2)
        ctx.fillStyle = info.color
        ctx.fill()
        ctx.shadowBlur = 0

        /* white border */
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        /* id label inside */
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(emp.tag_id.replace('EMP_', ''), px, py + 3.5)

        /* name below */
        ctx.font = '9px "Segoe UI", sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillText(info.name.split(' ').pop(), px, py + 27)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <span className="section-label">Mat bang — Realtime</span>
        <span style={{ fontSize: 11, color: '#388BFD', background: 'rgba(56,139,253,0.1)', border: '1px solid rgba(56,139,253,0.18)', padding: '2px 10px', borderRadius: 10 }}>
          {FLOOR_WIDTH}m × {FLOOR_HEIGHT}m
        </span>
      </div>

      <div style={{ padding: '0 14px' }}>
        <canvas
          ref={canvasRef}
          width={760}
          height={570}
          className="map-canvas"
        />
      </div>

      {/* Legend */}
      <div className="map-legend">
        {ZONES.map(z => (
          <div key={z.id} className="legend-item">
            <span className="legend-rect" style={{ background: z.color }} />
            {z.name}
          </div>
        ))}
        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
        {Object.entries(EMPLOYEES).map(([id, info]) => (
          <div key={id} className="legend-item">
            <span className="legend-dot" style={{ background: info.color, boxShadow: `0 0 4px ${info.color}` }} />
            {id.replace('EMP_', '')} — {info.name}
          </div>
        ))}
      </div>
    </div>
  )
}

export default FloorMap
