export function u16be(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}
export function u32be(n) {
  return [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
export function u16le(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}
export function u32le(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildPngChunk(type, data) {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const crc = crc32(Uint8Array.from([...typeBytes, ...data]));
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc)];
}

// chunks: array de { type, data }. A assinatura PNG é adicionada automaticamente.
export function buildPng(chunks) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const out = [...sig];
  for (const c of chunks) out.push(...buildPngChunk(c.type, c.data));
  return Uint8Array.from(out);
}

// Monta um payload EXIF APP1 ("Exif\0\0" + TIFF little-endian).
// Por design, todos os valores ASCII têm >4 bytes (vão para a área de dados via offset).
// gps (opcional): { lat: [[d,1],[m,1],[s,1]], latRef: 'N'|'S', lon: [...], lonRef: 'E'|'W' }
export function buildExif({
  make = 'Canon',
  model = 'EOS 5D Mark IV',
  software = 'Adobe Lightroom',
  dateTime = '2024:01:15 10:30:00',
  gps,
} = {}) {
  const asciiEntries = [];
  const asciiTag = (tag, str) => {
    const bytes = [...str].map((c) => c.charCodeAt(0));
    bytes.push(0);
    asciiEntries.push({ tag, type: 2, count: bytes.length, bytes });
  };
  asciiTag(0x010f, make);
  asciiTag(0x0110, model);
  asciiTag(0x0131, software);
  asciiTag(0x0132, dateTime);

  const hasGps = !!gps;
  const ifd0Count = asciiEntries.length + (hasGps ? 1 : 0);
  const ifd0Start = 8;
  const ifd0Size = 2 + 12 * ifd0Count + 4;
  let cursor = ifd0Start + ifd0Size;
  let gpsIfdStart = 0;
  if (hasGps) {
    gpsIfdStart = cursor;
    cursor += 2 + 12 * 4 + 4; // 4 entradas + next-offset
  }
  const dataStart = cursor;

  const dataBytes = [];
  const putData = (bytes) => {
    const off = dataStart + dataBytes.length;
    dataBytes.push(...bytes);
    return off;
  };
  for (const e of asciiEntries) e.valueOffset = putData(e.bytes);

  let gpsLatOff = 0,
    gpsLonOff = 0;
  if (hasGps) {
    const rat = (arr) => arr.flatMap(([n, d]) => [...u32le(n), ...u32le(d)]);
    gpsLatOff = putData(rat(gps.lat));
    gpsLonOff = putData(rat(gps.lon));
  }

  const header = [0x49, 0x49, ...u16le(0x2a), ...u32le(8)];
  const ifd0 = [...u16le(ifd0Count)];
  const entry = (tag, type, count, v4) =>
    ifd0.push(...u16le(tag), ...u16le(type), ...u32le(count), ...v4);
  for (const e of asciiEntries) entry(e.tag, e.type, e.count, u32le(e.valueOffset));
  if (hasGps) entry(0x8825, 4, 1, u32le(gpsIfdStart));
  ifd0.push(...u32le(0));

  const gpsIfd = [];
  if (hasGps) {
    gpsIfd.push(...u16le(4));
    const ge = (tag, type, count, v4) =>
      gpsIfd.push(...u16le(tag), ...u16le(type), ...u32le(count), ...v4);
    const ref = (s) => [s.charCodeAt(0), 0, 0, 0];
    ge(0x0001, 2, 2, ref(gps.latRef));
    ge(0x0002, 5, 3, u32le(gpsLatOff));
    ge(0x0003, 2, 2, ref(gps.lonRef));
    ge(0x0004, 5, 3, u32le(gpsLonOff));
    gpsIfd.push(...u32le(0));
  }

  const tiff = [...header, ...ifd0, ...gpsIfd, ...dataBytes];
  const prefix = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
  return Uint8Array.from([...prefix, ...tiff]);
}

// Monta um segmento JPEG: 0xFF, marker, length(2, inclui os 2 bytes), payload.
export function buildJpegSegment(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}

// segments: array de { marker, payload }. SOI, SOS+scan e EOI são adicionados.
export function buildJpeg(segments, scan = [0x12, 0x34, 0x56, 0x78]) {
  const out = [0xff, 0xd8]; // SOI
  for (const s of segments) out.push(...buildJpegSegment(s.marker, s.payload));
  out.push(...buildJpegSegment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])); // SOS header mínimo
  out.push(...scan);
  out.push(0xff, 0xd9); // EOI
  return Uint8Array.from(out);
}
