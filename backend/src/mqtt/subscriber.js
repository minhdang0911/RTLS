import mqtt from 'mqtt'
import { detectZone } from '../zones/detector.js'
import { Location, ZoneEvent, ZoneAccess, Attendance } from '../db/models.js'

// ─────────────────────────────────────────────────────────────────────────────
// State management
// ─────────────────────────────────────────────────────────────────────────────
const employeeState    = {}   // zone state machine
const saveCounter      = {}   // throttle ghi MongoDB location
const attendanceTick   = {}   // throttle cập nhật attendance

let wsClients = []
export const setWsClients = (clients) => { wsClients = clients }

export const broadcast = (data) => {
  wsClients.forEach(client => {
    if (client.readyState === 1) client.send(JSON.stringify(data))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance tracking — cập nhật first_seen / last_seen theo ngày
// ─────────────────────────────────────────────────────────────────────────────
async function updateAttendance(tag_id) {
  attendanceTick[tag_id] = (attendanceTick[tag_id] || 0) + 1
  // Cập nhật mỗi 60 giây (600 ticks ở 10Hz)
  if (attendanceTick[tag_id] % 600 !== 1) return

  const today = new Date().toISOString().split('T')[0]
  const now   = new Date()

  try {
    const existing = await Attendance.findOne({ tag_id, date: today })
    if (existing) {
      const diffSec = Math.floor((now - existing.last_seen) / 1000)
      await Attendance.findOneAndUpdate(
        { tag_id, date: today },
        { $set: { last_seen: now }, $inc: { total_active_seconds: Math.min(diffSec, 120) } }
      )
    } else {
      await Attendance.create({ tag_id, date: today, first_seen: now, last_seen: now, total_active_seconds: 0 })
    }
  } catch (err) {
    // upsert race condition — bỏ qua
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT Subscriber chính
// ─────────────────────────────────────────────────────────────────────────────
const startSubscriber = () => {
  const MQTT_URL   = process.env.MQTT_URL || process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883'
  const MQTT_TOPIC = process.env.MQTT_TOPIC || 'rtls/location/ikyrts_dashboard'
  const client = mqtt.connect(MQTT_URL)

  client.on('connect', () => {
    console.log(`[MQTT] Subscriber connected to ${MQTT_URL}`)
    client.subscribe(MQTT_TOPIC)
  })

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString())
      // x, y đã qua Trilateration + Kalman trong simulator/firmware
      // Backend chỉ cần nhận và xử lý business logic
      const { tag_id, x, y, anchor_distances } = data

      // ── Zone detection ──
      const currentZone = detectZone(x, y)
      const zone_id = currentZone ? currentZone.id : null

      // ── Lưu MongoDB 1 lần/6 giây (throttle mạnh hơn để không overflow Atlas free tier) ──
      saveCounter[tag_id] = (saveCounter[tag_id] || 0) + 1
      if (saveCounter[tag_id] % 60 === 0) {
        await Location.create({ tag_id, x, y, zone_id })
      }

      // ── Cập nhật Attendance ──
      updateAttendance(tag_id).catch(() => {})

      // ── Zone state machine ──
      const prevState = employeeState[tag_id]

      // Case 1: Rời khỏi zone cũ
      if (prevState && prevState.zone_id && prevState.zone_id !== zone_id) {
        const duration = Math.floor((Date.now() - prevState.entered_at) / 1000)
        await ZoneEvent.findByIdAndUpdate(prevState.event_id, {
          exited_at: new Date(),
          duration_seconds: duration
        })
        broadcast({ type: 'ZONE_EXIT', tag_id, zone_id: prevState.zone_id, duration_seconds: duration })

        if (prevState.alert_triggered) {
          broadcast({ type: 'ZONE_ALERT_END', tag_id, zone_id: prevState.zone_id })
        }
        employeeState[tag_id] = null
      }

      // Case 2: Vào zone mới
      if (zone_id && (!prevState || prevState.zone_id !== zone_id)) {
        // Kiểm tra Access Control — có bị cấm vào zone này không?
        const accessRule = await ZoneAccess.findOne({ zone_id, tag_id })
        if (accessRule && accessRule.allowed === false) {
          broadcast({
            type: 'ZONE_UNAUTHORIZED',
            tag_id,
            zone_id,
            zone_name: currentZone.name,
            message: `Nhân viên không được phép vào ${currentZone.name}`
          })
          console.log(`[Access] UNAUTHORIZED: ${tag_id} tried to enter ${currentZone.name}`)
        }

        const event = await ZoneEvent.create({
          tag_id,
          zone_id,
          zone_name: currentZone.name,
          entered_at: new Date()
        })
        employeeState[tag_id] = {
          zone_id,
          entered_at: Date.now(),
          event_id: event._id,
          alert_triggered: false
        }
        broadcast({ type: 'ZONE_ENTER', tag_id, zone_id, zone_name: currentZone.name })
      }

      // Case 3: Ở lại zone — kiểm tra overtime alert
      if (zone_id && prevState && prevState.zone_id === zone_id) {
        if (currentZone && currentZone.alert_threshold_seconds !== null) {
          const duration = Math.floor((Date.now() - prevState.entered_at) / 1000)
          if (duration > currentZone.alert_threshold_seconds && !prevState.alert_triggered) {
            prevState.alert_triggered = true
            broadcast({
              type: 'ZONE_ALERT_START',
              tag_id,
              zone_id,
              zone_name: currentZone.name,
              duration_seconds: duration,
              alert_threshold_seconds: currentZone.alert_threshold_seconds
            })
            console.log(`[Alert] ${tag_id} exceeded limit in ${currentZone.name} (${duration}s)`)
          }
        }
      }

      // ── Broadcast vị trí realtime ──
      broadcast({
        type: 'LOCATION_UPDATE',
        tag_id,
        x,           // Kalman filtered
        y,
        x_raw,       // Raw từ trilateration
        y_raw,
        zone_id,
        anchor_distances: anchor_distances || null
      })

    } catch (err) {
      console.error('[MQTT] Error:', err.message)
    }
  })

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err.message)
  })
}

export default startSubscriber