"use strict";
const zlib = require("node:zlib");
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const label = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  label.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([label, data])), data.length + 8);
  return result;
}
function skinPng({ height = 64, color = [48, 152, 172], opaqueHat = false } = {}) {
  const rows = Buffer.alloc((64 * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < 64; x++) {
      const offset = y * 257 + 1 + x * 4;
      const rgb = opaqueHat && x >= 32 && y < 16 ? [0, 0, 0] : y < 16 ? [188, 137, 106] : color;
      rows.set(rgb, offset);
      rows[offset + 3] = height === 64 && x >= 56 && y < 8 ? 0 : 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(64); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
module.exports = { skinPng };
