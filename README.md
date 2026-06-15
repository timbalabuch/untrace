# Untrace

**Share photos, not your metadata.**

Strips metadata (EXIF, GPS, XMP, IPTC, C2PA, comments, hidden markers) from JPEG and
PNG images — **without altering image quality** (pixels stay byte-for-byte identical).
100% client-side; images never leave your browser.

## Run locally

ES modules don't load over `file://`, so use a static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Tests

```bash
npm install   # dev tooling (ESLint/Prettier)
npm test      # parsing logic
npm run lint
```

## Deploy

It's a static site — upload `index.html`, `css/`, `js/`, `vendor/`, the icons,
`robots.txt` and `sitemap.xml` to any static host and serve over HTTPS.
