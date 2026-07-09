import { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003'
const WS_URL_DEFAULT = 'ws://localhost:3003'

const useWebSocket = (url) => {
  const [employees,    setEmployees]    = useState({})
  const [zoneEvents,   setZoneEvents]   = useState([])
  const [zones,        setZones]        = useState([])
  const [anchors,      setAnchors]      = useState([])
  const [alerts,       setAlerts]       = useState({})
  const [unauthorized, setUnauthorized] = useState({}) // tag_id → event
  const [wsStatus,     setWsStatus]     = useState('connecting') // 'connecting'|'connected'|'disconnected'
  const ws = useRef(null)

  // ── Tải dữ liệu ban đầu ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/employees`)
      .then(r => r.json())
      .then(data => {
        const empMap = {}
        data.forEach(emp => {
          empMap[emp.tag_id] = { tag_id: emp.tag_id, name: emp.name, color: emp.color, x: 0, y: 0, zone_id: null }
        })
        setEmployees(empMap)
      })
      .catch(err => console.error('Fetch employees error:', err))
  }, [])

  useEffect(() => {
    fetch(`${API}/api/zones`)
      .then(r => r.json())
      .then(data => setZones(data))
      .catch(err => console.error('Fetch zones error:', err))
  }, [])

  useEffect(() => {
    fetch(`${API}/api/zone-events`)
      .then(r => r.json())
      .then(data => setZoneEvents(data))
      .catch(err => console.error('Fetch zone events error:', err))
  }, [])

  useEffect(() => {
    fetch(`${API}/api/anchors`)
      .then(r => r.json())
      .then(data => setAnchors(data))
      .catch(err => console.error('Fetch anchors error:', err))
  }, [])

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      setWsStatus('connecting')
      ws.current = new WebSocket(url || WS_URL_DEFAULT)

      ws.current.onopen = () => {
        console.log('[WS] Connected')
        setWsStatus('connected')
      }

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'LOCATION_UPDATE') {
          setEmployees(prev => {
            const existing = prev[data.tag_id] || { tag_id: data.tag_id, name: `Tag ${data.tag_id}`, color: '#888' }
            return {
              ...prev,
              [data.tag_id]: {
                ...existing,
                x:                data.x,
                y:                data.y,
                x_raw:            data.x_raw,
                y_raw:            data.y_raw,
                zone_id:          data.zone_id,
                anchor_distances: data.anchor_distances
              }
            }
          })
        }

        if (data.type === 'ZONE_ENTER' || data.type === 'ZONE_EXIT') {
          setZoneEvents(prev => [data, ...prev].slice(0, 30))
        }

        if (data.type === 'ZONE_UPDATED') {
          setZones(prev => prev.map(z => z.id === data.zone.id ? data.zone : z))
        }

        if (data.type === 'EMPLOYEE_ADDED') {
          setEmployees(prev => ({
            ...prev,
            [data.employee.tag_id]: {
              tag_id: data.employee.tag_id, name: data.employee.name,
              color: data.employee.color, x: 0, y: 0, zone_id: null
            }
          }))
        }

        if (data.type === 'EMPLOYEE_UPDATED') {
          setEmployees(prev => {
            const ex = prev[data.employee.tag_id] || {}
            return { ...prev, [data.employee.tag_id]: { ...ex, ...data.employee } }
          })
        }

        if (data.type === 'EMPLOYEE_DELETED') {
          setEmployees(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
          setAlerts(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
          setUnauthorized(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
        }

        if (data.type === 'ZONE_EXIT') {
          setAlerts(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
          setUnauthorized(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
        }

        if (data.type === 'ZONE_ALERT_START') {
          setAlerts(prev => ({ ...prev, [data.tag_id]: data }))
        }
        if (data.type === 'ZONE_ALERT_END') {
          setAlerts(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
        }

        // Cảnh báo nhân viên vào vùng cấm
        if (data.type === 'ZONE_UNAUTHORIZED') {
          setUnauthorized(prev => ({ ...prev, [data.tag_id]: data }))
          // Tự xóa sau 10 giây
          setTimeout(() => {
            setUnauthorized(prev => { const n = { ...prev }; delete n[data.tag_id]; return n })
          }, 10000)
        }

        if (data.type === 'ANCHOR_ADDED') {
          setAnchors(prev => [...prev, data.anchor])
        }
        if (data.type === 'ANCHOR_UPDATED') {
          setAnchors(prev => prev.map(a => a.id === data.anchor.id ? data.anchor : a))
        }
        if (data.type === 'ANCHOR_DELETED') {
          setAnchors(prev => prev.filter(a => a.id !== data.id))
        }
      }

      ws.current.onerror = () => setWsStatus('disconnected')
      ws.current.onclose = () => {
        setWsStatus('disconnected')
        console.log('[WS] Disconnected — retrying in 3s...')
        setTimeout(connect, 3000) // auto-reconnect
      }
    }

    connect()
    return () => {
      ws.current?.close()
    }
  }, [url])

  return { employees, zoneEvents, zones, anchors, alerts, unauthorized, wsStatus }
}

export default useWebSocket