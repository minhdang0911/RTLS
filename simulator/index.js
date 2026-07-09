import mqtt from 'mqtt'
import { config } from 'dotenv'
config() // load .env nếu có (VPS: tạo từ .env.example)

// ─── Config từ biến môi trường (hỗ trợ cả local lẫn VPS) ─────────────────
const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883'
const API_URL = process.env.API_URL || 'http://localhost:3003'
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'rtls/location/ikyrts_dashboard'

console.log(`[Simulator] Config: MQTT=${MQTT_URL}, API=${API_URL}, TOPIC=${MQTT_TOPIC}`)

const client = mqtt.connect(MQTT_URL)

// ─── 4 Anchor nodes cố định trên mặt bằng 19×15m ─────────────────────────
const ANCHORS = [
  { id: 'A0', name: 'Anchor Tây-Bắc', x: 0, y: 0 },
  { id: 'A1', name: 'Anchor Đông-Bắc', x: 19, y: 0 },
  { id: 'A2', name: 'Anchor Tây-Nam', x: 0, y: 15 },
  { id: 'A3', name: 'Anchor Đông-Nam', x: 19, y: 15 },
]

// ─── Waypoints di chuyển ──────────────────────────────────────────────────
const WAYPOINTS = [
  { x: 8, y: 4 }, // Zone A - giữa khu hàn
  { x: 3, y: 5 }, // Zone A - góc trái
  { x: 13, y: 3 }, // Zone A - góc phải
  { x: 2, y: 11 }, // Zone B - nhà vệ sinh
  { x: 15, y: 11 }, // Zone C - phòng R&D
  { x: 13, y: 13 }, // Zone C - góc dưới
  { x: 6, y: 10 }, // Hành lang giữa
  { x: 9, y: 12 }, // Khu giữa tầng dưới
  { x: 5, y: 3 }, // Zone A - trái
]

const FLOOR_BOUNDS = { minX: 0.5, maxX: 18.5, minY: 0.5, maxY: 14.5 }

// ─────────────────────────────────────────────────────────────────────────────
// Matrix math utilities (dùng cho Kalman Filter)
// ─────────────────────────────────────────────────────────────────────────────
const mat = {
  mul: (A, B) => {
    const rows = A.length, cols = B[0].length, inner = B.length
    return Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) =>
        A[i].reduce((s, _, k) => s + A[i][k] * B[k][j], 0)
      )
    )
  },
  add: (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j])),
  sub: (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j])),
  T: (A) => A[0].map((_, j) => A.map(r => r[j])),
  inv2: ([[a, b], [c, d]]) => { const det = a * d - b * c; return [[d / det, -b / det], [-c / det, a / det]] },
  mulVec: (A, v) => A.map(r => r.reduce((s, a, j) => s + a * v[j], 0)),
  addVec: (a, b) => a.map((v, i) => v + b[i]),
  subVec: (a, b) => a.map((v, i) => v - b[i]),
  eye: (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Kalman Filter 2D — State: [x, y, vx, vy]
// Giả lập xử lý trong firmware/gateway UWB (Pozyx/Decawave style)
// Backend KHÔNG cần làm bước này nữa
// ─────────────────────────────────────────────────────────────────────────────
class KalmanFilter2D {
  constructor() {
    const dt = 0.1 // 10 Hz
    this.F = [[1, 0, dt, 0], [0, 1, 0, dt], [0, 0, 1, 0], [0, 0, 0, 1]] // Ma trận chuyển trạng thái
    this.H = [[1, 0, 0, 0], [0, 1, 0, 0]]                         // Ma trận quan sát  
    this.Q = [[0.05, 0, 0, 0], [0, 0.05, 0, 0], [0, 0, 0.5, 0], [0, 0, 0, 0.5]] // Nhiễu quá trình
    this.R = [[0.04, 0], [0, 0.04]]                           // Nhiễu đo UWB ~±20cm
    this.P = [[10, 0, 0, 0], [0, 10, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]  // Hiệp phương sai ban đầu
    this.x = null                                           // Trạng thái (khởi tạo lần đầu)
  }

  update(zx, zy) {
    const { mul, add, sub, T, inv2, mulVec, addVec, subVec, eye } = mat
    if (!this.x) { this.x = [zx, zy, 0, 0]; return { x: zx, y: zy } }
    // Predict
    const xp = mulVec(this.F, this.x)
    const Pp = add(mul(mul(this.F, this.P), T(this.F)), this.Q)
    // Update
    const z = [zx, zy]
    const innov = subVec(z, mulVec(this.H, xp))
    const S = add(mul(mul(this.H, Pp), T(this.H)), this.R)
    const K = mul(mul(Pp, T(this.H)), inv2(S))
    this.x = addVec(xp, mulVec(K, innov))
    this.P = mul(sub(eye(4), mul(K, this.H)), Pp)
    return { x: this.x[0], y: this.x[1] }
  }
}

// 1 Kalman instance per tag (giống firmware mỗi tag có bộ lọc riêng)
const kalmanFilters = {}

// ─── Gaussian noise ───────────────────────────────────────────────────────
function gaussianNoise(std = 0.2) {
  const u1 = Math.random(), u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std
}

// ─── Tính khoảng cách từ tag đến anchor (có nhiễu UWB ~±20cm) ────────────
function measureDistance(trueX, trueY, anchor) {
  const trueDist = Math.sqrt((trueX - anchor.x) ** 2 + (trueY - anchor.y) ** 2)
  return Math.max(0.1, trueDist + gaussianNoise(0.2))
}

// ─── Trilateration — Least Squares giải hệ phương trình vòng tròn ─────────
function trilaterate(anchors, distances) {
  const n = anchors.length
  const refA = anchors[n - 1]
  const refD = distances[n - 1]
  const A = [], b = []
  for (let i = 0; i < n - 1; i++) {
    const ai = anchors[i], di = distances[i]
    A.push([-2 * (ai.x - refA.x), -2 * (ai.y - refA.y)])
    b.push(di * di - refD * refD - ai.x * ai.x + refA.x * refA.x - ai.y * ai.y + refA.y * refA.y)
  }
  const AT = A[0].map((_, j) => A.map(row => row[j]))
  const ATA = [[0, 0], [0, 0]]
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < n - 1; k++) ATA[i][j] += AT[i][k] * A[k][j]
  const ATb = [0, 0]
  for (let i = 0; i < 2; i++)
    for (let k = 0; k < n - 1; k++) ATb[i] += AT[i][k] * b[k]
  const [[a, bv], [c, d]] = ATA
  const det = a * d - bv * c
  if (Math.abs(det) < 1e-10) {
    return { x: anchors.reduce((s, a) => s + a.x, 0) / n, y: anchors.reduce((s, a) => s + a.y, 0) / n }
  }
  const inv = [[(d / det), (-bv / det)], [(-c / det), (a / det)]]
  const x = inv[0][0] * ATb[0] + inv[0][1] * ATb[1]
  const y = inv[1][0] * ATb[0] + inv[1][1] * ATb[1]
  return {
    x: Math.max(FLOOR_BOUNDS.minX, Math.min(FLOOR_BOUNDS.maxX, x)),
    y: Math.max(FLOOR_BOUNDS.minY, Math.min(FLOOR_BOUNDS.maxY, y))
  }
}

// ─── Chọn waypoint ngẫu nhiên ─────────────────────────────────────────────
function randomWaypoint(current) {
  const others = WAYPOINTS.filter(w => w !== current)
  if (Math.random() < 0.06) {
    const toilet = others.find(w => w.x === 2 && w.y === 11)
    if (toilet) return toilet
  }
  return others[Math.floor(Math.random() * others.length)]
}

// ─── Di chuyển employee đến target ────────────────────────────────────────
function moveEmployee(emp) {
  if (emp.waitTicks > 0) return { ...emp, waitTicks: emp.waitTicks - 1 }
  const dx = emp.target.x - emp.x, dy = emp.target.y - emp.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < emp.speed) {
    return { ...emp, x: emp.target.x, y: emp.target.y, target: randomWaypoint(emp.target), waitTicks: Math.floor(Math.random() * 30) }
  }
  const step = emp.speed
  return {
    ...emp,
    x: Math.max(FLOOR_BOUNDS.minX, Math.min(FLOOR_BOUNDS.maxX, emp.x + (dx / dist) * step)),
    y: Math.max(FLOOR_BOUNDS.minY, Math.min(FLOOR_BOUNDS.maxY, emp.y + (dy / dist) * step))
  }
}

let employees = []

async function initEmployees() {
  try {
    const response = await fetch(`${API_URL}/api/employees`)
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      employees = data.map(emp => ({
        tag_id: emp.tag_id,
        name: emp.name,
        x: 2 + Math.random() * 14,
        y: 2 + Math.random() * 10,
        target: randomWaypoint(null),
        speed: 0.015 + Math.random() * 0.01,
        waitTicks: 0
      }))
      console.log(`[Simulator] Loaded ${employees.length} employees from API (${API_URL})`)
      return
    }
  } catch (err) {
    console.error('[Simulator] Fetch employees failed, using fallback:', err.message)
  }

  employees = [
    { tag_id: 'EMP_001', name: 'Nguyễn Văn A', x: 8, y: 4, target: randomWaypoint(null), speed: 0.02, waitTicks: 0 },
    { tag_id: 'EMP_002', name: 'Trần Thị B', x: 2, y: 11, target: randomWaypoint(null), speed: 0.015, waitTicks: 0 },
    { tag_id: 'EMP_003', name: 'Lê Văn C', x: 15, y: 11, target: randomWaypoint(null), speed: 0.025, waitTicks: 0 },
  ]
}

client.on('connect', async () => {
  console.log(`[Simulator] Connected to MQTT: ${MQTT_URL}`)
  await initEmployees()
  console.log(`[Simulator] Simulating ${employees.length} employees`)
  console.log(`[Simulator] Pipeline: Trilateration → Kalman Filter → MQTT publish`)

  // Sync nhân viên với API mỗi 5s
  setInterval(async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees`)
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(dbEmp => {
          const existing = employees.find(e => e.tag_id === dbEmp.tag_id)
          if (!existing) {
            employees.push({
              tag_id: dbEmp.tag_id, name: dbEmp.name,
              x: 2 + Math.random() * 14, y: 2 + Math.random() * 10,
              target: randomWaypoint(null), speed: 0.015 + Math.random() * 0.01, waitTicks: 0
            })
            console.log(`[Simulator] Added: ${dbEmp.name}`)
          } else if (existing.name !== dbEmp.name) {
            existing.name = dbEmp.name
          }
        })
        employees = employees.filter(e => data.some(d => d.tag_id === e.tag_id))
      }
    } catch (_) { }
  }, 5000)

  // Main loop — 10 ticks/giây
  setInterval(() => {
    employees.forEach((emp, index) => {
      const cur = employees[index]
      if (!cur) return

      // 1. Di chuyển tag (vị trí thực)
      employees[index] = moveEmployee(cur)
      const trueX = employees[index].x
      const trueY = employees[index].y

      // 2. Đo khoảng cách đến từng anchor (có nhiễu UWB)
      const distances = ANCHORS.map(a => measureDistance(trueX, trueY, a))

      // 3. Trilateration — tính tọa độ ước lượng từ khoảng cách
      const estimated = trilaterate(ANCHORS, distances)

      // 4. Kalman Filter — làm mượt tọa độ (giả lập xử lý trong firmware/gateway)
      if (!kalmanFilters[cur.tag_id]) {
        kalmanFilters[cur.tag_id] = new KalmanFilter2D()
      }
      const filtered = kalmanFilters[cur.tag_id].update(estimated.x, estimated.y)

      // 5. Publish lên MQTT — backend chỉ nhận tọa độ đã xử lý hoàn chỉnh
      const payload = {
        tag_id: cur.tag_id,
        x: parseFloat(filtered.x.toFixed(3)),   // đã qua Kalman
        y: parseFloat(filtered.y.toFixed(3)),   // đã qua Kalman
        x_raw: parseFloat(estimated.x.toFixed(3)), // tọa độ thô (visualize Tri)
        y_raw: parseFloat(estimated.y.toFixed(3)),
        timestamp: new Date().toISOString(),
        anchor_distances: ANCHORS.map((a, i) => ({
          id: a.id,
          x: a.x,
          y: a.y,
          dist: parseFloat(distances[i].toFixed(3))
        }))
      }

      client.publish(MQTT_TOPIC, JSON.stringify(payload))
    })
  }, 100)
})

client.on('error', (err) => {
  console.error('[Simulator] Error:', err)
})