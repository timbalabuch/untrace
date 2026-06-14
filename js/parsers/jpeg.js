import { concat } from '../bytes.js';
import { parseExif } from '../exif.js';

const SOS = 0xda;
const EOI = 0xd9;

// Structural segments (frame/tables/scan) that must be kept.
function isStructural(m) {
  if (m === 0xdb || m === 0xc4 || m === 0xdd) return true; // DQT, DHT, DRI
  if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return true; // SOF0..15
  return false;
}

function startsWith(bytes, off, ascii) {
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[off + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

export function cleanJpeg(bytes) {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error('Not a valid JPEG');
  const parts = [bytes.subarray(0, 2)]; // SOI
  const summary = [];
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      parts.push(bytes.subarray(pos));
      break;
    }
    const marker = bytes[pos + 1];
    if (marker === SOS) {
      parts.push(bytes.subarray(pos));
      break;
    } // SOS + scan + everything to the end
    if (marker === EOI) {
      parts.push(bytes.subarray(pos, pos + 2));
      break;
    }
    const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const segEnd = pos + 2 + len;
    const payloadOff = pos + 4;
    const payloadLen = len - 2;
    if (len < 2 || segEnd > bytes.length) {
      parts.push(bytes.subarray(pos));
      break;
    } // malformed
    if (isStructural(marker)) {
      parts.push(bytes.subarray(pos, segEnd));
    } else if (marker === 0xe0 && startsWith(bytes, payloadOff, 'JFIF\0')) {
      parts.push(bytes.subarray(pos, segEnd)); // APP0 JFIF
    } else if (marker === 0xe2 && startsWith(bytes, payloadOff, 'ICC_PROFILE\0')) {
      parts.push(bytes.subarray(pos, segEnd)); // APP2 ICC
    } else {
      recordSegment(marker, bytes, payloadOff, payloadLen, summary);
    }
    pos = segEnd;
  }
  return { summary, cleanedBytes: concat(parts) };
}

function recordSegment(marker, bytes, payloadOff, payloadLen, summary) {
  if (marker === 0xe1 && startsWith(bytes, payloadOff, 'Exif\0\0')) {
    const exif = parseExif(bytes.subarray(payloadOff, payloadOff + payloadLen));
    const name = [exif.make, exif.model].filter(Boolean).join(' ');
    if (name) summary.push({ category: 'camera', label: 'Camera', value: name });
    if (exif.dateTime) summary.push({ category: 'date', label: 'Date/time', value: exif.dateTime });
    if (exif.software)
      summary.push({ category: 'software', label: 'Software', value: exif.software });
    if (exif.gps)
      summary.push({
        category: 'gps',
        label: 'GPS location',
        value: `${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)}`,
      });
    if (!name && !exif.dateTime && !exif.software && !exif.gps)
      summary.push({ category: 'exif', label: 'EXIF data' });
  } else if (marker === 0xe1 && startsWith(bytes, payloadOff, 'http://ns.adobe.com/')) {
    summary.push({ category: 'xmp', label: 'XMP tags' });
  } else if (marker === 0xed && startsWith(bytes, payloadOff, 'Photoshop 3.0')) {
    summary.push({ category: 'iptc', label: 'IPTC data' });
  } else if (marker === 0xeb) {
    summary.push({ category: 'c2pa', label: 'C2PA manifest' });
  } else if (marker === 0xfe) {
    summary.push({ category: 'comment', label: 'Comment' });
  } else if (marker >= 0xe0 && marker <= 0xef) {
    summary.push({ category: 'metadata', label: `APP${marker - 0xe0} marker` });
  }
}
