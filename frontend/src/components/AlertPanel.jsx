import { AlertTriangle, ShieldAlert, User } from 'lucide-react'

const AlertPanel = ({ alerts = {}, unauthorized = {}, employees = {} }) => {
  const alertList = Object.values(alerts)
  const unauthList = Object.values(unauthorized)

  if (alertList.length === 0 && unauthList.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Cảnh báo ở lâu quá giờ */}
      {alertList.length > 0 && (
        <div className="alert-panel">
          <div className="alert-icon-wrap">
            <AlertTriangle size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="alert-heading">
              ⚠ Cảnh báo — {alertList.length} nhân viên ở lại quá lâu
            </div>
            <div className="alert-tags">
              {alertList.map((alert, i) => {
                const empInfo = employees[alert.tag_id]
                const minutes = Math.floor(alert.alert_threshold_seconds / 60)
                const secs    = alert.alert_threshold_seconds % 60
                const timeStr = minutes > 0 ? `${minutes}p${secs > 0 ? ` ${secs}s` : ''}` : `${secs}s`
                return (
                  <span key={i} className="alert-tag">
                    <User size={11} />
                    {empInfo?.name || alert.tag_id} ở lại {alert.zone_name} quá {timeStr}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo vi phạm phân quyền */}
      {unauthList.length > 0 && (
        <div className="alert-panel alert-panel-red">
          <div className="alert-icon-wrap alert-icon-red">
            <ShieldAlert size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="alert-heading alert-heading-red">
              🚫 VI PHẠM — {unauthList.length} nhân viên vào vùng cấm
            </div>
            <div className="alert-tags">
              {unauthList.map((item, i) => {
                const empInfo = employees[item.tag_id]
                return (
                  <span key={i} className="alert-tag alert-tag-red">
                    <ShieldAlert size={11} />
                    {empInfo?.name || item.tag_id} vào {item.zone_name}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlertPanel
