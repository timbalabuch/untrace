import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat } from '../js/detect.js';

test('detecta JPEG pelos magic bytes', () => {
  assert.equal(detectFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
});

test('detecta PNG pela assinatura', () => {
  assert.equal(
    detectFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'png',
  );
});

test('retorna null para formato desconhecido', () => {
  assert.equal(detectFormat(Uint8Array.from([0x00, 0x01, 0x02, 0x03])), null);
});
