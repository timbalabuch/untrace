import { concat } from '../bytes.js';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'iCCP', 'gAMA', 'cHRM', 'sRGB']);
const META = {
  tEXt: { category: 'comment', label: 'Text/comment' },
  zTXt: { category: 'comment', label: 'Text/comment' },
  iTXt: { category: 'xmp', label: 'Text/XMP' },
  eXIf: { category: 'exif', label: 'EXIF data' },
  tIME: { category: 'date', label: 'Modification date' },
  caBX: { category: 'c2pa', label: 'C2PA manifest' },
};

export function cleanPng(bytes) {
  if (!PNG_SIG.every((b, i) => bytes[i] === b)) throw new Error('Not a valid PNG');
  const parts = [bytes.subarray(0, 8)];
  const summary = [];
  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const len =
      bytes[pos] * 0x1000000 + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3];
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7],
    );
    const chunkEnd = pos + 12 + len;
    if (chunkEnd > bytes.length) break; // malformed file: length exceeds the data
    if (KEEP.has(type)) {
      parts.push(bytes.subarray(pos, chunkEnd));
    } else if (META[type]) {
      summary.push({ ...META[type] });
    }
    if (type === 'IEND') break;
    pos = chunkEnd;
  }
  return { summary, cleanedBytes: concat(parts) };
}
