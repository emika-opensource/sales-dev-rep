# SDR Tools — API Reference

## CRITICAL: Port 3000 Only
You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.
NEVER use port 3001, 8080, or any other port. ONLY port 3000.

## ⚠️ IMPORTANT: Port 3000

Your **Sales Dashboard** web application is ALREADY RUNNING on port 3000. It starts automatically via start.sh.

- **DO NOT** kill anything on port 3000 — that is YOUR app
- **DO NOT** try to start a new server on port 3000
- The app is accessible to the user via the browser panel (iframe)
- If you need to build something for the user, deploy it on a DIFFERENT port using PM2


## Prospects
```
GET    /api/prospects?search=&status=&icp=&sort=&limit=&offset=
POST   /api/prospects              { firstName, lastName, email, phone, title, company, ... }
PUT    /api/prospects/:id          { field: value, ... }
DELETE /api/prospects/:id
DELETE /api/prospects               { ids: [id1, id2, ...] }
POST   /api/prospects/import       multipart/form-data, field: file (.csv) → { imported, duplicates }
POST   /api/prospects/enrich       { prospectIds: [] } (Apollo only)
POST   /api/prospects/bulk         { prospects: [{...}, ...] } (with dedup)
```

## Search
```
POST   /api/search                 { query, filters: { titles[], locations[], companySizes[] } }
```

## ICPs
```
GET    /api/icps
POST   /api/icps                   { name, description, criteria: { industries[], titles[], locations[], companySizes[], techStack[] }, color }
PUT    /api/icps/:id
DELETE /api/icps/:id
```

## Campaigns
```
GET    /api/campaigns
POST   /api/campaigns              { name, icpId, steps: [{ order, subject, body, delayDays }] }
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/prospects { prospectIds: [] }
```

## Templates
```
GET    /api/templates
POST   /api/templates              { name, category, subject, body, mergeFields[] }
PUT    /api/templates/:id
DELETE /api/templates/:id
```
Categories: cold-intro, follow-up, breakup, referral, event

## Config & Status
```
GET    /api/config
PUT    /api/config                 { apiKeys: { apollo }, senderEmail, senderName }
POST   /api/config/validate-apollo { apiKey } → { valid, error }
GET    /api/status                 → { isFirstRun, prospectCount, icpCount, hasApiKey }
GET    /api/analytics
POST   /api/sample-data            → loads 25 sample prospects
```

## Screenshots & File Sharing

### Taking Screenshots
Use Playwright (pre-installed) to capture any website:
```bash
npx playwright screenshot --browser chromium https://example.com /tmp/screenshot.png
```

If Chromium is not installed yet, install it first:
```bash
npx playwright install chromium
```

### Sharing Files & Images with the User
Upload to the Emika API to get a shareable URL:
```bash
# Get your seat token

You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.
NEVER use port 3001, 8080, or any other port. ONLY port 3000.
TOKEN=$(python3 -c "import json; print(json.load(open('/home/node/.openclaw/openclaw.json'))['gateway']['auth']['token'])")

# Upload any file

You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.
NEVER use port 3001, 8080, or any other port. ONLY port 3000.
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | python3 -c "import sys,json; print(json.load(sys.stdin)['full_url'])")

# Include the URL in your response as markdown image

You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.
NEVER use port 3001, 8080, or any other port. ONLY port 3000.
echo "![Screenshot]($URL)"
```

**IMPORTANT:**
- Do NOT use the `read` tool on image files — it sends the image to the AI model but does NOT display it to the user
- Always upload files and share the URL instead
- The URL format is `https://api.emika.ai/uploads/seats/<filename>`
- Supports: images, PDFs, documents, code files, archives (max 50MB)
