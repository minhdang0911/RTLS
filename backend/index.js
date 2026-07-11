import http from 'http'
import express from 'express'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import connectDB from './src/db/mongo.js'
import startBroker from './src/mqtt/broker.js'
import startSubscriber, { setWsClients, broadcast } from './src/mqtt/subscriber.js'
import { Zone, Employee, Anchor, Attendance, ZoneAccess, ZoneEvent, Location } from './src/db/models.js'
import ZONES from './src/zones/config.js'
import { setCachedZones } from './src/zones/detector.js'

dotenv.config()

const app = express()
app.use(express.json())

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// ─── Admin: xóa data cũ khẩn cấp (dùng khi Atlas sắp đầy) ────────────────
app.delete('/api/admin/clear-locations', async (req, res) => {
  try {
    const keepHours = parseInt(req.query.keepHours || '1')
    const cutoff = new Date(Date.now() - keepHours * 3600 * 1000)
    const locResult  = await Location.deleteMany({ timestamp: { $lt: cutoff } })
    const evtResult  = await ZoneEvent.deleteMany({ entered_at: { $lt: new Date(Date.now() - 7 * 86400 * 1000) } })
    console.log(`[Admin] Cleared ${locResult.deletedCount} locations, ${evtResult.deletedCount} old events`)
    res.json({
      success: true,
      deleted_locations: locResult.deletedCount,
      deleted_events: evtResult.deletedCount,
      kept_since: cutoff.toISOString()
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})


// ─── Zone Events ───────────────────────────────────────────────────────────
app.get('/api/zone-events', async (req, res) => {
  try {
    const events = await ZoneEvent.find().sort({ entered_at: -1 }).limit(50)
    res.json(events)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Employees ─────────────────────────────────────────────────────────────
app.get('/api/employees/current', async (req, res) => {
  try {
    const activeEmps = await Employee.find()
    const result = await Promise.all(
      activeEmps.map(async (emp) => {
        const latest = await Location.findOne({ tag_id: emp.tag_id }).sort({ timestamp: -1 })
        return { tag_id: emp.tag_id, name: emp.name, color: emp.color, ...latest?.toObject() }
      })
    )
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/employees', async (req, res) => {
  try { res.json(await Employee.find()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/employees', async (req, res) => {
  try {
    const { tag_id, name, color } = req.body
    if (!tag_id || !name || !color) return res.status(400).json({ error: 'Thiếu trường dữ liệu' })
    const newEmp = await Employee.create({ tag_id, name, color })
    broadcast({ type: 'EMPLOYEE_ADDED', employee: newEmp })
    res.status(201).json(newEmp)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/employees/:tag_id', async (req, res) => {
  try {
    const { tag_id } = req.params
    const { name, color } = req.body
    const updateData = {}
    if (name  !== undefined) updateData.name  = name
    if (color !== undefined) updateData.color = color
    const updatedEmp = await Employee.findOneAndUpdate({ tag_id }, updateData, { returnDocument: 'after' })
    if (!updatedEmp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    broadcast({ type: 'EMPLOYEE_UPDATED', employee: updatedEmp })
    res.json(updatedEmp)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/employees/:tag_id', async (req, res) => {
  try {
    const { tag_id } = req.params
    const deletedEmp = await Employee.findOneAndDelete({ tag_id })
    if (!deletedEmp) return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    broadcast({ type: 'EMPLOYEE_DELETED', tag_id })
    res.json({ success: true, tag_id })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Zones ─────────────────────────────────────────────────────────────────
app.get('/api/zones', async (req, res) => {
  try { res.json(await Zone.find()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/zones/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { alert_threshold_seconds, name, color } = req.body
    const updateData = {}
    if (alert_threshold_seconds !== undefined) updateData.alert_threshold_seconds = alert_threshold_seconds
    if (name  !== undefined) updateData.name  = name
    if (color !== undefined) updateData.color = color
    const updatedZone = await Zone.findOneAndUpdate({ id }, updateData, { returnDocument: 'after' })
    if (!updatedZone) return res.status(404).json({ error: 'Zone not found' })
    const zonesFromDb = await Zone.find()
    setCachedZones(zonesFromDb)
    broadcast({ type: 'ZONE_UPDATED', zone: updatedZone })
    res.json(updatedZone)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Zone Access Control ────────────────────────────────────────────────────
app.get('/api/zones/:id/access', async (req, res) => {
  try {
    const rules = await ZoneAccess.find({ zone_id: req.params.id })
    res.json(rules)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/zones/:id/access', async (req, res) => {
  try {
    const { zone_id } = { zone_id: req.params.id }
    const { tag_id, allowed } = req.body
    if (!tag_id) return res.status(400).json({ error: 'Thiếu tag_id' })
    const rule = await ZoneAccess.findOneAndUpdate(
      { zone_id, tag_id },
      { zone_id, tag_id, allowed: allowed ?? false },
      { upsert: true, returnDocument: 'after' }
    )
    broadcast({ type: 'ZONE_ACCESS_UPDATED', zone_id, tag_id, allowed: rule.allowed })
    res.json(rule)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/zones/:id/access/:tag_id', async (req, res) => {
  try {
    const { id: zone_id, tag_id } = req.params
    await ZoneAccess.findOneAndDelete({ zone_id, tag_id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Anchors ───────────────────────────────────────────────────────────────
app.get('/api/anchors', async (req, res) => {
  try { res.json(await Anchor.find()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/anchors', async (req, res) => {
  try {
    const { id, name, x, y } = req.body
    if (!id || !name || x == null || y == null) return res.status(400).json({ error: 'Thiếu trường dữ liệu' })
    const anchor = await Anchor.create({ id, name, x, y })
    broadcast({ type: 'ANCHOR_ADDED', anchor })
    res.status(201).json(anchor)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/anchors/:id', async (req, res) => {
  try {
    const { name, x, y, active } = req.body
    const updateData = {}
    if (name   !== undefined) updateData.name   = name
    if (x      !== undefined) updateData.x      = x
    if (y      !== undefined) updateData.y      = y
    if (active !== undefined) updateData.active = active
    const updated = await Anchor.findOneAndUpdate({ id: req.params.id }, updateData, { returnDocument: 'after' })
    if (!updated) return res.status(404).json({ error: 'Anchor not found' })
    broadcast({ type: 'ANCHOR_UPDATED', anchor: updated })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/anchors/:id', async (req, res) => {
  try {
    const deleted = await Anchor.findOneAndDelete({ id: req.params.id })
    if (!deleted) return res.status(404).json({ error: 'Anchor not found' })
    broadcast({ type: 'ANCHOR_DELETED', id: req.params.id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Attendance ────────────────────────────────────────────────────────────
app.get('/api/attendance', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]
    const records = await Attendance.find({ date }).sort({ first_seen: 1 })
    // Enrich với tên nhân viên
    const employees = await Employee.find()
    const empMap = {}
    employees.forEach(e => { empMap[e.tag_id] = e })
    const result = records.map(r => ({
      tag_id:               r.tag_id,
      name:                 empMap[r.tag_id]?.name || r.tag_id,
      color:                empMap[r.tag_id]?.color || '#888',
      date:                 r.date,
      first_seen:           r.first_seen,
      last_seen:            r.last_seen,
      total_active_seconds: r.total_active_seconds
    }))
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Analytics ─────────────────────────────────────────────────────────────
// Heatmap: đếm số điểm tọa độ trong từng ô 1m×1m
app.get('/api/analytics/heatmap', async (req, res) => {
  try {
    const hoursBack = parseInt(req.query.hours || '24')
    const from = new Date(Date.now() - hoursBack * 3600 * 1000)
    const data = await Location.aggregate([
      { $match: { timestamp: { $gte: from } } },
      {
        $group: {
          _id: {
            cx: { $round: ['$x', 0] },
            cy: { $round: ['$y', 0] }
          },
          count: { $sum: 1 }
        }
      },
      { $project: { _id: 0, x: '$_id.cx', y: '$_id.cy', count: 1 } },
      { $sort: { count: -1 } }
    ])
    res.json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Zone summary: thống kê thời gian và lượt vào cho từng zone
app.get('/api/analytics/zone-summary', async (req, res) => {
  try {
    const summary = await ZoneEvent.aggregate([
      { $match: { exited_at: { $ne: null } } },
      {
        $group: {
          _id: '$zone_id',
          zone_name:         { $first: '$zone_name' },
          visit_count:       { $sum: 1 },
          avg_duration_s:    { $avg: '$duration_seconds' },
          max_duration_s:    { $max: '$duration_seconds' },
          unique_employees:  { $addToSet: '$tag_id' }
        }
      },
      {
        $project: {
          _id: 0,
          zone_id:          '$_id',
          zone_name:        1,
          visit_count:      1,
          avg_duration_s:   { $round: ['$avg_duration_s', 0] },
          max_duration_s:   1,
          unique_employees: { $size: '$unique_employees' }
        }
      },
      { $sort: { visit_count: -1 } }
    ])
    res.json(summary)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Timeline nhân viên trong ngày
app.get('/api/analytics/employee/:tag_id', async (req, res) => {
  try {
    const { tag_id } = req.params
    const date = req.query.date || new Date().toISOString().split('T')[0]
    const from = new Date(date + 'T00:00:00.000Z')
    const to   = new Date(date + 'T23:59:59.999Z')
    const events = await ZoneEvent.find({
      tag_id,
      entered_at: { $gte: from, $lte: to }
    }).sort({ entered_at: 1 })
    const attendance = await Attendance.findOne({ tag_id, date })
    res.json({ tag_id, date, attendance, events })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Export CSV
app.get('/api/analytics/export/csv', async (req, res) => {
  try {
    const hoursBack = parseInt(req.query.hours || '24')
    const from = new Date(Date.now() - hoursBack * 3600 * 1000)
    const events = await ZoneEvent.find({ entered_at: { $gte: from } }).sort({ entered_at: -1 })
    const employees = await Employee.find()
    const empMap = {}
    employees.forEach(e => { empMap[e.tag_id] = e.name })

    let csv = 'tag_id,employee_name,zone_id,zone_name,entered_at,exited_at,duration_seconds\n'
    events.forEach(ev => {
      csv += [
        ev.tag_id,
        empMap[ev.tag_id] || ev.tag_id,
        ev.zone_id,
        ev.zone_name,
        ev.entered_at?.toISOString() || '',
        ev.exited_at?.toISOString()  || '',
        ev.duration_seconds ?? ''
      ].join(',') + '\n'
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="rtls-report-${hoursBack}h.csv"`)
    res.send(csv)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Replay ────────────────────────────────────────────────────────────────
app.get('/api/replay', async (req, res) => {
  try {
    const { from, to, tag_id } = req.query
    if (!from || !to) return res.status(400).json({ error: 'Cần truyền from và to (ISO string)' })
    const query = {
      timestamp: { $gte: new Date(from), $lte: new Date(to) }
    }
    if (tag_id) query.tag_id = tag_id
    const locations = await Location.find(query).sort({ timestamp: 1 }).limit(2000)
    res.json(locations)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── Server Bootstrap ──────────────────────────────────────────────────────
const DEFAULT_ANCHORS = [
  { id: 'A0', name: 'Anchor Tây-Bắc',  x: 0,  y: 0  },
  { id: 'A1', name: 'Anchor Đông-Bắc', x: 19, y: 0  },
  { id: 'A2', name: 'Anchor Tây-Nam',  x: 0,  y: 15 },
  { id: 'A3', name: 'Anchor Đông-Nam', x: 19, y: 15 },
]

const start = async () => {
  await connectDB()

  // Seed zones
  try {
    if (await Zone.countDocuments() === 0) {
      await Zone.insertMany(ZONES)
      console.log('[DB] Default zones seeded.')
    }
  } catch (e) { console.error('[DB] Zone seed error:', e.message) }

  // Seed employees
  try {
    if (await Employee.countDocuments() === 0) {
      await Employee.insertMany([
        { tag_id: 'EMP_001', name: 'Nguyễn Văn A', color: '#C084FC' },
        { tag_id: 'EMP_002', name: 'Trần Thị B',   color: '#FB923C' },
        { tag_id: 'EMP_003', name: 'Lê Văn C',     color: '#22D3EE' }
      ])
      console.log('[DB] Default employees seeded.')
    }
  } catch (e) { console.error('[DB] Employee seed error:', e.message) }

  // Seed anchor nodes
  try {
    if (await Anchor.countDocuments() === 0) {
      await Anchor.insertMany(DEFAULT_ANCHORS)
      console.log('[DB] Default anchors seeded.')
    }
  } catch (e) { console.error('[DB] Anchor seed error:', e.message) }

  // Load zones vào memory cache
  try {
    const zonesFromDb = await Zone.find()
    setCachedZones(zonesFromDb)
    console.log(`[Cache] Loaded ${zonesFromDb.length} zones.`)
  } catch (e) { console.error('[Cache] Error:', e.message) }

  const mqttPort = process.env.MQTT_PORT || 1883
  startBroker(mqttPort)

  const server = http.createServer(app)
  const clients = []
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    clients.push(ws)
    console.log(`[WS] Connected — ${clients.length} client(s)`)
    ws.on('close', () => {
      const idx = clients.indexOf(ws)
      if (idx > -1) clients.splice(idx, 1)
      console.log(`[WS] Disconnected — ${clients.length} client(s)`)
    })
  })

  setWsClients(clients)

  // ─── Auto cleanup — chạy mỗi 30 phút, xóa data cũ tránh tràn Atlas ───────
  const runCleanup = async () => {
    try {
      const locCutoff = new Date(Date.now() - 4 * 3600 * 1000)          // cũ hơn 4h
      const evtCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000)    // cũ hơn 7 ngày
      const locResult = await Location.deleteMany({ timestamp: { $lt: locCutoff } })
      const evtResult = await ZoneEvent.deleteMany({ entered_at: { $lt: evtCutoff } })
      if (locResult.deletedCount > 0 || evtResult.deletedCount > 0) {
        console.log(`[AutoClean] Deleted ${locResult.deletedCount} locations, ${evtResult.deletedCount} zone events`)
      }
    } catch (err) {
      console.error('[AutoClean] Error:', err.message)
    }
  }
  runCleanup() // chạy ngay lúc khởi động để dọn data cũ
  // Xóa toàn bộ zone events khi startup (giải phóng quota ngay)
  ZoneEvent.deleteMany({}).then(r => {
    if (r.deletedCount > 0) console.log(`[AutoClean] Startup: purged ${r.deletedCount} zone events`)
  }).catch(() => {})
  setInterval(runCleanup, 30 * 60 * 1000) // sau đó mỗi 30 phút

  setTimeout(() => {
    startSubscriber(process.env.MQTT_BROKER_URL)
  }, 1000)

  const port = process.env.PORT || 3003
  server.listen(port, () => {
    console.log(`[HTTP] API running on port ${port}`)
    console.log(`[WS]   WebSocket on ws://localhost:${port}`)
    console.log(`[MQTT] Broker on port ${mqttPort}`)
  })
}

start()