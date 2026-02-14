---
name: sales-dev-rep
description: Clay-style prospecting platform with prospect management, ICP scoring, enrichment, campaigns, templates, and Apollo integration
---

## ⛔ NEVER write data as files. ALWAYS use the API.

## CRITICAL: Port 3000 Only
You MUST deploy ONLY on port 3000. Nginx ONLY proxies port 3000 — any other port will NOT be accessible.
If port 3000 is busy: `pm2 delete all` then `pm2 start your-app.js --name app` on port 3000.

## 🚨 Your App is ALREADY RUNNING
Your **Sales Dev Rep** web application is ALREADY RUNNING on port 3000.
- **DO NOT** kill anything on port 3000
- **DO NOT** try to start a new server
- All API endpoints below are served by this app at `http://localhost:3000`

## 📁 File Uploads
To upload CSV files for prospect import, use multipart form:
```bash
curl -X POST http://localhost:3000/api/prospects/import \
  -F "file=@prospects.csv" \
  -F 'mapping={"email":"email","first_name":"firstName","last_name":"lastName"}'
```

## API Endpoints Summary

| Category | Endpoints |
|----------|-----------|
| Status | `GET /api/status` |
| Config | `GET/PUT /api/config`, `POST /api/config/validate-apollo` |
| Prospects | `GET/POST /api/prospects`, `PUT/DELETE /api/prospects/:id`, `DELETE /api/prospects` (bulk) |
| Prospect Import | `POST /api/prospects/import` (CSV), `POST /api/prospects/bulk` |
| Enrichment | `POST /api/prospects/enrich` |
| Search | `POST /api/search` (Apollo) |
| ICPs | `GET/POST /api/icps`, `PUT/DELETE /api/icps/:id` |
| Campaigns | `GET/POST /api/campaigns`, `PUT/DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/prospects` |
| Templates | `GET/POST /api/templates`, `PUT/DELETE /api/templates/:id` |
| Sample Data | `POST /api/sample-data` |
| Analytics | `GET /api/analytics` |

## Detailed API Reference

### Status

**Check app status**:
```bash
curl http://localhost:3000/api/status
```
Response:
```json
{
  "isFirstRun": true,
  "prospectCount": 0,
  "icpCount": 0,
  "hasApiKey": false,
  "hasSender": false
}
```

### Config

**Get config** (API keys are masked):
```bash
curl http://localhost:3000/api/config
```

**Update config**:
```bash
curl -X PUT http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "apiKeys": { "apollo": "your-apollo-api-key" },
    "waterfallOrder": ["apollo"],
    "senderEmail": "sales@company.com",
    "senderName": "Sales Team"
  }'
```

**Validate Apollo API key**:
```bash
curl -X POST http://localhost:3000/api/config/validate-apollo \
  -H "Content-Type: application/json" \
  -d '{ "apiKey": "your-apollo-api-key" }'
```
Response: `{ "valid": true }` or `{ "valid": false, "error": "..." }`

### Prospects

**List prospects** (with filters):
```bash
curl http://localhost:3000/api/prospects
curl "http://localhost:3000/api/prospects?status=new&search=sarah&sort=-createdAt&limit=10&offset=0"
curl "http://localhost:3000/api/prospects?icp=ICP_ID"
```
- `status`: filter by status
- `icp`: filter by ICP ID
- `search`: full-text search across name, email, company, title
- `sort`: field name (prefix `-` for descending)
- `limit`, `offset`: pagination

Response: `{ "total": 25, "prospects": [...] }`

**Create a prospect**:
```bash
curl -X POST http://localhost:3000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Sarah",
    "lastName": "Chen",
    "email": "sarah@techcorp.io",
    "phone": "+1234567890",
    "title": "VP of Engineering",
    "company": "TechCorp",
    "companySize": "500",
    "industry": "Technology",
    "linkedinUrl": "https://linkedin.com/in/sarachen",
    "location": "San Francisco, CA",
    "status": "new",
    "icpId": "ICP_ID",
    "tags": ["priority"],
    "notes": "Met at conference"
  }'
```
Response: Created prospect object with `id`.

**Update a prospect**:
```bash
curl -X PUT http://localhost:3000/api/prospects/PROSPECT_ID \
  -H "Content-Type: application/json" \
  -d '{ "status": "contacted", "notes": "Sent intro email" }'
```

**Delete a prospect**:
```bash
curl -X DELETE http://localhost:3000/api/prospects/PROSPECT_ID
```

**Bulk delete prospects**:
```bash
curl -X DELETE http://localhost:3000/api/prospects \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["id1", "id2", "id3"] }'
```
Response: `{ "ok": true, "deleted": 3 }`

**Bulk add prospects** (from search results):
```bash
curl -X POST http://localhost:3000/api/prospects/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "prospects": [
      { "firstName": "John", "lastName": "Doe", "email": "john@example.com", "company": "Acme" }
    ]
  }'
```
Response: `{ "added": 1, "duplicates": 0 }`

**Import CSV**:
```bash
curl -X POST http://localhost:3000/api/prospects/import \
  -F "file=@prospects.csv" \
  -F 'mapping={"Email":"email","First Name":"firstName","Last Name":"lastName","Company":"company"}'
```
- Auto-maps common column names if no mapping provided
- Deduplicates by email

Response: `{ "imported": 15, "duplicates": 2, "prospects": [...] }`

### Enrichment (Apollo)

**Enrich prospects**:
```bash
curl -X POST http://localhost:3000/api/prospects/enrich \
  -H "Content-Type: application/json" \
  -d '{ "prospectIds": ["id1", "id2"] }'
```
Requires Apollo API key in config. Enriches phone, title, company size, industry, LinkedIn URL, location.

Response: `{ "results": [{ "id": "id1", "provider": "apollo", "fields": {...} }] }`

### Search (Apollo)

**Search for people via Apollo**:
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "VP Engineering",
    "filters": {
      "titles": ["VP of Engineering", "CTO"],
      "locations": ["San Francisco"],
      "companySizes": ["51-200", "201-500"],
      "page": 1,
      "perPage": 25
    }
  }'
```
Response: `{ "total": 150, "people": [{ "firstName": "...", "email": "...", ... }] }`

### ICPs (Ideal Customer Profiles)

**List ICPs**:
```bash
curl http://localhost:3000/api/icps
```

**Create an ICP**:
```bash
curl -X POST http://localhost:3000/api/icps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enterprise SaaS",
    "description": "Large SaaS companies",
    "criteria": {
      "industries": ["Technology", "SaaS"],
      "companySizes": ["201-500", "501-1000"],
      "titles": ["VP", "Director", "CTO"],
      "locations": ["US"],
      "fundingStages": [],
      "techStack": []
    },
    "color": "#ff6b35"
  }'
```
Creating/updating ICPs auto-rescores matching prospects.

**Update an ICP**:
```bash
curl -X PUT http://localhost:3000/api/icps/ICP_ID \
  -H "Content-Type: application/json" \
  -d '{ "name": "Updated ICP", "criteria": { "industries": ["Fintech"] } }'
```

**Delete an ICP**:
```bash
curl -X DELETE http://localhost:3000/api/icps/ICP_ID
```

### Campaigns

**List campaigns**:
```bash
curl http://localhost:3000/api/campaigns
```

**Create a campaign**:
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q1 Outreach",
    "icpId": "ICP_ID",
    "status": "draft",
    "steps": [
      { "type": "email", "templateId": "TPL_ID", "delay": 0 },
      { "type": "email", "templateId": "TPL_ID2", "delay": 3 }
    ],
    "prospects": []
  }'
```

**Update a campaign**:
```bash
curl -X PUT http://localhost:3000/api/campaigns/CAMPAIGN_ID \
  -H "Content-Type: application/json" \
  -d '{ "status": "active" }'
```

**Delete a campaign**:
```bash
curl -X DELETE http://localhost:3000/api/campaigns/CAMPAIGN_ID
```

**Assign prospects to a campaign**:
```bash
curl -X POST http://localhost:3000/api/campaigns/CAMPAIGN_ID/prospects \
  -H "Content-Type: application/json" \
  -d '{ "prospectIds": ["id1", "id2", "id3"] }'
```
Response: `{ "ok": true, "added": 3, "total": 15 }`

### Templates

**List templates**:
```bash
curl http://localhost:3000/api/templates
```

**Create a template**:
```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cold Intro v1",
    "category": "cold-intro",
    "subject": "Quick question about {{company}}",
    "body": "Hi {{firstName}},\n\nI noticed...",
    "mergeFields": ["firstName", "company", "title"]
  }'
```

**Update a template**:
```bash
curl -X PUT http://localhost:3000/api/templates/TPL_ID \
  -H "Content-Type: application/json" \
  -d '{ "subject": "Updated subject", "body": "Updated body" }'
```

**Delete a template**:
```bash
curl -X DELETE http://localhost:3000/api/templates/TPL_ID
```

### Sample Data

**Load sample prospects** (for demo/testing):
```bash
curl -X POST http://localhost:3000/api/sample-data
```
Response: `{ "loaded": 25 }`

### Analytics

**Get analytics dashboard**:
```bash
curl http://localhost:3000/api/analytics
```
Response:
```json
{
  "total": 25,
  "statusCounts": { "new": 10, "enriched": 8, "contacted": 4, "replied": 2, "qualified": 1 },
  "enriched": 8,
  "withEmail": 25,
  "withPhone": 5,
  "enrichmentRate": 32,
  "icpBreakdown": [{ "id": "...", "name": "Enterprise", "count": 10, "avgScore": 75 }],
  "campaignStats": [{ "id": "...", "name": "Q1", "status": "active", "prospectCount": 15 }]
}
```
