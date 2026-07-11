import mongoose from 'mongoose'

// Lưu tọa độ raw — TTL 1 ngày tự xóa
const locationSchema = new mongoose.Schema({
  tag_id:    { type: String, required: true },
  x:         { type: Number, required: true },
  y:         { type: Number, required: true },
  zone_id:   { type: String, default: null },
  timestamp: { type: Date,   default: Date.now }
})
// Tự xóa sau 4 giờ — giữ Atlas free tier không overflow
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 14400 })

// Zone events — không xóa, dùng cho báo cáo
const zoneEventSchema = new mongoose.Schema({
  tag_id:           { type: String, required: true },
  zone_id:          { type: String, required: true },
  zone_name:        { type: String, required: true },
  entered_at:       { type: Date,   required: true },
  exited_at:        { type: Date,   default: null },
  duration_seconds: { type: Number, default: null }
})
// Tự xóa sau 7 ngày
zoneEventSchema.index({ entered_at: 1 }, { expireAfterSeconds: 604800 })

// Zone configurations — lưu cấu hình các khu vực
const zoneSchema = new mongoose.Schema({
  id:                      { type: String, required: true, unique: true },
  name:                    { type: String, required: true },
  color:                   { type: String, required: true },
  alert_threshold_seconds: { type: Number, default: null },
  polygon:                 [{ x: { type: Number, required: true }, y: { type: Number, required: true } }]
})

// Employee configurations — lưu cấu hình nhân viên (tags)
const employeeSchema = new mongoose.Schema({
  tag_id: { type: String, required: true, unique: true },
  name:   { type: String, required: true },
  color:  { type: String, required: true }
})

// ── MỚI: Anchor nodes — vị trí các anten UWB cố định trên mặt bằng
const anchorSchema = new mongoose.Schema({
  id:     { type: String, required: true, unique: true },
  name:   { type: String, required: true },
  x:      { type: Number, required: true },
  y:      { type: Number, required: true },
  active: { type: Boolean, default: true }
})

// ── MỚI: Attendance Log — chấm công tự động theo ngày
const attendanceSchema = new mongoose.Schema({
  tag_id:               { type: String, required: true },
  date:                 { type: String, required: true }, // 'YYYY-MM-DD'
  first_seen:           { type: Date,   required: true },
  last_seen:            { type: Date,   required: true },
  total_active_seconds: { type: Number, default: 0 }
})
attendanceSchema.index({ tag_id: 1, date: 1 }, { unique: true })

// ── MỚI: Zone Access Control — whitelist/blacklist nhân viên theo zone
const zoneAccessSchema = new mongoose.Schema({
  zone_id: { type: String, required: true },
  tag_id:  { type: String, required: true },
  allowed: { type: Boolean, default: false } // false = cấm vào zone này
})
zoneAccessSchema.index({ zone_id: 1, tag_id: 1 }, { unique: true })

export const Location    = mongoose.model('Location',    locationSchema)
export const ZoneEvent   = mongoose.model('ZoneEvent',   zoneEventSchema)
export const Zone        = mongoose.model('Zone',        zoneSchema)
export const Employee    = mongoose.model('Employee',    employeeSchema)
export const Anchor      = mongoose.model('Anchor',      anchorSchema)
export const Attendance  = mongoose.model('Attendance',  attendanceSchema)
export const ZoneAccess  = mongoose.model('ZoneAccess',  zoneAccessSchema)