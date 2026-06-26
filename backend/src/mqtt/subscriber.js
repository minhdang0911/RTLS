import mqtt from 'mqtt'
import { detectZone } from '../zones/detector.js'
import { Location, ZoneEvent } from '../db/models.js'

const employeeState = {}
const saveCounter = {}  // đếm để throttle ghi MongoDB

let wsClients = []
export const setWsClients = (clients) => { wsClients = clients }

const broadcast = (data) => {
  wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data))
    }
  })
}

const startSubscriber = () => {
  const client = mqtt.connect('mqtt://broker.hivemq.com:1883')

  client.on('connect', () => {
    console.log('Subscriber connected to broker')
    client.subscribe('rtls/location')
  })

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString())
      const { tag_id, x, y } = data

      // Zone detection chạy mỗi message (10 lần/giây)
      const currentZone = detectZone(x, y)
      const zone_id = currentZone ? currentZone.id : null

      // Chỉ lưu MongoDB 1 lần/giây (mỗi 10 message)
      saveCounter[tag_id] = (saveCounter[tag_id] || 0) + 1
      if (saveCounter[tag_id] % 10 === 0) {
        await Location.create({ tag_id, x, y, zone_id })
      }

      // Xử lý zone event (ENTER / EXIT)
      const prevState = employeeState[tag_id]

      // Nhân viên vào zone mới
      if (zone_id && (!prevState || prevState.zone_id !== zone_id)) {
        // Đóng event cũ nếu có
        if (prevState && prevState.event_id) {
          const duration = Math.floor(
            (Date.now() - prevState.entered_at) / 1000
          )
          await ZoneEvent.findByIdAndUpdate(prevState.event_id, {
            exited_at: new Date(),
            duration_seconds: duration
          })
          broadcast({
            type: 'ZONE_EXIT',
            tag_id,
            zone_id: prevState.zone_id,
            duration_seconds: duration
          })
        }

        // Tạo event mới
        const event = await ZoneEvent.create({
          tag_id,
          zone_id,
          zone_name: currentZone.name,
          entered_at: new Date()
        })

        employeeState[tag_id] = {
          zone_id,
          entered_at: Date.now(),
          event_id: event._id
        }

        broadcast({
          type: 'ZONE_ENTER',
          tag_id,
          zone_id,
          zone_name: currentZone.name
        })
      }

      // Nhân viên ra khỏi tất cả zone
      if (!zone_id && prevState && prevState.event_id) {
        const duration = Math.floor(
          (Date.now() - prevState.entered_at) / 1000
        )
        await ZoneEvent.findByIdAndUpdate(prevState.event_id, {
          exited_at: new Date(),
          duration_seconds: duration
        })
        broadcast({
          type: 'ZONE_EXIT',
          tag_id,
          zone_id: prevState.zone_id,
          duration_seconds: duration
        })
        employeeState[tag_id] = null
      }

      // Broadcast vị trí realtime lên frontend (vẫn 10 lần/giây)
      broadcast({ type: 'LOCATION_UPDATE', tag_id, x, y, zone_id })

    } catch (err) {
      console.error('Error:', err.message)
    }
  })
}

export default startSubscriber