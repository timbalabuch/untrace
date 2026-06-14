// entries: array of { name: string, bytes: Uint8Array }. Returns a ZIP Blob.
// JSZip is a browser global from vendor/jszip.min.js (declared in eslint.config.js).
export async function buildZip(entries) {
  const zip = new JSZip();
  for (const { name, bytes } of entries) {
    zip.file(name, bytes);
  }
  return zip.generateAsync({ type: 'blob' });
}
