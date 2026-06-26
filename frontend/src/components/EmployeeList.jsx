import { LogIn, LogOut, Clock, Inbox } from 'lucide-react'
import { EMPLOYEES, getZoneById } from '../utils/zoneColors'

const formatDuration = (seconds) => {
  if (!seconds) return null
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const EmployeeCard = ({ emp }) => {
  const info = EMPLOYEES[emp.tag_id]
  const zone = getZoneById(emp.zone_id)

  return (
    <div
      className="emp-card"
      style={{ borderLeftColor: info?.color || '#333' }}
    >
      <div
        className="emp-avatar"
        style={{
          background: (info?.color || '#555') + '1A',
          border: `1.5px solid ${(info?.color || '#555')}44`,
          color: info?.color || '#888',
        }}
      >
        {emp.tag_id.replace('EMP_', '')}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="emp-name">{info?.name || emp.tag_id}</div>
        <div className="emp-zone">
          <span
            className="zone-dot"
            style={{
              background: zone ? zone.color : '#374151',
              boxShadow: zone ? `0 0 5px ${zone.color}88` : 'none',
            }}
          />
          <span style={{ color: zone ? zone.color : '#4A5568' }}>
            {zone ? zone.name : 'Ngoai zone'}
          </span>
        </div>
      </div>

      <div className="emp-coords">
        {emp.x?.toFixed(1)}, {emp.y?.toFixed(1)}
      </div>
    </div>
  )
}

const ActivityItem = ({ event }) => {
  const info = EMPLOYEES[event.tag_id]
  const zone = getZoneById(event.zone_id)
  const isEnter = event.type === 'ZONE_ENTER'
  const duration = formatDuration(event.duration_seconds)

  return (
    <div className="activity-item">
      <div className={`activity-icon ${isEnter ? 'activity-icon-enter' : 'activity-icon-exit'}`}>
        {isEnter
          ? <LogIn size={13} />
          : <LogOut size={13} />
        }
      </div>

      <div className="activity-info">
        <div className="activity-name">{info?.name || event.tag_id}</div>
        <div className="activity-zone" style={{ color: zone?.color || '#4A5568' }}>
          {zone?.name || event.zone_id}
        </div>
      </div>

      <div className="activity-meta">
        <div className={isEnter ? 'activity-type-enter' : 'activity-type-exit'}>
          {isEnter ? 'Vao' : 'Ra'}
        </div>
        {duration && (
          <div className="activity-duration" style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
            <Clock size={9} />
            {duration}
          </div>
        )}
      </div>
    </div>
  )
}

const EmployeeList = ({ employees, zoneEvents }) => {
  const empList = Object.values(employees)

  return (
    <>
      {/* Employee cards */}
      <div className="card">
        <div className="card-header">
          <span className="section-label">Nhan vien</span>
          <span className="count-badge">{empList.length}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {empList.length === 0 ? (
            <div className="empty-state">
              <Inbox size={20} color="#374151" />
              Dang ket noi...
            </div>
          ) : (
            empList.map(emp => <EmployeeCard key={emp.tag_id} emp={emp} />)
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="card-header">
          <span className="section-label">Hoat dong gan day</span>
          {zoneEvents.length > 0 && (
            <span className="count-badge">{zoneEvents.length}</span>
          )}
        </div>
        <div className="card-body">
          {zoneEvents.length === 0 ? (
            <div className="empty-state">
              <Inbox size={20} color="#374151" />
              Chua co hoat dong
            </div>
          ) : (
            <div className="activity-list">
              {zoneEvents.map((event, i) => (
                <ActivityItem key={i} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default EmployeeList
