import { useState, useEffect } from 'react'
import { Users, MapPin, AlertTriangle, Radio, Activity, Wifi, WifiOff, Settings, X, BarChart2, Thermometer } from 'lucide-react'
import FloorMap from './components/FloorMap'
import EmployeeList from './components/EmployeeList'
import AlertPanel from './components/AlertPanel'
import AnalyticsPanel from './components/AnalyticsPanel'
import ReplayPanel from './components/ReplayPanel'
import { ToastContainer, ConfirmDialog, useToast } from './components/Toast'
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
  const { employees, zoneEvents, zones, anchors, alerts, unauthorized, wsStatus } =
    useWebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3003')

  const { toasts, toast, removeToast, dialog, confirm, handleResolve } = useToast()

  const empList     = Object.values(employees)
  const activeZones = new Set(empList.map(e => e.zone_id).filter(Boolean)).size
  const alertCount  = Object.keys(alerts || {}).length + Object.keys(unauthorized || {}).length
  const recentEvents = zoneEvents.length

  // ── Settings Modal ──
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab,      setActiveTab]      = useState('zones')

  // ── Sidebar tab ──
  const [sidebarTab, setSidebarTab] = useState('list') // 'list' | 'analytics' | 'heatmap'

  // ── Map display toggles (ẩn trong FloorMap card, không ra header) ──
  const [showRaw,     setShowRaw]     = useState(false)
  const [showTri,     setShowTri]     = useState(false)   // OFF mặc định, bật khi cần demo
  const [heatmapData, setHeatmapData] = useState(null)

  // ── Replay ──
  const [replayEmployees, setReplayEmployees] = useState(null) // override employees when replaying

  // Form: Thêm nhân viên
  const [newTagId,  setNewTagId]  = useState('')
  const [newName,   setNewName]   = useState('')
  const [newColor,  setNewColor]  = useState('#E91E63')

  // Form: Zone thresholds
  const [editingThresholds, setEditingThresholds] = useState({})

  // Form: Inline edit employees
  const [editingNames,  setEditingNames]  = useState({})
  const [editingColors, setEditingColors] = useState({})

  // Zone access control state
  const [zoneAccessRules, setZoneAccessRules] = useState({}) // zone_id → [rules]

  useEffect(() => {
    if (zones && zones.length > 0) {
      const thresholds = {}
      zones.forEach(z => {
        thresholds[z.id] = z.alert_threshold_seconds === null ? '' : z.alert_threshold_seconds
      })
      setEditingThresholds(thresholds)
    }
  }, [zones])

  // Fetch heatmap data khi chọn tab heatmap
  useEffect(() => {
    if (sidebarTab === 'heatmap') {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/analytics/heatmap?hours=8`)
        .then(r => r.json())
        .then(data => setHeatmapData(data))
        .catch(() => {})
    } else {
      setHeatmapData(null)
    }
  }, [sidebarTab])

  const handleUpdateZone = async (zoneId) => {
    try {
      const val = editingThresholds[zoneId]
      const alert_threshold_seconds = val === '' || isNaN(val) ? null : parseInt(val, 10)
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/zones/${zoneId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_threshold_seconds })
      })
      if (res.ok) {
        toast('Cập nhật ngưỡng cảnh báo thành công!', { type: 'success', title: 'Zone đã lưu' })
      } else {
        const e = await res.json()
        toast(`Lỗi: ${e.error}`, { type: 'error', title: 'Không thể cập nhật' })
      }
    } catch (e) {
      toast(`Lỗi kết nối: ${e.message}`, { type: 'error' })
    }
  }

  const handleAddEmployee = async (e) => {
    e.preventDefault()
    if (!newTagId.trim() || !newName.trim()) {
      toast('Vui lòng điền đầy đủ mã tag và tên!', { type: 'warning' })
      return
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/employees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: newTagId.trim(), name: newName.trim(), color: newColor })
      })
      if (res.ok) {
        toast(`Đã thêm nhân viên ${newName.trim()}`, { type: 'success', title: 'Thêm thành công' })
        setNewTagId(''); setNewName('')
      } else {
        const err = await res.json()
        toast(`Lỗi: ${err.error}`, { type: 'error', title: 'Không thể thêm' })
      }
    } catch (e) { toast(`Lỗi kết nối: ${e.message}`, { type: 'error' }) }
  }

  const handleUpdateEmployee = async (tag_id) => {
    try {
      const name  = editingNames[tag_id]  !== undefined ? editingNames[tag_id]  : employees[tag_id].name
      const color = editingColors[tag_id] !== undefined ? editingColors[tag_id] : employees[tag_id].color
      if (!name.trim()) { toast('Họ tên không được để trống!', { type: 'warning' }); return }
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/employees/${tag_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color })
      })
      if (res.ok) {
        // Xoá editing state để list hiển thị giá trị mới từ WS
        setEditingNames(prev  => { const n = { ...prev  }; delete n[tag_id]; return n })
        setEditingColors(prev => { const n = { ...prev }; delete n[tag_id]; return n })
        toast(`Đã cập nhật nhân viên ${name.trim()}`, { type: 'success', title: 'Lưu thành công' })
      } else {
        const e = await res.json()
        toast(`Lỗi: ${e.error}`, { type: 'error', title: 'Không thể cập nhật' })
      }
    } catch (e) { toast(`Lỗi kết nối: ${e.message}`, { type: 'error' }) }
  }

  const handleDeleteEmployee = async (tag_id) => {
    const empName = employees[tag_id]?.name || tag_id
    const ok = await confirm({
      title: 'Xóa nhân viên',
      message: `Bạn có chắc muốn xóa "${empName}" (${tag_id}) khỏi hệ thống? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa'
    })
    if (!ok) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/employees/${tag_id}`, { method: 'DELETE' })
      if (res.ok) {
        // Xoá editing state của nhân viên này
        setEditingNames(prev  => { const n = { ...prev  }; delete n[tag_id]; return n })
        setEditingColors(prev => { const n = { ...prev }; delete n[tag_id]; return n })
        toast(`Đã xóa nhân viên ${empName}`, { type: 'info', title: 'Xóa thành công' })
      } else {
        const e = await res.json()
        toast(`Lỗi: ${e.error}`, { type: 'error', title: 'Không thể xóa' })
      }
    } catch (e) { toast(`Lỗi kết nối: ${e.message}`, { type: 'error' }) }
  }

  const handleSetAccessRule = async (zone_id, tag_id, allowed) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3003'}/api/zones/${zone_id}/access`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id, allowed })
      })
      const empName = employees[tag_id]?.name || tag_id
      toast(
        allowed ? `${empName} có thể vào ${zone_id}` : `${empName} bị cấm vào ${zone_id}`,
        { type: allowed ? 'success' : 'warning', title: 'Phân quyền Zone' }
      )
    } catch (e) { toast(`Lỗi: ${e.message}`, { type: 'error' }) }
  }

  // Employees hiển thị trên map (realtime hoặc replay)
  const displayEmployees = replayEmployees || employees

  // WS status color
  const wsColor = wsStatus === 'connected' ? '#22C55E' : wsStatus === 'connecting' ? '#F59E0B' : '#EF4444'
  const WsIcon  = wsStatus === 'connected' ? Wifi : WifiOff

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
            <div className="brand-sub">UWB · Trilateration · Kalman Filter · Zone Analytics</div>
          </div>
        </div>

        <div className="header-right">
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={15} /><span>Cấu hình</span>
          </button>
          <LiveTime />
          <div className="live-badge" style={{ borderColor: `${wsColor}44`, background: `${wsColor}11`, color: wsColor }}>
            <WsIcon size={12} />
            <span>{wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Kết nối...' : 'Ngắt'}</span>
          </div>
        </div>
      </header>

      <div className="body-wrap">
        {/* ── Stats ── */}
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-icon stat-icon-blue"><Users size={20} /></div>
            <div className="stat-body">
              <div className="stat-value stat-value-blue">{empList.length}</div>
              <div className="stat-label">Nhân viên theo dõi</div>
            </div>
          </div>
          <div className="stat-card stat-card-green">
            <div className="stat-icon stat-icon-green"><MapPin size={20} /></div>
            <div className="stat-body">
              <div className="stat-value stat-value-green">{activeZones}</div>
              <div className="stat-label">Zone đang có người</div>
            </div>
          </div>
          <div className="stat-card stat-card-amber">
            <div className="stat-icon stat-icon-amber"><AlertTriangle size={20} /></div>
            <div className="stat-body">
              <div className="stat-value stat-value-amber">{alertCount}</div>
              <div className="stat-label">Cảnh báo đang kích hoạt</div>
            </div>
          </div>
          <div className="stat-card stat-card-purple">
            <div className="stat-icon stat-icon-purple"><Activity size={20} /></div>
            <div className="stat-body">
              <div className="stat-value stat-value-purple">{recentEvents}</div>
              <div className="stat-label">Sự kiện zone</div>
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        <AlertPanel alerts={alerts} unauthorized={unauthorized} employees={employees} />

        {/* ── Replay Panel ── */}
        <ReplayPanel
          onReplayFrame={(frame) => {
            setReplayEmployees(prev => ({
              ...(prev || employees),
              [frame.tag_id]: {
                ...(employees[frame.tag_id] || { tag_id: frame.tag_id, name: frame.tag_id, color: '#888' }),
                x: frame.x, y: frame.y, zone_id: frame.zone_id
              }
            }))
          }}
          onReplayEnd={() => setReplayEmployees(null)}
        />

        {/* ── Main ── */}
        <div className="main-grid">
          <FloorMap
            employees={displayEmployees}
            zones={zones}
            anchors={anchors}
            heatmapData={sidebarTab === 'heatmap' ? heatmapData : null}
            showRaw={showRaw}
            showTrilateration={showTri}
          />

          <div className="sidebar">
            {/* Sidebar tabs */}
            <div className="sidebar-tabs">
              <button className={`sidebar-tab ${sidebarTab === 'list' ? 'active' : ''}`} onClick={() => setSidebarTab('list')}>
                <Users size={12} /> Nhân viên
              </button>
              <button className={`sidebar-tab ${sidebarTab === 'analytics' ? 'active' : ''}`} onClick={() => setSidebarTab('analytics')}>
                <Activity size={12} /> Phân tích
              </button>
              <button className={`sidebar-tab ${sidebarTab === 'heatmap' ? 'active-heat' : ''}`} onClick={() => setSidebarTab('heatmap')}>
                <Thermometer size={12} /> Heatmap
              </button>
            </div>

            {sidebarTab === 'list' && (
              <EmployeeList employees={displayEmployees} zoneEvents={zoneEvents} zones={zones} />
            )}
            {sidebarTab === 'analytics' && (
              <AnalyticsPanel zones={zones} employees={employees} />
            )}
            {sidebarTab === 'heatmap' && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Thermometer size={16} color="#F59E0B" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Heatmap — 8 giờ gần nhất</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Bản đồ nhiệt hiển thị mức độ hoạt động trên từng ô 1m² trong 8 giờ qua.
                  Màu đỏ đậm = khu vực được đi qua nhiều nhất.
                </p>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ height: 8, flex: 1, borderRadius: 4, background: 'linear-gradient(to right, transparent, rgba(255,50,0,0.8))' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ít → Nhiều</span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                  Overlay đang hiển thị trực tiếp trên bản đồ bên trái.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings Modal ── */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Settings size={18} color="#3B82F6" />
                <span>Bảng cấu hình hệ thống</span>
              </div>
              <button className="modal-close" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-tabs">
              {[['zones', 'Cấu hình Zone'], ['employees', 'Nhân viên'], ['access', 'Phân quyền Zone']].map(([key, label]) => (
                <button
                  key={key}
                  className={`modal-tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {/* Tab: Zone config */}
              {activeTab === 'zones' && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Thay đổi ngưỡng cảnh báo (giây) cho từng khu vực. Để trống = không giới hạn.
                  </p>
                  {zones.map(zone => (
                    <div key={zone.id} className="form-row-zone">
                      <div className="zone-info-meta">
                        <span className="zone-info-name" style={{ color: zone.color }}>{zone.name}</span>
                        <span className="zone-info-id">{zone.id}</span>
                      </div>
                      <div className="zone-action-row">
                        <input
                          type="number" placeholder="Không giới hạn"
                          className="form-input input-number-small"
                          value={editingThresholds[zone.id] ?? ''}
                          onChange={e => setEditingThresholds({ ...editingThresholds, [zone.id]: e.target.value })}
                        />
                        <button className="btn-update-small" onClick={() => handleUpdateZone(zone.id)}>Cập nhật</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Employees */}
              {activeTab === 'employees' && (
                <div>
                  <form onSubmit={handleAddEmployee} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 20 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--blue)' }}>Thêm nhân viên mới</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <label className="form-label">Mã thẻ Tag ID</label>
                        <input type="text" className="form-input" placeholder="EMP_004" value={newTagId} onChange={e => setNewTagId(e.target.value)} required />
                      </div>
                      <div>
                        <label className="form-label">Họ và tên</label>
                        <input type="text" className="form-input" placeholder="Nguyễn Văn D" value={newName} onChange={e => setNewName(e.target.value)} required />
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Màu hiển thị</label>
                      <div className="color-picker-wrap">
                        <input type="color" className="color-input-picker" style={{ width: 34, height: 34 }} value={newColor} onChange={e => setNewColor(e.target.value)} />
                        <input type="text" className="form-input" style={{ width: 120, fontFamily: 'monospace', padding: '6px 10px' }} value={newColor} onChange={e => setNewColor(e.target.value)} />
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: newColor, boxShadow: `0 0 8px ${newColor}` }} />
                      </div>
                    </div>
                    <button type="submit" className="btn-submit-block" style={{ padding: '8px 12px', fontSize: 13, marginTop: 0 }}>
                      Thêm nhân viên
                    </button>
                  </form>

                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Danh sách nhân viên</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.values(employees).map(emp => (
                      <div key={emp.tag_id} className="form-row-zone" style={{ gap: 8, padding: '4px 0' }}>
                        <div style={{ flex: '0 0 65px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'bold' }}>{emp.tag_id}</div>
                        <input
                          type="text" className="form-input" style={{ flex: 1, padding: '5px 10px', fontSize: 12 }}
                          value={editingNames[emp.tag_id] ?? emp.name}
                          onChange={e => setEditingNames({ ...editingNames, [emp.tag_id]: e.target.value })}
                        />
                        <input type="color" style={{ width: 26, height: 26, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                          value={editingColors[emp.tag_id] ?? emp.color}
                          onChange={e => setEditingColors({ ...editingColors, [emp.tag_id]: e.target.value })}
                        />
                        <button type="button" className="btn-update-small" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => handleUpdateEmployee(emp.tag_id)}>Lưu</button>
                        <button type="button" className="btn-update-small" style={{ padding: '5px 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.15)', color: 'var(--red)' }} onClick={() => handleDeleteEmployee(emp.tag_id)}>Xóa</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Zone Access Control */}
              {activeTab === 'access' && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Cài đặt nhân viên nào bị <strong style={{ color: 'var(--red)' }}>cấm</strong> vào từng zone. Khi vi phạm sẽ gửi cảnh báo đỏ.
                  </p>
                  {zones.map(zone => (
                    <div key={zone.id} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: zone.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: zone.color }}>{zone.name}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18 }}>
                        {Object.values(employees).map(emp => (
                          <div key={emp.tag_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <span style={{ color: emp.color, fontWeight: 600 }}>{emp.tag_id}</span> — {emp.name}
                            </span>
                            <button
                              onClick={() => handleSetAccessRule(zone.id, emp.tag_id, false)}
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Cấm vào
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Custom Confirm Dialog ── */}
      <ConfirmDialog dialog={dialog} onResolve={handleResolve} />
    </div>
  )
}

export default App
