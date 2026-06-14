import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concat } from '../js/bytes.js';

test('concat: dois Uint8Arrays não-vazios concatenam na ordem correta', () => {
  const a = Uint8Array.from([0x01, 0x02, 0x03]);
  const b = Uint8Array.from([0x04, 0x05]);
  const result = concat([a, b]);
  assert.equal(result.length, 5);
  assert.deepEqual(Array.from(result), [0x01, 0x02, 0x03, 0x04, 0x05]);
});

test('concat: array vazio retorna Uint8Array de comprimento zero', () => {
  const result = concat([]);
  assert.equal(result.length, 0);
  assert.deepEqual(Array.from(result), []);
});

test('concat: uma única parte retorna seu conteúdo inalterado', () => {
  const a = Uint8Array.from([0xaa, 0xbb, 0xcc]);
  const result = concat([a]);
  assert.equal(result.length, 3);
  assert.deepEqual(Array.from(result), [0xaa, 0xbb, 0xcc]);
});

test('concat: mix incluindo um Uint8Array de comprimento zero é tratado corretamente', () => {
  const a = Uint8Array.from([0x10, 0x20]);
  const empty = new Uint8Array(0);
  const b = Uint8Array.from([0x30]);
  const result = concat([a, empty, b]);
  assert.equal(result.length, 3);
  assert.deepEqual(Array.from(result), [0x10, 0x20, 0x30]);
});
