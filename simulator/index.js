import mqtt from 'mqtt'

const client = mqtt.connect('mqtt://broker.hivemq.com:1883')

// Các điểm đích có thể đến — trải đều khắp mặt bằng iKY
const WAYPOINTS = [
  { x: 8,  y: 4  }, // Zone A - giữa khu hàn
  { x: 3,  y: 5  }, // Zone A - góc trái
  { x: 13, y: 3  }, // Zone A - góc phải
  { x: 2,  y: 11 }, // Zone B - nhà vệ sinh
  { x: 15, y: 11 }, // Zone C - phòng R&D
  { x: 13, y: 13 }, // Zone C - góc dưới
  { x: 17, y: 10 }, // Zone C - góc phải
  { x: 6,  y: 10 }, // Hành lang giữa
  { x: 9,  y: 12 }, // Khu giữa tầng dưới
  { x: 5,  y: 3  }, // Zone A - trái
]

const FLOOR_BOUNDS = { minX: 0.5, maxX: 18.5, minY: 0.5, maxY: 14.5 }

// Gaussian noise giống UWB thật
function addNoise(value) {
  const u1 = Math.random()
  const u2 = Math.random()
  const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return value + noise * 0.2
}

// Chọn waypoint ngẫu nhiên khác waypoint hiện tại
function randomWaypoint(currentWaypoint) {
  const others = WAYPOINTS.filter(w => w !== currentWaypoint)
  return others[Math.floor(Math.random() * others.length)]
}

// 3 nhân viên với điểm đích riêng
const employees = [
  {
    tag_id: 'EMP_001',
    name: 'Nguyễn Văn A',
    x: 8, y: 4,
    target: randomWaypoint(null),
    speed: 0.05,       // mét/tick
    waitTicks: 0,      // số tick dừng lại tại đích
  },
  {
    tag_id: 'EMP_002',
    name: 'Trần Thị B',
    x: 2, y: 11,
    target: randomWaypoint(null),
    speed: 0.04,
    waitTicks: 0,
  },
  {
    tag_id: 'EMP_003',
    name: 'Lê Văn C',
    x: 15, y: 11,
    target: randomWaypoint(null),
    speed: 0.06,
    waitTicks: 0,
  },
]

function moveEmployee(emp) {
  // Đang dừng chờ tại đích
  if (emp.waitTicks > 0) {
    return { ...emp, waitTicks: emp.waitTicks - 1 }
  }

  const dx = emp.target.x - emp.x
  const dy = emp.target.y - emp.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Đến gần đích rồi → dừng lại 3-10 giây rồi chọn đích mới
  if (dist < 0.3) {
    const waitSeconds = 3 + Math.random() * 7  // dừng 3-10 giây
    const waitTicks = Math.floor(waitSeconds * 10) // 10 ticks/giây
    return {
      ...emp,
      x: emp.target.x,
      y: emp.target.y,
      target: randomWaypoint(emp.target),
      waitTicks,
    }
  }

  // Di chuyển về phía đích
  const step = emp.speed
  let newX = emp.x + (dx / dist) * step
  let newY = emp.y + (dy / dist) * step

  // Giữ trong giới hạn mặt bằng
  newX = Math.max(FLOOR_BOUNDS.minX, Math.min(FLOOR_BOUNDS.maxX, newX))
  newY = Math.max(FLOOR_BOUNDS.minY, Math.min(FLOOR_BOUNDS.maxY, newY))

  return { ...emp, x: newX, y: newY }
}

client.on('connect', () => {
  console.log('Simulator connected to MQTT broker')
  console.log('Simulating 3 employees with waypoint navigation...\n')

  setInterval(() => {
    employees.forEach((emp, index) => {
      employees[index] = moveEmployee(emp)

      const payload = {
        tag_id:    emp.tag_id,
        x:         parseFloat(addNoise(employees[index].x).toFixed(3)),
        y:         parseFloat(addNoise(employees[index].y).toFixed(3)),
        timestamp: new Date().toISOString()
      }

      client.publish('rtls/location', JSON.stringify(payload))
    })
  }, 100)
})

client.on('error', (err) => {
  console.error('Simulator error:', err)
})