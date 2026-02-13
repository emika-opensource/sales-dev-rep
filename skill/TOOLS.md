# SDR Tools — API Reference

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


## Browser & Screenshots (Playwright)

Playwright and Chromium are pre-installed. Use them for browsing websites, taking screenshots, scraping content, and testing.

```bash
# Quick screenshot
npx playwright screenshot --full-page https://example.com screenshot.png

# In Node.js
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://example.com");
await page.screenshot({ path: "screenshot.png", fullPage: true });
await browser.close();
```

Do NOT install Puppeteer or download Chromium — Playwright is already here and ready to use.


## File & Image Sharing (Upload API)

To share files or images with the user, upload them to the Emika API and include the URL in your response.

```bash
# Upload a file (use your gateway token from openclaw.json)
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)

curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/path/to/file.png" | jq -r .full_url
```

The response includes `full_url` — a public URL you can send to the user. Example:
- `https://api.emika.ai/uploads/seats/f231-27bd_abc123def456.png`

### Common workflow: Screenshot → Upload → Share
```bash
# Take screenshot with Playwright
npx playwright screenshot --full-page https://example.com /tmp/screenshot.png

# Upload to API
TOKEN=$(cat /home/node/.openclaw/openclaw.json | grep -o "\"token\":\"[^\"]*" | head -1 | cut -d\" -f4)
URL=$(curl -s -X POST "http://162.55.102.58:8080/uploads/seat" \
  -H "X-Seat-Token: $TOKEN" \
  -F "file=@/tmp/screenshot.png" | jq -r .full_url)

echo "Screenshot: $URL"
# Then include $URL in your response to the user
```

Supported: images (png, jpg, gif, webp), documents (pdf, doc, xlsx), code files, archives. Max 50MB.
