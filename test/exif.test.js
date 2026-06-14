import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExif } from '../js/exif.js';
import { buildExif } from '../fixtures/byte-builders.js';

test('extrai câmera, software e data', () => {
  const payload = buildExif({
    make: 'Canon',
    model: 'EOS 5D Mark IV',
    software: 'Adobe Lightroom',
    dateTime: '2024:01:15 10:30:00',
  });
  const r = parseExif(payload);
  assert.equal(r.make, 'Canon');
  assert.equal(r.model, 'EOS 5D Mark IV');
  assert.equal(r.software, 'Adobe Lightroom');
  assert.equal(r.dateTime, '2024:01:15 10:30:00');
});

test('extrai coordenadas GPS com sinal correto', () => {
  const payload = buildExif({
    gps: {
      lat: [
        [40, 1],
        [44, 1],
        [54, 1],
      ],
      latRef: 'N',
      lon: [
        [73, 1],
        [59, 1],
        [8, 1],
      ],
      lonRef: 'W',
    },
  });
  const r = parseExif(payload);
  assert.ok(Math.abs(r.gps.lat - 40.748333) < 1e-4);
  assert.ok(Math.abs(r.gps.lon - -73.985556) < 1e-4);
});

test('payload inválido retorna objeto vazio', () => {
  assert.deepEqual(parseExif(Uint8Array.from([1, 2, 3])), {});
});

test('payload truncado não inventa GPS nem campos vazios', () => {
  const full = buildExif({
    make: 'Canon',
    gps: {
      lat: [
        [40, 1],
        [44, 1],
        [54, 1],
      ],
      latRef: 'N',
      lon: [
        [73, 1],
        [59, 1],
        [8, 1],
      ],
      lonRef: 'W',
    },
  });
  const truncated = full.subarray(0, Math.floor(full.length * 0.6));
  const r = parseExif(truncated);
  assert.equal(r.gps, undefined);
  for (const v of Object.values(r)) assert.notEqual(v, '');
});
