import { LogIn, LogOut, Clock, Inbox, MapPin } from 'lucide-react'

const formatDuration = (seconds) => {
  if (!seconds) return null
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const EmployeeCard = ({ emp, zone }) => {
  const name = emp.name || emp.tag_id
  const color = emp.color || '#888888'

  return (
    <div className="emp-card" style={{ borderLeftColor: color }}>
      <div
        className="emp-avatar"
        style={{
          background: color + '1A',
          border: `1.5px solid ${color}44`,
          color: color,
        }}
      >
        {emp.tag_id.replace('EMP_', '')}
      </div>

      <div className="emp-info">
        <div className="emp-name">{name}</div>
        <div className="emp-zone">
          <span
            className="zone-dot"
            style={{
              background: zone ? zone.color : '#374151',
              boxShadow: zone ? `0 0 5px ${zone.color}88` : 'none',
            }}
          />
          <span style={{ color: zone ? zone.color : '#4A5568', fontSize: 11 }}>
            {zone ? zone.name : 'Ngoài zone'}
          </span>
        </div>
      </div>

      <div className="emp-coords">
        <div>{emp.x?.toFixed(1)}m</div>
        <div>{emp.y?.toFixed(1)}m</div>
      </div>
    </div>
  )
}

const ActivityItem = ({ event, zone, employees = {} }) => {
  const info = employees[event.tag_id]
  const isEnter = event.type === 'ZONE_ENTER'
  const duration = formatDuration(event.duration_seconds)

  return (
    <div className="activity-item">
      <div className={`activity-icon ${isEnter ? 'activity-icon-enter' : 'activity-icon-exit'}`}>
        {isEnter ? <LogIn size={13} /> : <LogOut size={13} />}
      </div>

      <div className="activity-info">
        <div className="activity-name">{info?.name || event.tag_id}</div>
        <div className="activity-zone" style={{ color: zone?.color || '#4A5568' }}>
          <MapPin size={9} style={{ display: 'inline', marginRight: 3 }} />
          {zone?.name || event.zone_id}
        </div>
      </div>

      <div className="activity-meta">
        <div className={isEnter ? 'activity-type-enter' : 'activity-type-exit'}>
          {isEnter ? 'Vào' : 'Ra'}
        </div>
        {duration && (
          <div className="activity-duration">
            <Clock size={9} />
            {duration}
          </div>
        )}
      </div>
    </div>
  )
}

const EmployeeList = ({ employees, zoneEvents, zones = [] }) => {
  const empList = Object.values(employees)
  const findZoneById = (id) => zones.find(z => z.id === id)

  return (
    <>
      {/* Employee cards */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-icon" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <div className="section-label">Nhân viên</div>
              <div className="section-sub">Đang theo dõi</div>
            </div>
          </div>
          <span className="count-badge">{empList.length}</span>
        </div>
        <div className="card-body">
          {empList.length === 0 ? (
            <div className="empty-state">
              <Inbox size={20} color="#374151" />
              Đang kết nối...
            </div>
          ) : (
            <div className="emp-list">
              {empList.map(emp => (
                <EmployeeCard 
                  key={emp.tag_id} 
                  emp={emp} 
                  zone={findZoneById(emp.zone_id)} 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-left">
            <div className="card-icon" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div className="section-label">Hoạt động gần đây</div>
              <div className="section-sub">Zone events</div>
            </div>
          </div>
          {zoneEvents.length > 0 && (
            <span className="count-badge">{zoneEvents.length}</span>
          )}
        </div>
        <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
          {zoneEvents.length === 0 ? (
            <div className="empty-state">
              <Inbox size={20} color="#374151" />
              Chưa có hoạt động
            </div>
          ) : (
            <div className="activity-list">
              {zoneEvents.map((event, i) => (
                <ActivityItem 
                  key={i} 
                  event={event} 
                  zone={findZoneById(event.zone_id)} 
                  employees={employees}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default EmployeeList
