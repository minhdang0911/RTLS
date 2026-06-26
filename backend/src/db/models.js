import mongoose from 'mongoose'

// Lưu tọa độ raw — TTL 1 ngày tự xóa
const locationSchema = new mongoose.Schema({
  tag_id:    { type: String, required: true },
  x:         { type: Number, required: true },
  y:         { type: Number, required: true },
  zone_id:   { type: String, default: null },
  timestamp: { type: Date,   default: Date.now }
})
// Tự xóa sau 1 ngày
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 })

// Zone events — không xóa, dùng cho báo cáo
const zoneEventSchema = new mongoose.Schema({
  tag_id:           { type: String, required: true },
  zone_id:          { type: String, required: true },
  zone_name:        { type: String, required: true },
  entered_at:       { type: Date,   required: true },
  exited_at:        { type: Date,   default: null },
  duration_seconds: { type: Number, default: null }
})

export const Location  = mongoose.model('Location',  locationSchema)
export const ZoneEvent = mongoose.model('ZoneEvent', zoneEventSchema)