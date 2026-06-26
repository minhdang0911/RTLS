import { AlertTriangle, User } from 'lucide-react'
import { EMPLOYEES } from '../utils/zoneColors'

const AlertPanel = ({ zoneEvents }) => {
  const alerts = zoneEvents
    .filter(e => e.type === 'ZONE_ENTER' && e.zone_id === 'zone_b_toilet')
    .slice(0, 5)

  if (alerts.length === 0) return null

  return (
    <div className="alert-panel">
      <div className="alert-icon-wrap">
        <AlertTriangle size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="alert-heading">
          ⚠ Cảnh báo — {alerts.length} sự kiện phát hiện
        </div>
        <div className="alert-tags">
          {alerts.map((alert, i) => {
            const info = EMPLOYEES[alert.tag_id]
            return (
              <span key={i} className="alert-tag">
                <User size={11} />
                {info?.name || alert.tag_id} vào Nhà vệ sinh
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AlertPanel
