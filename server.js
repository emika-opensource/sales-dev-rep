const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// Data directory
const DATA_DIR = fs.existsSync('/home/node/emika') 
  ? '/home/node/emika/prospect-hub' 
  : path.join(__dirname, 'data');

fs.ensureDirSync(DATA_DIR);

// Multer for CSV upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
function loadJson(file, defaultVal = []) {
  const fp = path.join(DATA_DIR, file);
  try { return fs.existsSync(fp) ? fs.readJsonSync(fp) : defaultVal; } 
  catch { return defaultVal; }
}
function saveJson(file, data) {
  fs.writeJsonSync(path.join(DATA_DIR, file), data, { spaces: 2 });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// --- Config ---
function getConfig() {
  return loadJson('config.json', {
    apiKeys: { apollo: process.env.APOLLO_API_KEY || '', contactout: '', rocketreach: '', hunter: '' },
    waterfallOrder: ['apollo', 'contactout', 'rocketreach', 'hunter'],
    senderEmail: '',
    senderName: ''
  });
}

app.get('/api/config', (req, res) => {
  const c = getConfig();
  // Mask keys
  const masked = { ...c, apiKeys: {} };
  for (const [k, v] of Object.entries(c.apiKeys)) {
    masked.apiKeys[k] = v ? v.slice(0, 4) + '••••' + v.slice(-4) : '';
  }
  res.json(masked);
});

app.put('/api/config', (req, res) => {
  const current = getConfig();
  const update = req.body;
  // Only update non-masked keys
  if (update.apiKeys) {
    for (const [k, v] of Object.entries(update.apiKeys)) {
      if (v && !v.includes('••••')) current.apiKeys[k] = v;
    }
  }
  if (update.waterfallOrder) current.waterfallOrder = update.waterfallOrder;
  if (update.senderEmail !== undefined) current.senderEmail = update.senderEmail;
  if (update.senderName !== undefined) current.senderName = update.senderName;
  saveJson('config.json', current);
  res.json({ ok: true });
});

// --- Prospects CRUD ---
app.get('/api/prospects', (req, res) => {
  let prospects = loadJson('prospects.json', []);
  const { status, icp, search, sort, limit, offset } = req.query;
  if (status) prospects = prospects.filter(p => p.status === status);
  if (icp) prospects = prospects.filter(p => p.icpId === icp);
  if (search) {
    const s = search.toLowerCase();
    prospects = prospects.filter(p => 
      (p.firstName + ' ' + p.lastName + ' ' + p.email + ' ' + p.company + ' ' + p.title)
        .toLowerCase().includes(s)
    );
  }
  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    prospects.sort((a, b) => {
      const av = (a[field] || '').toString().toLowerCase();
      const bv = (b[field] || '').toString().toLowerCase();
      return desc ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }
  const total = prospects.length;
  if (offset) prospects = prospects.slice(Number(offset));
  if (limit) prospects = prospects.slice(0, Number(limit));
  res.json({ total, prospects });
});

app.post('/api/prospects', (req, res) => {
  const prospects = loadJson('prospects.json', []);
  const now = new Date().toISOString();
  const p = {
    id: uid(),
    firstName: '', lastName: '', email: '', phone: '', title: '', company: '',
    companySize: '', industry: '', linkedinUrl: '', location: '',
    icpId: '', icpScore: 0, status: 'new',
    enrichmentData: { provider: '', enrichedAt: '', fields: {} },
    tags: [], notes: '',
    createdAt: now, updatedAt: now,
    ...req.body
  };
  p.id = p.id || uid();
  p.createdAt = p.createdAt || now;
  p.updatedAt = now;
  prospects.push(p);
  saveJson('prospects.json', prospects);
  res.json(p);
});

app.put('/api/prospects/:id', (req, res) => {
  const prospects = loadJson('prospects.json', []);
  const idx = prospects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  prospects[idx] = { ...prospects[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveJson('prospects.json', prospects);
  res.json(prospects[idx]);
});

app.delete('/api/prospects/:id', (req, res) => {
  let prospects = loadJson('prospects.json', []);
  prospects = prospects.filter(p => p.id !== req.params.id);
  saveJson('prospects.json', prospects);
  res.json({ ok: true });
});

app.delete('/api/prospects', (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No ids' });
  let prospects = loadJson('prospects.json', []);
  prospects = prospects.filter(p => !ids.includes(p.id));
  saveJson('prospects.json', prospects);
  res.json({ ok: true, deleted: ids.length });
});

// --- CSV Import ---
app.post('/api/prospects/import', upload.single('file'), (req, res) => {
  try {
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
    const prospects = loadJson('prospects.json', []);
    const now = new Date().toISOString();
    const imported = [];
    
    for (const row of records) {
      const p = {
        id: uid(),
        firstName: '', lastName: '', email: '', phone: '', title: '', company: '',
        companySize: '', industry: '', linkedinUrl: '', location: '',
        icpId: '', icpScore: 0, status: 'new',
        enrichmentData: { provider: '', enrichedAt: '', fields: {} },
        tags: [], notes: '', createdAt: now, updatedAt: now
      };
      
      if (mapping) {
        for (const [csvCol, field] of Object.entries(mapping)) {
          if (field && row[csvCol] !== undefined) p[field] = row[csvCol];
        }
      } else {
        // Auto-map common column names
        const autoMap = {
          'first_name': 'firstName', 'firstname': 'firstName', 'first name': 'firstName', 'First Name': 'firstName',
          'last_name': 'lastName', 'lastname': 'lastName', 'last name': 'lastName', 'Last Name': 'lastName',
          'email': 'email', 'Email': 'email', 'email_address': 'email',
          'phone': 'phone', 'Phone': 'phone', 'phone_number': 'phone',
          'title': 'title', 'Title': 'title', 'job_title': 'title', 'Job Title': 'title',
          'company': 'company', 'Company': 'company', 'organization': 'company', 'company_name': 'company',
          'company_size': 'companySize', 'employees': 'companySize',
          'industry': 'industry', 'Industry': 'industry',
          'linkedin': 'linkedinUrl', 'linkedin_url': 'linkedinUrl', 'LinkedIn': 'linkedinUrl',
          'location': 'location', 'Location': 'location', 'city': 'location'
        };
        for (const [csvCol, val] of Object.entries(row)) {
          const mapped = autoMap[csvCol] || autoMap[csvCol.toLowerCase()];
          if (mapped) p[mapped] = val;
        }
      }
      
      if (p.firstName || p.lastName || p.email || p.company) {
        prospects.push(p);
        imported.push(p);
      }
    }
    
    saveJson('prospects.json', prospects);
    res.json({ imported: imported.length, prospects: imported });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Enrichment ---
async function enrichWithApollo(prospect, apiKey) {
  const fetch = require('node-fetch');
  const body = {
    first_name: prospect.firstName,
    last_name: prospect.lastName,
    organization_name: prospect.company,
    domain: prospect.email ? prospect.email.split('@')[1] : undefined
  };
  const resp = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Apollo API error: ${resp.status}`);
  const data = await resp.json();
  if (!data.person) throw new Error('No match found');
  const p = data.person;
  return {
    email: p.email || '',
    phone: p.phone_numbers?.[0]?.sanitized_number || '',
    title: p.title || '',
    company: p.organization?.name || '',
    companySize: p.organization?.estimated_num_employees?.toString() || '',
    industry: p.organization?.industry || '',
    linkedinUrl: p.linkedin_url || '',
    location: [p.city, p.state, p.country].filter(Boolean).join(', '),
    headline: p.headline || '',
    seniority: p.seniority || ''
  };
}

async function mockEnrich(prospect, provider) {
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  // Return partial mock data
  const fields = {};
  if (!prospect.phone) fields.phone = Math.random() > 0.4 ? '+1-555-' + Math.floor(1000 + Math.random() * 9000) : '';
  if (!prospect.title && Math.random() > 0.3) fields.title = ['VP Sales', 'Director of Engineering', 'CTO', 'Head of Marketing', 'CEO'][Math.floor(Math.random() * 5)];
  return fields;
}

app.post('/api/prospects/enrich', async (req, res) => {
  const { prospectIds, providers } = req.body;
  if (!prospectIds?.length) return res.status(400).json({ error: 'No prospect IDs' });
  
  const config = getConfig();
  const prospects = loadJson('prospects.json', []);
  const results = [];
  const waterfall = providers || config.waterfallOrder;
  
  for (const pid of prospectIds) {
    const idx = prospects.findIndex(p => p.id === pid);
    if (idx === -1) { results.push({ id: pid, error: 'Not found' }); continue; }
    
    let enriched = false;
    for (const provider of waterfall) {
      try {
        let fields;
        if (provider === 'apollo' && config.apiKeys.apollo) {
          fields = await enrichWithApollo(prospects[idx], config.apiKeys.apollo);
        } else {
          fields = await mockEnrich(prospects[idx], provider);
        }
        
        // Merge fields
        for (const [k, v] of Object.entries(fields)) {
          if (v && !prospects[idx][k]) prospects[idx][k] = v;
        }
        prospects[idx].enrichmentData = {
          provider,
          enrichedAt: new Date().toISOString(),
          fields: { ...prospects[idx].enrichmentData?.fields, ...fields }
        };
        prospects[idx].status = prospects[idx].status === 'new' ? 'enriched' : prospects[idx].status;
        prospects[idx].updatedAt = new Date().toISOString();
        enriched = true;
        results.push({ id: pid, provider, fields });
        break;
      } catch (e) {
        continue;
      }
    }
    if (!enriched) results.push({ id: pid, error: 'All providers failed' });
  }
  
  saveJson('prospects.json', prospects);
  res.json({ results });
});

// --- Search (Apollo) ---
app.post('/api/search', async (req, res) => {
  const config = getConfig();
  const apiKey = config.apiKeys.apollo;
  if (!apiKey) return res.status(400).json({ error: 'Apollo API key not configured' });
  
  try {
    const fetch = require('node-fetch');
    const { query, filters } = req.body;
    const body = {
      q_keywords: query || '',
      person_titles: filters?.titles || [],
      person_locations: filters?.locations || [],
      organization_industry_tag_ids: [],
      organization_num_employees_ranges: filters?.companySizes || [],
      page: filters?.page || 1,
      per_page: filters?.perPage || 25
    };
    
    const resp = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    
    const people = (data.people || []).map(p => ({
      firstName: p.first_name || '',
      lastName: p.last_name || '',
      email: p.email || '',
      title: p.title || '',
      company: p.organization?.name || '',
      companySize: p.organization?.estimated_num_employees?.toString() || '',
      industry: p.organization?.industry || '',
      linkedinUrl: p.linkedin_url || '',
      location: [p.city, p.state, p.country].filter(Boolean).join(', ')
    }));
    
    res.json({ total: data.pagination?.total_entries || 0, people });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- ICPs CRUD ---
app.get('/api/icps', (req, res) => res.json(loadJson('icps.json', [])));
app.post('/api/icps', (req, res) => {
  const icps = loadJson('icps.json', []);
  const icp = {
    id: uid(),
    name: '', description: '',
    criteria: { industries: [], companySizes: [], titles: [], locations: [], fundingStages: [], techStack: [] },
    scoringWeights: {}, color: '#ff6b35',
    createdAt: new Date().toISOString(),
    ...req.body
  };
  icps.push(icp);
  saveJson('icps.json', icps);
  // Rescore prospects
  rescoreProspects(icps);
  res.json(icp);
});
app.put('/api/icps/:id', (req, res) => {
  const icps = loadJson('icps.json', []);
  const idx = icps.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  icps[idx] = { ...icps[idx], ...req.body };
  saveJson('icps.json', icps);
  rescoreProspects(icps);
  res.json(icps[idx]);
});
app.delete('/api/icps/:id', (req, res) => {
  let icps = loadJson('icps.json', []);
  icps = icps.filter(i => i.id !== req.params.id);
  saveJson('icps.json', icps);
  res.json({ ok: true });
});

function rescoreProspects(icps) {
  const prospects = loadJson('prospects.json', []);
  for (const p of prospects) {
    if (!p.icpId) continue;
    const icp = icps.find(i => i.id === p.icpId);
    if (!icp) continue;
    let score = 0, checks = 0;
    const c = icp.criteria;
    if (c.industries?.length) { checks++; if (c.industries.some(i => p.industry?.toLowerCase().includes(i.toLowerCase()))) score++; }
    if (c.titles?.length) { checks++; if (c.titles.some(t => p.title?.toLowerCase().includes(t.toLowerCase()))) score++; }
    if (c.locations?.length) { checks++; if (c.locations.some(l => p.location?.toLowerCase().includes(l.toLowerCase()))) score++; }
    if (c.companySizes?.length) { checks++; if (c.companySizes.includes(p.companySize)) score++; }
    p.icpScore = checks > 0 ? Math.round((score / checks) * 100) : 0;
  }
  saveJson('prospects.json', prospects);
}

// --- Campaigns CRUD ---
app.get('/api/campaigns', (req, res) => res.json(loadJson('campaigns.json', [])));
app.post('/api/campaigns', (req, res) => {
  const campaigns = loadJson('campaigns.json', []);
  const c = {
    id: uid(),
    name: '', icpId: '', status: 'draft',
    steps: [], prospects: [],
    stats: { sent: 0, opened: 0, replied: 0, bounced: 0 },
    createdAt: new Date().toISOString(),
    ...req.body
  };
  campaigns.push(c);
  saveJson('campaigns.json', campaigns);
  res.json(c);
});
app.put('/api/campaigns/:id', (req, res) => {
  const campaigns = loadJson('campaigns.json', []);
  const idx = campaigns.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  campaigns[idx] = { ...campaigns[idx], ...req.body };
  saveJson('campaigns.json', campaigns);
  res.json(campaigns[idx]);
});
app.delete('/api/campaigns/:id', (req, res) => {
  let campaigns = loadJson('campaigns.json', []);
  campaigns = campaigns.filter(c => c.id !== req.params.id);
  saveJson('campaigns.json', campaigns);
  res.json({ ok: true });
});

// --- Templates CRUD ---
app.get('/api/templates', (req, res) => res.json(loadJson('templates.json', [])));
app.post('/api/templates', (req, res) => {
  const templates = loadJson('templates.json', []);
  const t = {
    id: uid(),
    name: '', category: 'cold-intro', subject: '', body: '',
    mergeFields: [], createdAt: new Date().toISOString(),
    ...req.body
  };
  templates.push(t);
  saveJson('templates.json', templates);
  res.json(t);
});
app.put('/api/templates/:id', (req, res) => {
  const templates = loadJson('templates.json', []);
  const idx = templates.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  templates[idx] = { ...templates[idx], ...req.body };
  saveJson('templates.json', templates);
  res.json(templates[idx]);
});
app.delete('/api/templates/:id', (req, res) => {
  let templates = loadJson('templates.json', []);
  templates = templates.filter(t => t.id !== req.params.id);
  saveJson('templates.json', templates);
  res.json({ ok: true });
});

// --- Analytics ---
app.get('/api/analytics', (req, res) => {
  const prospects = loadJson('prospects.json', []);
  const campaigns = loadJson('campaigns.json', []);
  const icps = loadJson('icps.json', []);
  
  const statusCounts = {};
  for (const p of prospects) statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  
  const enriched = prospects.filter(p => p.enrichmentData?.enrichedAt).length;
  const withEmail = prospects.filter(p => p.email).length;
  const withPhone = prospects.filter(p => p.phone).length;
  
  const icpBreakdown = icps.map(icp => ({
    id: icp.id, name: icp.name, color: icp.color,
    count: prospects.filter(p => p.icpId === icp.id).length,
    avgScore: Math.round(prospects.filter(p => p.icpId === icp.id).reduce((s, p) => s + (p.icpScore || 0), 0) / (prospects.filter(p => p.icpId === icp.id).length || 1))
  }));
  
  const campaignStats = campaigns.map(c => ({
    id: c.id, name: c.name, status: c.status, stats: c.stats, prospectCount: c.prospects?.length || 0
  }));
  
  res.json({
    total: prospects.length, statusCounts, enriched, withEmail, withPhone,
    enrichmentRate: prospects.length ? Math.round(enriched / prospects.length * 100) : 0,
    icpBreakdown, campaignStats
  });
});

// --- SPA fallback ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`SDR server running on port ${PORT}`));
