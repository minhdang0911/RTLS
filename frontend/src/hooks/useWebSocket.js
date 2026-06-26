import { useEffect, useRef, useState } from 'react'

const useWebSocket = (url) => {
  const [employees, setEmployees] = useState({
    EMP_001: { tag_id: 'EMP_001', x: 8,  y: 4,  zone_id: null },
    EMP_002: { tag_id: 'EMP_002', x: 2,  y: 11, zone_id: null },
    EMP_003: { tag_id: 'EMP_003', x: 15, y: 11, zone_id: null },
  })
  const [zoneEvents, setZoneEvents] = useState([])
  const ws = useRef(null)

  // Gọi API lấy zone events lịch sử khi load trang
  useEffect(() => {
    fetch('http://localhost:3003/api/zone-events')
      .then(res => res.json())
      .then(data => setZoneEvents(data))
      .catch(err => console.error('Fetch zone events error:', err))
  }, [])

  useEffect(() => {
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'LOCATION_UPDATE') {
        setEmployees(prev => ({
          ...prev,
          [data.tag_id]: {
            ...prev[data.tag_id],
            x: data.x,
            y: data.y,
            zone_id: data.zone_id
          }
        }))
      }

      if (data.type === 'ZONE_ENTER' || data.type === 'ZONE_EXIT') {
        setZoneEvents(prev => [data, ...prev].slice(0, 20))
      }
    }

    ws.current.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    ws.current.onclose = () => {
      console.log('WebSocket disconnected')
    }

    return () => ws.current?.close()
  }, [url])

  return { employees, zoneEvents }
}

export default useWebSocket