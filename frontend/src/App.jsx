import { useState, useEffect } from 'react'
import { Users, MapPin, AlertTriangle, Radio, Clock, Activity, Wifi } from 'lucide-react'
import FloorMap from './components/FloorMap'
import EmployeeList from './components/EmployeeList'
import AlertPanel from './components/AlertPanel'
import useWebSocket from './hooks/useWebSocket'
import './App.css'

function LiveTime() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="header-time">
      {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

function App() {
  const { employees, zoneEvents } = useWebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3002')

  const empList       = Object.values(employees)
  const activeZones   = new Set(empList.map(e => e.zone_id).filter(Boolean)).size
  const alertCount    = zoneEvents.filter(e => e.type === 'ZONE_ENTER' && e.zone_id === 'zone_b_toilet').length
  const recentEvents  = zoneEvents.length

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="brand-icon">
            <Radio size={18} color="#3B82F6" />
          </div>
          <div>
            <div className="brand-title">iKY RTLS Dashboard</div>
            <div className="brand-sub">Hệ thống định vị thời gian thực — UWB Demo</div>
          </div>
        </div>

        <div className="header-right">
          <LiveTime />
          <div className="live-badge">
            <span className="live-dot" />
            <span>Live</span>
          </div>
        </div>
      </header>

      <div className="body-wrap">
        {/* ── Stats ── */}
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-icon stat-icon-blue">
              <Users size={20} />
            </div>
            <div className="stat-body">
              <div className="stat-value stat-value-blue">{empList.length}</div>
              <div className="stat-label">Nhân viên theo dõi</div>
            </div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-icon stat-icon-green">
              <MapPin size={20} />
            </div>
            <div className="stat-body">
              <div className="stat-value stat-value-green">{activeZones}</div>
              <div className="stat-label">Zone đang có người</div>
            </div>
          </div>

          <div className="stat-card stat-card-amber">
            <div className="stat-icon stat-icon-amber">
              <AlertTriangle size={20} />
            </div>
            <div className="stat-body">
              <div className="stat-value stat-value-amber">{alertCount}</div>
              <div className="stat-label">Cảnh báo gần đây</div>
            </div>
          </div>

          <div className="stat-card stat-card-purple">
            <div className="stat-icon stat-icon-purple">
              <Activity size={20} />
            </div>
            <div className="stat-body">
              <div className="stat-value stat-value-purple">{recentEvents}</div>
              <div className="stat-label">Sự kiện zone</div>
            </div>
          </div>
        </div>

        {/* ── Alert Panel ── */}
        <AlertPanel zoneEvents={zoneEvents} />

        {/* ── Main ── */}
        <div className="main-grid">
          <FloorMap employees={employees} />
          <div className="sidebar">
            <EmployeeList employees={employees} zoneEvents={zoneEvents} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
