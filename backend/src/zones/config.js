// Tọa độ polygon các zone (đơn vị mét, góc trái trên = 0,0)
const ZONES = [
  {
    id:   'zone_a_soldering',
    name: 'Khu vực Hàn và Linh kiện',
    color: '#378ADD',
    alert_threshold_seconds: null, // không alert
    polygon: [
      { x: 0,  y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: 8 },
      { x: 0,  y: 8 }
    ]
  },
  {
    id:   'zone_b_toilet',
    name: 'Nhà vệ sinh',
    color: '#D85A30',
    alert_threshold_seconds: 1200, // alert sau 20 phút
    polygon: [
      { x: 0,  y: 8  },
      { x: 4,  y: 8  },
      { x: 4,  y: 15 },
      { x: 0,  y: 15 }
    ]
  },
  {
    id:   'zone_c_rnd',
    name: 'Phòng R&D',
    color: '#1D9E75',
    alert_threshold_seconds: null, // không alert
    polygon: [
      { x: 11, y: 8  },
      { x: 19, y: 8  },
      { x: 19, y: 15 },
      { x: 11, y: 15 }
    ]
  }
]

export default ZONES