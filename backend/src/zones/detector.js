let cachedZones = []

export function setCachedZones(zones) {
  cachedZones = zones
}

export function getCachedZones() {
  return cachedZones
}

// Ray casting — đếm số lần tia cắt cạnh polygon
// Lẻ = trong polygon, chẵn = ngoài
function pointInPolygon(point, polygon) {
  let inside = false
  const { x, y } = point

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)

    if (intersect) inside = !inside
  }
  return inside
}

// Tìm zone chứa điểm (x, y)
export function detectZone(x, y) {
  for (const zone of cachedZones) {
    if (pointInPolygon({ x, y }, zone.polygon)) {
      return zone
    }
  }
  return null // ngoài tất cả zone
}