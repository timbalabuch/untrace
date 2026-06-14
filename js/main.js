import { detectFormat } from './detect.js';
import { cleanJpeg } from './parsers/jpeg.js';
import { cleanPng } from './parsers/png.js';
import { buildZip } from './bundle.js';

const $ = (id) => document.getElementById(id);
const dropEl = $('drop');
const fileInput = $('file');
const resultsEl = $('results');
const actionsEl = $('actions');
const downloadAllBtn = $('download-all');

const cleaned = [];

function addCleaned(name, bytes) {
  const i = cleaned.findIndex((c) => c.name === name);
  if (i >= 0) cleaned[i] = { name, bytes };
  else cleaned.push({ name, bytes });
}

function tag(text) {
  const el = document.createElement('span');
  el.className = 'tag';
  el.textContent = text;
  return el;
}

function skipped(name, message) {
  const li = document.createElement('li');
  li.className = 'card skipped';
  const mid = document.createElement('div');
  const n = document.createElement('div');
  n.className = 'name';
  n.textContent = name;
  const p = document.createElement('p');
  p.className = 'found';
  p.textContent = message;
  mid.append(n, p);
  li.append(document.createElement('span'), mid, document.createElement('span'));
  resultsEl.append(li);
}

function downloadLink(label, name, bytes, type) {
  const blob = new Blob([bytes], { type });
  const a = document.createElement('a');
  a.className = 'btn';
  a.textContent = label;
  a.download = name;
  a.href = '#';
  a.addEventListener('click', () => {
    const u = URL.createObjectURL(blob);
    a.href = u;
    setTimeout(() => URL.revokeObjectURL(u), 0);
  });
  return a;
}

async function handleFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(buf);
  if (!format) {
    skipped(file.name, 'Skipped: unsupported format (JPEG and PNG only).');
    return;
  }
  let result;
  try {
    result = format === 'jpeg' ? cleanJpeg(buf) : cleanPng(buf);
  } catch (err) {
    skipped(file.name, `Processing error: ${err.message}`);
    return;
  }
  const outName = file.name.replace(/(\.[^.]+)$/, '-clean$1');
  addCleaned(outName, result.cleanedBytes);

  const li = document.createElement('li');
  li.className = 'card';
  const blob = new Blob([result.cleanedBytes], { type: file.type });
  const img = document.createElement('img');
  const u = URL.createObjectURL(blob);
  img.src = u;
  img.alt = '';
  img.addEventListener('load', () => URL.revokeObjectURL(u), { once: true });
  const mid = document.createElement('div');
  const n = document.createElement('div');
  n.className = 'name';
  n.textContent = file.name;
  const found = document.createElement('p');
  found.className = 'found';
  if (result.summary.length) {
    for (const s of result.summary) found.append(tag(s.value ? `${s.label}: ${s.value}` : s.label));
  } else {
    found.append(tag('No metadata found'));
  }
  mid.append(n, found);
  li.append(img, mid, downloadLink('Download', outName, result.cleanedBytes, file.type));
  resultsEl.append(li);
}

async function handleFiles(files) {
  for (const file of files) await handleFile(file);
  if (cleaned.length) actionsEl.hidden = false;
}

['dragenter', 'dragover'].forEach((e) =>
  dropEl.addEventListener(e, (ev) => {
    ev.preventDefault();
    dropEl.classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((e) =>
  dropEl.addEventListener(e, (ev) => {
    ev.preventDefault();
    dropEl.classList.remove('over');
  }),
);
dropEl.addEventListener('drop', (ev) => handleFiles(ev.dataTransfer.files));
fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

downloadAllBtn.addEventListener('click', async () => {
  const blob = await buildZip(cleaned);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'untrace.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
