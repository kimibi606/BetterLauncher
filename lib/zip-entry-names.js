"use strict";

const { crc32 } = require("adm-zip/util");
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const korean = new TextDecoder("euc-kr", { fatal: true, ignoreBOM: true });

function decodeZipEntryName(entry) {
  const raw = entry.rawEntryName;
  if (!Buffer.isBuffer(raw)) throw new Error("ZIP filename bytes are missing.");
  if (entry.header.flags & 0x800) return utf8.decode(raw);
  const extra = entry.extra || Buffer.alloc(0);
  let unicodeName;
  for (let offset = 0; offset + 4 <= extra.length;) {
    const type = extra.readUInt16LE(offset), size = extra.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > extra.length) throw new Error("Invalid ZIP filename extra field.");
    if (type === 0x7075 && size >= 5 && extra[offset] === 1 && extra.readUInt32LE(offset + 1) === (crc32(raw) >>> 0)) {
      const name = utf8.decode(extra.subarray(offset + 5, offset + size));
      if (unicodeName !== undefined && unicodeName !== name) throw new Error("Conflicting ZIP Unicode filenames.");
      unicodeName = name;
    }
    offset += size;
  }
  if (unicodeName !== undefined) return unicodeName;
  try { return utf8.decode(raw); } catch { return korean.decode(raw); }
}

module.exports = { decodeZipEntryName };
