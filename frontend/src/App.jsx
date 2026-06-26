import { Users, MapPin, AlertTriangle, Radio } from 'lucide-react'
import FloorMap from './components/FloorMap'
import EmployeeList from './components/EmployeeList'
import AlertPanel from './components/AlertPanel'
import useWebSocket from './hooks/useWebSocket'
import './App.css'

function App() {
  const { employees, zoneEvents } = useWebSocket('ws://localhost:3002')

  const empList = Object.values(employees)
  const activeZones = new Set(empList.map(e => e.zone_id).filter(Boolean)).size
  const alertCount = zoneEvents.filter(
    e => e.type === 'ZONE_ENTER' && e.zone_id === 'zone_b_toilet'
  ).length

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">
            <Radio size={17} color="#388BFD" />
          </div>
          <div>
            <div className="brand-title">iKY RTLS Dashboard</div>
            <div className="brand-sub">He thong dinh vi thoi gian thuc — UWB Demo</div>
          </div>
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          <span>Live</span>
        </div>
      </header>

      {/* Stats row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <Users size={19} />
          </div>
          <div>
            <div className="stat-value stat-value-blue">{empList.length}</div>
            <div className="stat-label">Nhan vien theo doi</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <MapPin size={19} />
          </div>
          <div>
            <div className="stat-value stat-value-green">{activeZones}</div>
            <div className="stat-label">Zone dang co nguoi</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-amber">
            <AlertTriangle size={19} />
          </div>
          <div>
            <div className="stat-value stat-value-amber">{alertCount}</div>
            <div className="stat-label">Canh bao gan day</div>
          </div>
        </div>
      </div>

      <AlertPanel zoneEvents={zoneEvents} />

      {/* Main content */}
      <div className="main-grid">
        <FloorMap employees={employees} />
        <div className="sidebar">
          <EmployeeList employees={employees} zoneEvents={zoneEvents} />
        </div>
      </div>
    </div>
  )
}

export default App
