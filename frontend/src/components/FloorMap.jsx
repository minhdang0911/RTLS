import { useRef, useEffect, useState } from 'react'
import { FLOOR_WIDTH, FLOOR_HEIGHT } from '../utils/zoneColors'

const GRAY_AREAS = [
  { label: 'Cầu thang',    x: 4,  y: 8,  w: 3, h: 7 },
  { label: 'Tủ linh kiện', x: 7,  y: 8,  w: 4, h: 7 },
  { label: 'Sàn thượng',   x: 16, y: 0,  w: 3, h: 15 },
]

const parseColor = (hex) => {
  if (!hex || hex.length < 7) return [100, 100, 100]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const FloorMap = ({
  employees  = {},
  zones      = [],
  anchors    = [],
  heatmapData = null,    // [{x, y, count}] — overlay nhiệt độ
  showRaw    = false,    // hiển thị tọa độ raw (trước Kalman)
  showTrilateration = true, // vẽ vòng tròn anchor-to-tag
}) => {
  const canvasRef = useRef(null)
  const empsRef   = useRef(employees)
  const zonesRef  = useRef(zones)
  const anchorsRef = useRef(anchors)
  const heatRef   = useRef(heatmapData)
  const showRawRef = useRef(showRaw)
  const showTriRef = useRef(showTrilateration) // false by default
  const animRef   = useRef(null)
  const pulseRef  = useRef(0)
  const renderedPosRef = useRef({})  // EMA-smoothed position
  const trailsRef = useRef({})       // vệt di chuyển

  useEffect(() => { empsRef.current   = employees },      [employees])
  useEffect(() => { zonesRef.current  = zones },          [zones])
  useEffect(() => { anchorsRef.current = anchors },       [anchors])
  useEffect(() => { heatRef.current   = heatmapData },    [heatmapData])
  useEffect(() => { showRawRef.current = showRaw },       [showRaw])
  useEffect(() => { showTriRef.current = showTrilateration }, [showTrilateration])

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
        ctx.lineWidth   = x % 5 === 0 ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, H); ctx.stroke()
      }
      for (let y = 0; y <= FLOOR_HEIGHT; y++) {
        ctx.strokeStyle = y % 5 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.02)'
        ctx.lineWidth   = y % 5 === 0 ? 1 : 0.5
        ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(W, y * sy); ctx.stroke()
      }

      /* ── Heatmap overlay ── */
      if (heatRef.current && heatRef.current.length > 0) {
        const counts = heatRef.current.map(d => d.count)
        const maxCount = Math.max(...counts)
        const blobR = sx * 2.2  // blob radius ~2.2m

        // Dùng 'lighter' để các blob chồng lên nhau tạo hiệu ứng glow
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'

        heatRef.current.forEach(({ x, y, count }) => {
          const intensity = Math.pow(count / maxCount, 0.6) // gamma để màu nhẹ hơn
          if (intensity < 0.05) return  // bỏ qua điểm quá mờ

          const cx = x * sx
          const cy = y * sy
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, blobR)
          grad.addColorStop(0,   `rgba(255, 40, 0, ${(intensity * 0.55).toFixed(2)})`)
          grad.addColorStop(0.4, `rgba(255, 120, 0, ${(intensity * 0.25).toFixed(2)})`)
          grad.addColorStop(1,   'rgba(255, 80, 0, 0)')

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(cx, cy, blobR, 0, Math.PI * 2)
          ctx.fill()
        })

        ctx.restore()
      }

      /* ── Zones ── */
      zonesRef.current.forEach(zone => {
        const polygon = zone.polygon || []
        if (polygon.length === 0) return
        const minX = Math.min(...polygon.map(p => p.x))
        const minY = Math.min(...polygon.map(p => p.y))
        const maxX = Math.max(...polygon.map(p => p.x))
        const maxY = Math.max(...polygon.map(p => p.y))
        const zx = minX * sx, zy = minY * sy
        const zw = (maxX - minX) * sx, zh = (maxY - minY) * sy
        const [r, g, b] = parseColor(zone.color)

        const grad = ctx.createLinearGradient(zx, zy, zx, zy + zh)
        grad.addColorStop(0, `rgba(${r},${g},${b},0.12)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`)
        ctx.fillStyle = grad
        ctx.fillRect(zx, zy, zw, zh)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`
        ctx.lineWidth = 1.5
        ctx.strokeRect(zx, zy, zw, zh)
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
        ctx.fillRect(zx, zy, zw, 32)
        ctx.fillStyle = `rgba(${r},${g},${b},1)`
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(zone.name, zx + zw / 2, zy + 14)
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
        ctx.font = '10px Inter, sans-serif'
        const tag = zone.id.split('_')[1]
        if (tag) ctx.fillText(`Zone ${tag.toUpperCase()}`, zx + zw / 2, zy + 27)
      })

      /* ── Gray Areas ── */
      GRAY_AREAS.forEach(({ label, x, y, w, h }) => {
        ctx.save()
        ctx.beginPath(); ctx.rect(x * sx, y * sy, w * sx, h * sy); ctx.clip()
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
        for (let i = -h; i < w + h; i += 1.5) {
          ctx.beginPath()
          ctx.moveTo((x + i) * sx, y * sy)
          ctx.lineTo((x + i - h) * sx, (y + h) * sy)
          ctx.stroke()
        }
        ctx.restore()
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x * sx, y * sy, w * sx, h * sy)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
        ctx.setLineDash([4, 3]); ctx.strokeRect(x * sx, y * sy, w * sx, h * sy); ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = 'bold 10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(label, (x + w / 2) * sx, (y + h / 2) * sy + 4)
      })

      /* ── Anchor Nodes ── */
      anchorsRef.current.filter(a => a.active !== false).forEach(anchor => {
        const ax = anchor.x * sx
        const ay = anchor.y * sy
        const size = 9

        // Vòng sáng xung quanh anchor
        ctx.beginPath()
        ctx.arc(ax, ay, 14 + 3 * Math.sin(p), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(251,191,36,${0.15 + 0.1 * Math.sin(p)})`
        ctx.lineWidth = 1; ctx.stroke()

        // Tam giác anchor
        ctx.beginPath()
        ctx.moveTo(ax, ay - size)
        ctx.lineTo(ax + size * 0.866, ay + size * 0.5)
        ctx.lineTo(ax - size * 0.866, ay + size * 0.5)
        ctx.closePath()
        ctx.fillStyle = 'rgba(251,191,36,0.85)'
        ctx.shadowColor = '#FBbf24'; ctx.shadowBlur = 10
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke()

        // Label
        ctx.fillStyle = 'rgba(251,191,36,0.9)'
        ctx.font = 'bold 9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(anchor.id, ax, ay + size + 12)
      })

      /* ── Trilateration Circles + Trails + Employees ── */
      Object.values(empsRef.current).forEach(emp => {
        if (emp.x == null) return

        // ── EMA smoothing ──
        if (!renderedPosRef.current[emp.tag_id]) {
          renderedPosRef.current[emp.tag_id] = { x: emp.x, y: emp.y }
        }
        const cur = renderedPosRef.current[emp.tag_id]
        const alpha = 0.08
        const rx = cur.x + (emp.x - cur.x) * alpha
        const ry = cur.y + (emp.y - cur.y) * alpha
        renderedPosRef.current[emp.tag_id] = { x: rx, y: ry }

        // ── Trail ──
        if (!trailsRef.current[emp.tag_id]) trailsRef.current[emp.tag_id] = []
        const trail = trailsRef.current[emp.tag_id]
        trail.push({ x: rx, y: ry })
        if (trail.length > 60) trail.shift()

        const color = emp.color || '#C084FC'
        const [r, g, b] = parseColor(color)
        const px = rx * sx, py = ry * sy

        // Vẽ trail
        if (trail.length > 1) {
          for (let i = 1; i < trail.length; i++) {
            const t  = trail[i], t0 = trail[i - 1]
            const a  = (i / trail.length) * 0.45
            ctx.beginPath()
            ctx.moveTo(t0.x * sx, t0.y * sy)
            ctx.lineTo(t.x * sx,  t.y * sy)
            ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(2)})`
            ctx.lineWidth = 1.5; ctx.stroke()
          }
        }

        // ── Vòng tròn Trilateration ──
        if (showTriRef.current && emp.anchor_distances) {
          emp.anchor_distances.forEach(ad => {
            const ax = ad.x * sx, ay = ad.y * sy
            const rad = ad.dist * sx
            // Đường thẳng anchor → vị trí ước lượng
            ctx.beginPath()
            ctx.moveTo(ax, ay); ctx.lineTo(px, py)
            ctx.strokeStyle = 'rgba(251,191,36,0.08)'; ctx.lineWidth = 0.5; ctx.stroke()
            // Vòng tròn bán kính
            ctx.beginPath()
            ctx.arc(ax, ay, rad, 0, Math.PI * 2)
            ctx.strokeStyle = 'rgba(251,191,36,0.12)'; ctx.lineWidth = 0.8; ctx.stroke()
          })
        }

        // ── Raw position dot (nếu bật) ──
        if (showRawRef.current && emp.x_raw != null) {
          const rxp = emp.x_raw * sx, ryp = emp.y_raw * sy
          ctx.beginPath(); ctx.arc(rxp, ryp, 4, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r},${g},${b},0.4)`; ctx.fill()
          ctx.strokeStyle = `rgba(255,255,255,0.3)`; ctx.lineWidth = 0.8; ctx.stroke()
        }

        // ── Outer glow rings ──
        ;[
          { radius: 22 + 6 * Math.sin(p),      alpha: 0.2 + 0.15 * Math.sin(p),      lw: 1.5 },
          { radius: 30 + 6 * Math.sin(p + 1),  alpha: 0.08 + 0.07 * Math.sin(p + 1), lw: 1   },
        ].forEach(({ radius, alpha, lw }) => {
          ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
          ctx.lineWidth = lw; ctx.stroke()
        })

        // ── Shadow glow ──
        ctx.shadowColor = color; ctx.shadowBlur = 20

        // ── Dot ──
        ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2)
        const dotGrad = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, 13)
        dotGrad.addColorStop(0, `rgba(${r},${g},${b},1)`)
        dotGrad.addColorStop(1, `rgba(${Math.max(r-40,0)},${Math.max(g-40,0)},${Math.max(b-40,0)},1)`)
        ctx.fillStyle = dotGrad; ctx.fill()
        ctx.shadowBlur = 0

        // ── White ring ──
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke()

        // ── ID label ──
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(emp.tag_id.replace('EMP_', ''), px, py + 3.5)

        // ── Name below ──
        const name = emp.name || emp.tag_id
        ctx.font = '500 9px Inter, sans-serif'
        ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
        ctx.fillText(name.split(' ').pop(), px, py + 29)
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
            <div className="section-sub">UWB · Trilateration · Kalman Filter</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Tri toggle */}
          <button
            onClick={() => showTriRef.current = !showTriRef.current}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
              color: '#FBbf24', padding: '3px 9px', borderRadius: 6, fontSize: 10,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
            }}
            title="Toggle vòng tròn Trilateration"
          >
            ◎ Tri
          </button>
          {/* Raw toggle */}
          <button
            onClick={() => showRawRef.current = !showRawRef.current}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 6, fontSize: 10,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
            }}
            title="Toggle vị trí Raw (trước Kalman Filter)"
          >
            · Raw
          </button>
          <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', padding: '3px 10px', borderRadius: 8 }}>
            {FLOOR_WIDTH}m × {FLOOR_HEIGHT}m
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} width={760} height={570} className="map-canvas" />

      <div className="map-footer">
        <div className="map-legend">
          {/* Anchor legend */}
          <div className="legend-item">
            <span style={{ display: 'inline-block', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '9px solid #FBbf24', marginRight: 4 }} />
            Anchor UWB
          </div>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)', margin: '0 2px' }} />
          {zones.map(z => (
            <div key={z.id} className="legend-item">
              <span className="legend-rect" style={{ background: z.color }} />
              {z.name}
            </div>
          ))}
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.06)', margin: '0 2px' }} />
          {Object.values(employees).map(emp => (
            <div key={emp.tag_id} className="legend-item">
              <span className="legend-dot" style={{ background: emp.color, boxShadow: `0 0 5px ${emp.color}` }} />
              {(emp.name || emp.tag_id).split(' ').pop()}
            </div>
          ))}
        </div>
        <span className="map-scale">1 ô = 1m</span>
      </div>
    </div>
  )
}

export default FloorMap
