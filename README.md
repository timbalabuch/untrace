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

## Deploy (Nginx VPS)

1. Edit `deploy/nginx.conf` — set `server_name` and `root`; install the server block, then `certbot --nginx -d <subdomain>`.
2. Push the static files:

```bash
SSH_HOST=user@server REMOTE_ROOT=/var/www/untrace ./deploy/deploy.sh
```
