// Minimal EXIF reader: extracts only the fields shown in the transparency view.
export function parseExif(payload) {
  const result = {};
  if (payload.length < 14) return result;
  const tiff = payload.subarray(6); // skip "Exif\0\0"
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) return result;

  const u16 = (o) => (le ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1]);
  const u32 = (o) =>
    (le
      ? tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] * 0x1000000)
      : (tiff[o] * 0x1000000) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3]) >>> 0;

  if (u16(2) !== 0x002a) return result;

  const ascii = (off, count) => {
    let s = '';
    for (let i = 0; i < count; i++) {
      const c = tiff[off + i];
      if (c === 0 || off + i >= tiff.length) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  };
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const valueOffset = (entryValOff, type, count) => {
    const byteLen = (TYPE_SIZE[type] || 1) * count;
    return byteLen <= 4 ? entryValOff : u32(entryValOff);
  };
  const readEntries = (ifdOff, handler) => {
    if (ifdOff <= 0 || ifdOff + 2 > tiff.length) return;
    const n = u16(ifdOff);
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      if (e + 12 > tiff.length) break;
      handler(u16(e), u16(e + 2), u32(e + 4), e + 8);
    }
  };
  const readRational3 = (entryValOff) => {
    const base = u32(entryValOff);
    if (base + 24 > tiff.length) return null; // 3 rationals × 8 bytes don't fit
    const out = [];
    for (let i = 0; i < 3; i++) {
      const num = u32(base + i * 8);
      const den = u32(base + i * 8 + 4);
      out.push(den === 0 ? 0 : num / den);
    }
    return out;
  };
  const dms = ([d, m, s]) => d + m / 60 + s / 3600;

  let exifIfdPtr = 0,
    gpsIfdPtr = 0;
  readEntries(u32(4), (tag, type, count, valOff) => {
    if (tag === 0x010f) {
      const s = ascii(valueOffset(valOff, type, count), count);
      if (s) result.make = s;
    } else if (tag === 0x0110) {
      const s = ascii(valueOffset(valOff, type, count), count);
      if (s) result.model = s;
    } else if (tag === 0x0131) {
      const s = ascii(valueOffset(valOff, type, count), count);
      if (s) result.software = s;
    } else if (tag === 0x0132) {
      const s = ascii(valueOffset(valOff, type, count), count);
      if (s) result.dateTime = s;
    } else if (tag === 0x8769) exifIfdPtr = u32(valOff);
    else if (tag === 0x8825) gpsIfdPtr = u32(valOff);
  });

  if (exifIfdPtr) {
    readEntries(exifIfdPtr, (tag, type, count, valOff) => {
      if (tag === 0x9003 && !result.dateTime) {
        const s = ascii(valueOffset(valOff, type, count), count);
        if (s) result.dateTime = s;
      }
    });
  }

  if (gpsIfdPtr) {
    const gps = {};
    readEntries(gpsIfdPtr, (tag, type, count, valOff) => {
      if (tag === 0x0001) gps.latRef = ascii(valOff, 2);
      else if (tag === 0x0003) gps.lonRef = ascii(valOff, 2);
      else if (tag === 0x0002) gps.lat = readRational3(valOff);
      else if (tag === 0x0004) gps.lon = readRational3(valOff);
    });
    if (gps.lat != null && gps.lon != null) {
      let lat = dms(gps.lat);
      let lon = dms(gps.lon);
      if (gps.latRef === 'S') lat = -lat;
      if (gps.lonRef === 'W') lon = -lon;
      result.gps = { lat, lon };
    }
  }

  return result;
}
