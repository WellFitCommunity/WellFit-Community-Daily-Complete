# Security Headers & Deployment Checklist

✅ **CSP (Content-Security-Policy)**  
- Served via `public/_headers` on Vercel.
- Allows Supabase + hCaptcha, blocks everything else.

✅ **HSTS**  
- Enforced: `max-age=63072000; includeSubDomains; preload`.

✅ **X-Frame-Options**  
- `DENY` (no embedding).

✅ **Referrer-Policy**  
- `strict-origin-when-cross-origin`.

✅ **Permissions-Policy**  
- Blocks camera, microphone, geolocation by default.

✅ **Cross-Origin Headers**  
- `COOP` = same-origin.  
- `CORP` = same-origin.

---

## Deployment Checklist

- [ ] Add `REACT_APP_HCAPTCHA_SITE_KEY` in Vercel Project Settings (matches your Prod sitekey).  
- [ ] Add Supabase URL + anon key in Vercel Project Settings.  
- [ ] Ensure hCaptcha allowlist includes:  
  - `*.vercel.app`  
  - `your-real-domain.com`  
- [ ] Re-enable `<link rel="manifest" href="/manifest.json">` in `public/index.html` (PWA).  
- [ ] Smoke test:  
  - Register flow works.  
  - Admin login works.  
  - Meals table loads.  
  - Self-report works.
