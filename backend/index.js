import http from 'http'
import express from 'express'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import connectDB from './src/db/mongo.js'
import startBroker from './src/mqtt/broker.js'
import startSubscriber, { setWsClients } from './src/mqtt/subscriber.js'

dotenv.config()

const app = express()
app.use(express.json())

// CORS cho frontend React
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// API lấy lịch sử zone events
app.get('/api/zone-events', async (req, res) => {
  try {
    const { ZoneEvent } = await import('./src/db/models.js')
    const events = await ZoneEvent.find()
      .sort({ entered_at: -1 })
      .limit(50)
    res.json(events)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// API lấy vị trí mới nhất của từng nhân viên
app.get('/api/employees/current', async (req, res) => {
  try {
    const { Location } = await import('./src/db/models.js')
    const employees = ['EMP_001', 'EMP_002', 'EMP_003']
    const result = await Promise.all(
      employees.map(async (tag_id) => {
        const latest = await Location.findOne({ tag_id })
          .sort({ timestamp: -1 })
        return { tag_id, ...latest?.toObject() }
      })
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const start = async () => {
  // 1. Kết nối MongoDB
  await connectDB()

  // 2. Khởi động MQTT broker
  const mqttPort = process.env.MQTT_PORT || 1883
  startBroker(mqttPort)

  // 3. Tạo HTTP server dùng chung cho Express + WebSocket
  const server = http.createServer(app)

  const clients = []
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    clients.push(ws)
    console.log(`[WS] Frontend connected — ${clients.length} client(s) online`)

    ws.on('close', () => {
      const index = clients.indexOf(ws)
      if (index > -1) clients.splice(index, 1)
      console.log(`[WS] Frontend disconnected — ${clients.length} client(s) online`)
    })
  })

  setWsClients(clients)

  // 4. Subscribe MQTT — đợi 1 giây cho chắc
  setTimeout(() => {
    startSubscriber(process.env.MQTT_BROKER_URL)
  }, 1000)

  // 5. Khởi động server (HTTP + WS dùng chung 1 port)
  const port = process.env.PORT || 3003
  server.listen(port, () => {
    console.log(`[HTTP] API running on port ${port}`)
    console.log(`[WS]   WebSocket on ws://localhost:${port}`)
    console.log(`[MQTT] Broker on port ${mqttPort}`)
  })
}

start()