const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fetch = require('node-fetch');

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

// Content publishing — AI-generated reports, dashboards, analyses
const CONTENT_DIR = path.join(__dirname, 'content');
try { require('fs').mkdirSync(CONTENT_DIR, { recursive: true }); } catch(e) {}
app.use('/content', express.static(CONTENT_DIR));

// --- Helpers ---
// Simple file-level mutex to prevent race conditions on JSON writes
const fileLocks = new Map();
async function withLock(file, fn) {
  while (fileLocks.get(file)) {
    await new Promise(r => setTimeout(r, 10));
  }
  fileLocks.set(file, true);
  try { return await fn(); }
  finally { fileLocks.delete(file); }
}

function loadJson(file, defaultVal = []) {
  const fp = path.join(DATA_DIR, file);
  try { return fs.existsSync(fp) ? fs.readJsonSync(fp) : defaultVal; } 
  catch { return defaultVal; }
}
function saveJson(file, data) {
  try {
    fs.writeJsonSync(path.join(DATA_DIR, file), data, { spaces: 2 });
  } catch (e) {
    console.error(`Failed to write ${file}:`, e.message);
    throw e;
  }
}

let uidCounter = 0;
function uid() { return Date.now().toString(36) + (uidCounter++).toString(36) + Math.random().toString(36).slice(2, 8); }

// --- Config ---
function getConfig() {
  return loadJson('config.json', {
    apiKeys: { apollo: process.env.APOLLO_API_KEY || '' },
    waterfallOrder: ['apollo'],
    senderEmail: '',
    senderName: ''
  });
}

app.get('/api/config', (req, res) => {
  const c = getConfig();
  const masked = { ...c, apiKeys: {} };
  for (const [k, v] of Object.entries(c.apiKeys)) {
    masked.apiKeys[k] = v ? v.slice(0, 4) + '••••' + v.slice(-4) : '';
  }
  res.json(masked);
});

app.put('/api/config', (req, res) => {
  return withLock('config.json', () => {
    const current = getConfig();
    const update = req.body;
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
});

// --- Validate Apollo Key ---
app.post('/api/config/validate-apollo', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.json({ valid: false, error: 'No API key provided' });
  try {
    const resp = await fetch('https://api.apollo.io/api/v1/auth/health', {
      method: 'GET',
      headers: { 'X-Api-Key': apiKey }
    });
    if (resp.ok) {
      res.json({ valid: true });
    } else {
      // Try a lightweight search as fallback health check
      const resp2 = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ q_keywords: 'test', per_page: 1, page: 1 })
      });
      res.json({ valid: resp2.ok, error: resp2.ok ? null : `API returned ${resp2.status}` });
    }
  } catch (e) {
    res.json({ valid: false, error: e.message });
  }
});

// --- First-run check ---
app.get('/api/status', (req, res) => {
  const prospects = loadJson('prospects.json', []);
  const icps = loadJson('icps.json', []);
  const config = getConfig();
  const hasApiKey = !!config.apiKeys.apollo;
  res.json({
    isFirstRun: prospects.length === 0 && icps.length === 0 && !hasApiKey,
    prospectCount: prospects.length,
    icpCount: icps.length,
    hasApiKey,
    hasSender: !!(config.senderEmail && config.senderName)
  });
});

// --- Sample Data ---
app.post('/api/sample-data', (req, res) => {
  return withLock('prospects.json', () => {
    const prospects = loadJson('prospects.json', []);
    const now = new Date().toISOString();
    const sampleProspects = [
      { firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@techcorp.io', title: 'VP of Engineering', company: 'TechCorp', companySize: '500', industry: 'Technology', location: 'San Francisco, CA', status: 'new' },
      { firstName: 'Marcus', lastName: 'Johnson', email: 'marcus.j@growthco.com', title: 'Head of Sales', company: 'GrowthCo', companySize: '200', industry: 'SaaS', location: 'New York, NY', status: 'new' },
      { firstName: 'Emily', lastName: 'Park', email: 'emily.park@dataflow.ai', title: 'CTO', company: 'DataFlow AI', companySize: '50', industry: 'Artificial Intelligence', location: 'Austin, TX', status: 'enriched' },
      { firstName: 'David', lastName: 'Mueller', email: 'david@cloudscale.de', title: 'Director of Engineering', company: 'CloudScale', companySize: '150', industry: 'Cloud Computing', location: 'Berlin, Germany', status: 'new' },
      { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@finova.com', title: 'VP Product', company: 'Finova', companySize: '300', industry: 'Fintech', location: 'London, UK', status: 'contacted' },
      { firstName: 'James', lastName: 'O\'Brien', email: 'jobrien@scaleup.io', title: 'CEO', company: 'ScaleUp', companySize: '25', industry: 'SaaS', location: 'Boston, MA', status: 'new' },
      { firstName: 'Lisa', lastName: 'Wang', email: 'lisa.wang@automate.co', title: 'Head of Marketing', company: 'Automate.co', companySize: '100', industry: 'Marketing Tech', location: 'Seattle, WA', status: 'enriched' },
      { firstName: 'Alex', lastName: 'Rivera', email: 'alex@devtools.io', title: 'VP Sales', company: 'DevTools Inc', companySize: '75', industry: 'Developer Tools', location: 'Denver, CO', status: 'replied' },
      { firstName: 'Nina', lastName: 'Petrov', email: 'nina.petrov@secureai.com', title: 'CISO', company: 'SecureAI', companySize: '400', industry: 'Cybersecurity', location: 'Chicago, IL', status: 'new' },
      { firstName: 'Tom', lastName: 'Kim', email: 'tkim@logisticspro.com', title: 'COO', company: 'LogisticsPro', companySize: '600', industry: 'Logistics', location: 'Atlanta, GA', status: 'qualified' },
      { firstName: 'Rachel', lastName: 'Green', email: 'rachel@healthdata.io', title: 'VP Engineering', company: 'HealthData', companySize: '80', industry: 'HealthTech', location: 'Portland, OR', status: 'new' },
      { firstName: 'Michael', lastName: 'Brown', email: 'mbrown@enterprise.ai', title: 'Director of IT', company: 'EnterpriseAI', companySize: '1000', industry: 'Enterprise Software', location: 'Dallas, TX', status: 'enriched' },
      { firstName: 'Sophie', lastName: 'Laurent', email: 'sophie@designlab.fr', title: 'Head of Product', company: 'DesignLab', companySize: '45', industry: 'Design', location: 'Paris, France', status: 'new' },
      { firstName: 'Chris', lastName: 'Taylor', email: 'chris.taylor@payhub.com', title: 'CFO', company: 'PayHub', companySize: '250', industry: 'Fintech', location: 'Miami, FL', status: 'contacted' },
      { firstName: 'Aisha', lastName: 'Patel', email: 'aisha@edutech.com', title: 'VP of Growth', company: 'EduTech', companySize: '120', industry: 'EdTech', location: 'Toronto, Canada', status: 'new' },
      { firstName: 'Ryan', lastName: 'Foster', email: 'ryan@buildfast.io', title: 'CTO', company: 'BuildFast', companySize: '30', industry: 'Construction Tech', location: 'Phoenix, AZ', status: 'new' },
      { firstName: 'Maria', lastName: 'Santos', email: 'maria@retailnext.com', title: 'VP Sales', company: 'RetailNext', companySize: '350', industry: 'Retail Tech', location: 'Los Angeles, CA', status: 'enriched' },
      { firstName: 'Jason', lastName: 'Lee', email: 'jlee@quantumdata.io', title: 'Head of Engineering', company: 'QuantumData', companySize: '60', industry: 'Data Analytics', location: 'San Jose, CA', status: 'new' },
      { firstName: 'Hannah', lastName: 'Scott', email: 'hannah@greenenergyco.com', title: 'CEO', company: 'GreenEnergy Co', companySize: '90', industry: 'Clean Energy', location: 'Minneapolis, MN', status: 'replied' },
      { firstName: 'Omar', lastName: 'Hassan', email: 'omar@supplychain.ai', title: 'VP Operations', company: 'SupplyChain AI', companySize: '175', industry: 'Supply Chain', location: 'Houston, TX', status: 'new' },
      { firstName: 'Kate', lastName: 'Wilson', email: 'kate.wilson@hirefast.co', title: 'Head of Talent', company: 'HireFast', companySize: '55', industry: 'HR Tech', location: 'Nashville, TN', status: 'new' },
      { firstName: 'Ben', lastName: 'Clarke', email: 'ben@proptech.io', title: 'Director of Sales', company: 'PropTech Solutions', companySize: '130', industry: 'Real Estate Tech', location: 'Charlotte, NC', status: 'enriched' },
      { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki@robotics.jp', title: 'VP Engineering', company: 'Advanced Robotics', companySize: '200', industry: 'Robotics', location: 'Tokyo, Japan', status: 'new' },
      { firstName: 'Daniel', lastName: 'Wright', email: 'daniel@mediastream.com', title: 'CMO', company: 'MediaStream', companySize: '85', industry: 'Media', location: 'Nashville, TN', status: 'new' },
      { firstName: 'Zara', lastName: 'Ali', email: 'zara@bioconnect.com', title: 'VP Research', company: 'BioConnect', companySize: '160', industry: 'Biotech', location: 'Cambridge, MA', status: 'new' },
    ].map(p => ({
      id: uid(),
      firstName: '', lastName: '', email: '', phone: '', title: '', company: '',
      companySize: '', industry: '', linkedinUrl: '', location: '',
      icpId: '', icpScore: 0,
      enrichmentData: { provider: '', enrichedAt: '', fields: {} },
      tags: [], notes: '', createdAt: now, updatedAt: now,
      ...p
    }));

    prospects.push(...sampleProspects);
    saveJson('prospects.json', prospects);
    res.json({ loaded: sampleProspects.length });
  });
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
  return withLock('prospects.json', () => {
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
});

app.put('/api/prospects/:id', (req, res) => {
  return withLock('prospects.json', () => {
    const prospects = loadJson('prospects.json', []);
    const idx = prospects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    prospects[idx] = { ...prospects[idx], ...req.body, updatedAt: new Date().toISOString() };
    saveJson('prospects.json', prospects);
    res.json(prospects[idx]);
  });
});

app.delete('/api/prospects/:id', (req, res) => {
  return withLock('prospects.json', () => {
    let prospects = loadJson('prospects.json', []);
    prospects = prospects.filter(p => p.id !== req.params.id);
    saveJson('prospects.json', prospects);
    res.json({ ok: true });
  });
});

app.delete('/api/prospects', (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'No ids' });
  return withLock('prospects.json', () => {
    let prospects = loadJson('prospects.json', []);
    prospects = prospects.filter(p => !ids.includes(p.id));
    saveJson('prospects.json', prospects);
    res.json({ ok: true, deleted: ids.length });
  });
});

// --- CSV Import (with deduplication) ---
app.post('/api/prospects/import', upload.single('file'), (req, res) => {
  try {
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : null;
    const prospects = loadJson('prospects.json', []);
    const now = new Date().toISOString();
    const imported = [];
    let duplicates = 0;
    
    // Build email index for dedup
    const existingEmails = new Set(prospects.map(p => (p.email || '').toLowerCase()).filter(Boolean));
    
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
        const autoMap = {
          'first_name': 'firstName', 'firstname': 'firstName', 'first name': 'firstName',
          'last_name': 'lastName', 'lastname': 'lastName', 'last name': 'lastName',
          'email': 'email', 'email_address': 'email',
          'phone': 'phone', 'phone_number': 'phone',
          'title': 'title', 'job_title': 'title',
          'company': 'company', 'organization': 'company', 'company_name': 'company',
          'company_size': 'companySize', 'employees': 'companySize',
          'industry': 'industry',
          'linkedin': 'linkedinUrl', 'linkedin_url': 'linkedinUrl',
          'location': 'location', 'city': 'location'
        };
        for (const [csvCol, val] of Object.entries(row)) {
          const mapped = autoMap[csvCol.toLowerCase()];
          if (mapped) p[mapped] = val;
        }
      }
      
      if (p.firstName || p.lastName || p.email || p.company) {
        // Dedup by email
        const email = (p.email || '').toLowerCase();
        if (email && existingEmails.has(email)) {
          duplicates++;
          continue;
        }
        if (email) existingEmails.add(email);
        prospects.push(p);
        imported.push(p);
      }
    }
    
    saveJson('prospects.json', prospects);
    res.json({ imported: imported.length, duplicates, prospects: imported });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Enrichment (Apollo only — no fake providers) ---
async function enrichWithApollo(prospect, apiKey) {
  let data;
  
  // If we have an Apollo ID, use the direct lookup endpoint (much more reliable)
  if (prospect.apolloId) {
    const resp = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ id: prospect.apolloId })
    });
    if (!resp.ok) throw new Error(`Apollo API error: ${resp.status}`);
    data = await resp.json();
  }
  
  // Fall back to name-based matching if no Apollo ID or ID lookup failed
  if (!data?.person) {
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
    data = await resp.json();
  }
  
  if (!data.person) throw new Error('No match found');
  const p = data.person;
  return {
    apolloId: p.id || '',
    firstName: p.first_name || '',
    lastName: p.last_name || '',
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

app.post('/api/prospects/enrich', async (req, res) => {
  const { prospectIds } = req.body;
  if (!prospectIds?.length) return res.status(400).json({ error: 'No prospect IDs' });
  
  const config = getConfig();
  if (!config.apiKeys.apollo) {
    return res.status(400).json({ error: 'Apollo API key not configured. Go to Settings to add your key.' });
  }

  const prospects = loadJson('prospects.json', []);
  const results = [];
  
  for (const pid of prospectIds) {
    const idx = prospects.findIndex(p => p.id === pid);
    if (idx === -1) { results.push({ id: pid, error: 'Not found' }); continue; }
    
    try {
      const fields = await enrichWithApollo(prospects[idx], config.apiKeys.apollo);
      
      // Helper: detect obfuscated values like "Ri***y" or "J***n"
      const isObfuscated = (val) => typeof val === 'string' && /\*{2,}/.test(val);
      
      for (const [k, v] of Object.entries(fields)) {
        if (!v) continue;
        const existing = prospects[idx][k];
        // Overwrite if empty OR obfuscated
        if (!existing || isObfuscated(existing)) {
          prospects[idx][k] = v;
        }
      }
      prospects[idx].enrichmentData = {
        provider: 'apollo',
        enrichedAt: new Date().toISOString(),
        fields: { ...prospects[idx].enrichmentData?.fields, ...fields }
      };
      prospects[idx].status = prospects[idx].status === 'new' ? 'enriched' : prospects[idx].status;
      prospects[idx].updatedAt = new Date().toISOString();
      results.push({ id: pid, provider: 'apollo', fields });
    } catch (e) {
      results.push({ id: pid, error: e.message });
    }
  }
  
  saveJson('prospects.json', prospects);
  res.json({ results });
});

// --- Search (Apollo) ---
app.post('/api/search', async (req, res) => {
  const config = getConfig();
  const apiKey = config.apiKeys.apollo;
  if (!apiKey) return res.status(400).json({ error: 'Apollo API key not configured. Go to Settings to add your key.' });
  
  try {
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
    
    const resp = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`Apollo API error: ${resp.status}`);
    const data = await resp.json();
    
    const people = (data.people || []).map(p => ({
      apolloId: p.id || '',
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

// --- Add prospects from search results ---
app.post('/api/prospects/bulk', (req, res) => {
  return withLock('prospects.json', () => {
    const { prospects: newProspects } = req.body;
    if (!newProspects?.length) return res.status(400).json({ error: 'No prospects' });
    const prospects = loadJson('prospects.json', []);
    const now = new Date().toISOString();
    const existingEmails = new Set(prospects.map(p => (p.email || '').toLowerCase()).filter(Boolean));
    const added = [];
    let duplicates = 0;

    for (const np of newProspects) {
      const email = (np.email || '').toLowerCase();
      if (email && existingEmails.has(email)) { duplicates++; continue; }
      if (email) existingEmails.add(email);
      const p = {
        id: uid(), firstName: '', lastName: '', email: '', phone: '', title: '', company: '',
        companySize: '', industry: '', linkedinUrl: '', location: '',
        icpId: '', icpScore: 0, status: 'new',
        enrichmentData: { provider: '', enrichedAt: '', fields: {} },
        tags: [], notes: '', createdAt: now, updatedAt: now,
        ...np
      };
      prospects.push(p);
      added.push(p);
    }
    saveJson('prospects.json', prospects);
    res.json({ added: added.length, duplicates });
  });
});

// --- Assign prospects to campaign ---
app.post('/api/campaigns/:id/prospects', (req, res) => {
  const { prospectIds } = req.body;
  if (!prospectIds?.length) return res.status(400).json({ error: 'No prospect IDs' });
  return withLock('campaigns.json', () => {
    const campaigns = loadJson('campaigns.json', []);
    const idx = campaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });
    const existing = new Set(campaigns[idx].prospects || []);
    let added = 0;
    for (const id of prospectIds) {
      if (!existing.has(id)) { existing.add(id); added++; }
    }
    campaigns[idx].prospects = [...existing];
    saveJson('campaigns.json', campaigns);
    res.json({ ok: true, added, total: campaigns[idx].prospects.length });
  });
});

// --- ICPs CRUD ---
app.get('/api/icps', (req, res) => res.json(loadJson('icps.json', [])));
app.post('/api/icps', (req, res) => {
  return withLock('icps.json', () => {
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
    rescoreProspects(icps);
    res.json(icp);
  });
});
app.put('/api/icps/:id', (req, res) => {
  return withLock('icps.json', () => {
    const icps = loadJson('icps.json', []);
    const idx = icps.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    icps[idx] = { ...icps[idx], ...req.body };
    saveJson('icps.json', icps);
    rescoreProspects(icps);
    res.json(icps[idx]);
  });
});
app.delete('/api/icps/:id', (req, res) => {
  return withLock('icps.json', () => {
    let icps = loadJson('icps.json', []);
    icps = icps.filter(i => i.id !== req.params.id);
    saveJson('icps.json', icps);
    res.json({ ok: true });
  });
});

function rescoreProspects(icps) {
  const prospects = loadJson('prospects.json', []);
  let changed = false;
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
    const newScore = checks > 0 ? Math.round((score / checks) * 100) : 0;
    if (p.icpScore !== newScore) { p.icpScore = newScore; changed = true; }
  }
  if (changed) saveJson('prospects.json', prospects);
}

// --- Campaigns CRUD ---
app.get('/api/campaigns', (req, res) => res.json(loadJson('campaigns.json', [])));
app.post('/api/campaigns', (req, res) => {
  return withLock('campaigns.json', () => {
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
});
app.put('/api/campaigns/:id', (req, res) => {
  return withLock('campaigns.json', () => {
    const campaigns = loadJson('campaigns.json', []);
    const idx = campaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    campaigns[idx] = { ...campaigns[idx], ...req.body };
    saveJson('campaigns.json', campaigns);
    res.json(campaigns[idx]);
  });
});
app.delete('/api/campaigns/:id', (req, res) => {
  return withLock('campaigns.json', () => {
    let campaigns = loadJson('campaigns.json', []);
    campaigns = campaigns.filter(c => c.id !== req.params.id);
    saveJson('campaigns.json', campaigns);
    res.json({ ok: true });
  });
});

// --- Templates CRUD ---
app.get('/api/templates', (req, res) => res.json(loadJson('templates.json', [])));
app.post('/api/templates', (req, res) => {
  return withLock('templates.json', () => {
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
});
app.put('/api/templates/:id', (req, res) => {
  return withLock('templates.json', () => {
    const templates = loadJson('templates.json', []);
    const idx = templates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    templates[idx] = { ...templates[idx], ...req.body };
    saveJson('templates.json', templates);
    res.json(templates[idx]);
  });
});
app.delete('/api/templates/:id', (req, res) => {
  return withLock('templates.json', () => {
    let templates = loadJson('templates.json', []);
    templates = templates.filter(t => t.id !== req.params.id);
    saveJson('templates.json', templates);
    res.json({ ok: true });
  });
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
