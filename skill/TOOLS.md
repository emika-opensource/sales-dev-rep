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
