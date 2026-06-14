import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanJpeg } from '../js/parsers/jpeg.js';
import { buildJpeg, buildExif } from '../fixtures/byte-builders.js';

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

function markers(bytes) {
  const found = [];
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos += 1;
      continue;
    }
    const m = bytes[pos + 1];
    found.push(m);
    if (m === 0xda || m === 0xd9) break; // SOS / EOI: para
    const len = (bytes[pos + 2] << 8) | bytes[pos + 3];
    pos += 2 + len;
  }
  return found;
}

test('mantém segmentos estruturais e ICC, remove EXIF e COM', () => {
  const exif = Array.from(buildExif({ make: 'Canon' }));
  const icc = ascii('ICC_PROFILE\0').concat([0, 0]);
  const jpeg = buildJpeg([
    { marker: 0xdb, payload: [0, 1, 2, 3] }, // DQT (mantém)
    { marker: 0xe1, payload: exif }, // APP1 EXIF (remove)
    { marker: 0xe2, payload: icc }, // APP2 ICC (mantém)
    { marker: 0xc4, payload: [0, 1, 2] }, // DHT (mantém)
    { marker: 0xc0, payload: [8, 0, 1, 0, 1, 1] }, // SOF0 (mantém)
    { marker: 0xfe, payload: ascii('comentário') }, // COM (remove)
  ]);
  const { cleanedBytes } = cleanJpeg(jpeg);
  const m = markers(cleanedBytes);
  assert.ok(m.includes(0xdb) && m.includes(0xc4) && m.includes(0xc0) && m.includes(0xe2));
  assert.ok(!m.includes(0xe1)); // EXIF removido
  assert.ok(!m.includes(0xfe)); // comentário removido
  assert.ok(m.includes(0xda)); // SOS presente
});

test('o scan data permanece idêntico byte a byte', () => {
  const scan = [0xaa, 0xbb, 0xcc, 0xdd, 0xee];
  const jpeg = buildJpeg([{ marker: 0xe1, payload: Array.from(buildExif({})) }], scan);
  const { cleanedBytes } = cleanJpeg(jpeg);
  const tail = Array.from(cleanedBytes.subarray(cleanedBytes.length - 7));
  assert.deepEqual(tail, [...scan, 0xff, 0xd9]); // scan + EOI
});

test('o summary decodifica o que foi encontrado no EXIF', () => {
  const jpeg = buildJpeg([
    {
      marker: 0xe1,
      payload: Array.from(
        buildExif({
          make: 'Nikon',
          model: 'Z6',
          gps: {
            lat: [
              [10, 1],
              [0, 1],
              [0, 1],
            ],
            latRef: 'S',
            lon: [
              [20, 1],
              [0, 1],
              [0, 1],
            ],
            lonRef: 'W',
          },
        }),
      ),
    },
  ]);
  const { summary } = cleanJpeg(jpeg);
  const cats = summary.map((s) => s.category);
  assert.ok(cats.includes('camera'));
  assert.ok(cats.includes('gps'));
});

test('summary classifica XMP, IPTC e comentário', () => {
  const xmp = ascii('http://ns.adobe.com/xap/1.0/\0').concat(ascii('<x:xmpmeta/>'));
  const iptc = ascii('Photoshop 3.0\0').concat([0, 0, 0]);
  const jpeg = buildJpeg([
    { marker: 0xe1, payload: xmp }, // APP1 XMP
    { marker: 0xed, payload: iptc }, // APP13 IPTC
    { marker: 0xfe, payload: ascii('oi') }, // COM
  ]);
  const cats = cleanJpeg(jpeg).summary.map((s) => s.category);
  assert.ok(cats.includes('xmp'));
  assert.ok(cats.includes('iptc'));
  assert.ok(cats.includes('comment'));
});

test('Extended XMP também é rotulado como XMP', () => {
  const ext = ascii('http://ns.adobe.com/xmp/extension/\0').concat([1, 2, 3]);
  const jpeg = buildJpeg([{ marker: 0xe1, payload: ext }]);
  const cats = cleanJpeg(jpeg).summary.map((s) => s.category);
  assert.ok(cats.includes('xmp'));
});

test('lança erro para SOI inválido', () => {
  assert.throws(() => cleanJpeg(Uint8Array.from([0x00, 0x11, 0x22])), /JPEG/);
});

test('JPEG sem EOI ainda preserva o scan data (passthrough lossless)', () => {
  const scan = [0x11, 0x22, 0x33, 0x44];
  const full = buildJpeg([{ marker: 0xe1, payload: Array.from(buildExif({})) }], scan);
  const noEoi = full.subarray(0, full.length - 2); // remove o FF D9 (EOI)
  const { cleanedBytes } = cleanJpeg(noEoi);
  const tail = Array.from(cleanedBytes.subarray(cleanedBytes.length - scan.length));
  assert.deepEqual(tail, scan);
});
