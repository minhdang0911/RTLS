import { useState, useEffect } from 'react'
import { BarChart2, Download, RefreshCw, Clock, Users, MapPin } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003'

const fmtDuration = (s) => {
  if (!s) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return m > 0 ? `${m}p ${sec}s` : `${sec}s`
}

const AnalyticsPanel = ({ zones = [], employees = {} }) => {
  const [zoneSummary,  setZoneSummary]  = useState([])
  const [heatmapData,  setHeatmapData]  = useState(null)
  const [attendance,   setAttendance]   = useState([])
  const [loading,      setLoading]      = useState(false)
  const [activeTab,    setActiveTab]    = useState('zones') // 'zones' | 'attendance' | 'heatmap'
  const [hoursBack,    setHoursBack]    = useState(24)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sumRes, heatRes, attRes] = await Promise.all([
        fetch(`${API}/api/analytics/zone-summary`).then(r => r.json()),
        fetch(`${API}/api/analytics/heatmap?hours=${hoursBack}`).then(r => r.json()),
        fetch(`${API}/api/attendance`).then(r => r.json())
      ])
      setZoneSummary(sumRes)
      setHeatmapData(heatRes)
      setAttendance(attRes)
    } catch (e) {
      console.error('Analytics fetch error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [hoursBack])

  const handleExportCSV = () => {
    window.open(`${API}/api/analytics/export/csv?hours=${hoursBack}`, '_blank')
  }

  // Tính max visit_count để normalize bar chart
  const maxVisit = Math.max(...zoneSummary.map(z => z.visit_count || 0), 1)

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-icon" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8B5CF6' }}>
            <BarChart2 size={13} />
          </div>
          <div>
            <div className="section-label">Phân tích</div>
            <div className="section-sub">{hoursBack}h gần nhất</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={hoursBack}
            onChange={e => setHoursBack(Number(e.target.value))}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
          >
            <option value={1}>1 giờ</option>
            <option value={8}>8 giờ</option>
            <option value={24}>24 giờ</option>
          </select>
          <button onClick={fetchAll} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--green)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {[['zones', 'Zone Stats'], ['attendance', 'Chấm công']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, background: 'transparent',
              border: 'none', borderBottom: activeTab === key ? '2px solid var(--purple)' : '2px solid transparent',
              padding: '10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              color: activeTab === key ? '#8B5CF6' : 'var(--text-secondary)',
              transition: 'all 0.15s'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card-body" style={{ padding: '12px 16px' }}>

        {/* ── Zone Stats Tab ── */}
        {activeTab === 'zones' && (
          <div>
            {zoneSummary.length === 0 && !loading && (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <BarChart2 size={20} color="#374151" />
                Chưa có dữ liệu zone events
              </div>
            )}
            {zoneSummary.map(z => {
              const zone = zones.find(zn => zn.id === z.zone_id)
              const color = zone?.color || '#888'
              const barW = Math.max(4, (z.visit_count / maxVisit) * 100)
              return (
                <div key={z.zone_id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{z.zone_name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{z.visit_count} lượt</span>
                  </div>
                  {/* Bar */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 6, marginBottom: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease', opacity: 0.8 }} />
                  </div>
                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={9} /> TB: {fmtDuration(z.avg_duration_s)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={9} /> Max: {fmtDuration(z.max_duration_s)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Users size={9} /> {z.unique_employees} NV
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Attendance Tab ── */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              📅 Hôm nay — {new Date().toLocaleDateString('vi-VN')}
            </div>
            {attendance.length === 0 && !loading && (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <Users size={20} color="#374151" />
                Chưa có dữ liệu chấm công hôm nay
              </div>
            )}
            {attendance.map(rec => {
              const totalMin = Math.floor((rec.total_active_seconds || 0) / 60)
              const firstTime = rec.first_seen ? new Date(rec.first_seen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'
              const lastTime  = rec.last_seen  ? new Date(rec.last_seen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'
              return (
                <div key={rec.tag_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: (rec.color || '#888') + '22', border: `1.5px solid ${rec.color || '#888'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: rec.color || '#888', flexShrink: 0 }}>
                    {rec.tag_id.replace('EMP_', '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{rec.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                      <span>Vào: {firstTime}</span>
                      <span>Ra: {lastTime}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{totalMin}p</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>hoạt động</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default AnalyticsPanel
