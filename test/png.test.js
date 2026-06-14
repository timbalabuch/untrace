import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPng } from '../js/parsers/png.js';
import { buildPng } from '../fixtures/byte-builders.js';

function chunkTypes(bytes) {
  const types = [];
  let pos = 8;
  while (pos < bytes.length) {
    const len =
      bytes[pos] * 0x1000000 + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3];
    types.push(String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]));
    pos += 12 + len;
  }
  return types;
}

test('mantém chunks essenciais e de cor, remove o resto', () => {
  const png = buildPng([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0] },
    { type: 'tEXt', data: [...'Comment\0segredo'].map((c) => c.charCodeAt(0)) },
    { type: 'iCCP', data: [0x69, 0x63, 0x63, 0, 0, 0x78, 0x9c] },
    { type: 'IDAT', data: [0x78, 0x9c, 0x62, 0x00, 0x00] },
    { type: 'tIME', data: [0x07, 0xe8, 1, 1, 0, 0, 0] },
    { type: 'IEND', data: [] },
  ]);
  const { cleanedBytes } = cleanPng(png);
  assert.deepEqual(chunkTypes(cleanedBytes), ['IHDR', 'iCCP', 'IDAT', 'IEND']);
});

test('reporta os metadados encontrados no summary', () => {
  const png = buildPng([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0] },
    { type: 'tEXt', data: [...'k\0v'].map((c) => c.charCodeAt(0)) },
    { type: 'tIME', data: [0x07, 0xe8, 1, 1, 0, 0, 0] },
    { type: 'IDAT', data: [0x78, 0x9c] },
    { type: 'IEND', data: [] },
  ]);
  const { summary } = cleanPng(png);
  const cats = summary.map((s) => s.category);
  assert.ok(cats.includes('comment'));
  assert.ok(cats.includes('date'));
});

test('IDAT permanece idêntico byte a byte', () => {
  const idat = [0x78, 0x9c, 0x01, 0x02, 0x03, 0x04];
  const png = buildPng([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0] },
    { type: 'tEXt', data: [...'a\0b'].map((c) => c.charCodeAt(0)) },
    { type: 'IDAT', data: idat },
    { type: 'IEND', data: [] },
  ]);
  const { cleanedBytes } = cleanPng(png);
  let pos = 8,
    found = null;
  while (pos < cleanedBytes.length) {
    const len =
      cleanedBytes[pos] * 0x1000000 +
      (cleanedBytes[pos + 1] << 16) +
      (cleanedBytes[pos + 2] << 8) +
      cleanedBytes[pos + 3];
    const type = String.fromCharCode(
      cleanedBytes[pos + 4],
      cleanedBytes[pos + 5],
      cleanedBytes[pos + 6],
      cleanedBytes[pos + 7],
    );
    if (type === 'IDAT') found = Array.from(cleanedBytes.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  assert.deepEqual(found, idat);
});

test('rotula o manifesto C2PA (chunk caBX) no summary', () => {
  const png = buildPng([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0] },
    { type: 'caBX', data: [...'jumbf c2pa'].map((c) => c.charCodeAt(0)) },
    { type: 'IDAT', data: [0x78, 0x9c] },
    { type: 'IEND', data: [] },
  ]);
  const cats = cleanPng(png).summary.map((s) => s.category);
  assert.ok(cats.includes('c2pa'));
});
