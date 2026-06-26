export const ZONES = [
  {
    id: 'zone_a_soldering',
    name: 'Khu vuc Han & Linh kien',
    color: '#388BFD',
    canvasFill: 'rgba(56,139,253,0.13)',
    x: 0, y: 0, w: 16, h: 8
  },
  {
    id: 'zone_b_toilet',
    name: 'Nha ve sinh',
    color: '#F85149',
    canvasFill: 'rgba(248,81,73,0.13)',
    x: 0, y: 8, w: 4, h: 7
  },
  {
    id: 'zone_c_rnd',
    name: 'Phong R&D',
    color: '#3FB950',
    canvasFill: 'rgba(63,185,80,0.13)',
    x: 11, y: 8, w: 5, h: 7
  }
]

export const FLOOR_WIDTH  = 19
export const FLOOR_HEIGHT = 15

export const EMPLOYEES = {
  EMP_001: { name: 'Nguyen Van A', color: '#C084FC' },
  EMP_002: { name: 'Tran Thi B',   color: '#FB923C' },
  EMP_003: { name: 'Le Van C',     color: '#22D3EE' },
}

export const getZoneById = (id) => ZONES.find(z => z.id === id)
