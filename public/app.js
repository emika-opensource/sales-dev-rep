/* === Prospect Hub — SPA === */
(function(){
'use strict';

// State
const state = {
  prospects: [], total: 0,
  icps: [], campaigns: [], templates: [],
  config: {},
  analytics: {},
  selectedIds: new Set(),
  sort: '', search: '', filterStatus: '', filterIcp: '',
  editingCell: null,
  detailProspect: null,
  enrichingIds: new Set()
};

// Router
function route() {
  const hash = location.hash.slice(1) || 'dashboard';
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === hash);
  });
  closeDetail();
  render(hash);
}
window.addEventListener('hashchange', route);

// API helpers
async function api(url, opts = {}) {
  const o = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (o.body && typeof o.body === 'object' && !(o.body instanceof FormData)) o.body = JSON.stringify(o.body);
  if (o.body instanceof FormData) delete o.headers['Content-Type'];
  const r = await fetch(url, o);
  return r.json();
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// SVG icons
const icons = {
  plus: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V2m0 0L4 5m3-3l3 3M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  enrich: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v4l2.5-1M7 1L4.5 4M1 7h4M9 7h4M7 13v-4l2.5 1M7 13l-2.5-3M1 7l3-2.5M10 4.5L13 7M1 7l3 2.5M10 9.5L13 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5 4V2.5h4V4M3.5 4v8a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7m0 0l-3-3m3 3l3-3M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  arrowUp: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1v6M4 1L1 4M4 1l3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  arrowDown: '<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 7V1M4 7L1 4M4 7l3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  campaign: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h10M2 11h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

// Column definitions
const columns = [
  { key: 'name', label: 'Name', width: 180, render: (p) => `<span class="prospect-name" data-id="${p.id}">${esc(p.firstName)} ${esc(p.lastName)}</span>` },
  { key: 'email', label: 'Email', width: 200, editable: true, enrichField: true },
  { key: 'title', label: 'Title', width: 180, editable: true, enrichField: true },
  { key: 'company', label: 'Company', width: 160, editable: true },
  { key: 'phone', label: 'Phone', width: 140, editable: true, enrichField: true },
  { key: 'location', label: 'Location', width: 150, editable: true, enrichField: true },
  { key: 'industry', label: 'Industry', width: 140, editable: true, enrichField: true },
  { key: 'companySize', label: 'Size', width: 80, editable: true },
  { key: 'linkedinUrl', label: 'LinkedIn', width: 160, editable: true, enrichField: true, render: (p) => p.linkedinUrl ? `<a href="${esc(p.linkedinUrl)}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:11px">Profile</a>` : '' },
  { key: 'icpScore', label: 'Score', width: 60, render: (p) => { const s = p.icpScore||0; const c = s>=70?'high':s>=40?'mid':'low'; return `<span class="icp-score score-${c}">${s}</span>`; }},
  { key: 'status', label: 'Status', width: 100, render: (p) => `<span class="status-badge status-${p.status}">${p.status}</span>` },
  { key: 'enrichmentData', label: 'Source', width: 90, render: (p) => p.enrichmentData?.provider ? `<span style="font-size:11px;color:var(--text-dim)">${esc(p.enrichmentData.provider)}</span>` : '' },
];

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Render dispatcher
async function render(page) {
  const el = document.getElementById('page-content');
  switch(page) {
    case 'dashboard': await renderDashboard(el); break;
    case 'prospects': await renderProspects(el); break;
    case 'icps': await renderICPs(el); break;
    case 'campaigns': await renderCampaigns(el); break;
    case 'templates': await renderTemplates(el); break;
    case 'settings': await renderSettings(el); break;
    default: el.innerHTML = '<div class="empty-state"><p>Page not found</p></div>';
  }
}

// ==================== DASHBOARD ====================
async function renderDashboard(el) {
  state.analytics = await api('/api/analytics');
  const a = state.analytics;
  const statuses = ['new','enriched','contacted','replied','qualified','disqualified'];
  const colors = { new:'#3b82f6', enriched:'#22c55e', contacted:'#eab308', replied:'#ff6b35', qualified:'#22c55e', disqualified:'#ef4444' };
  
  el.innerHTML = `
    <div class="page-header"><h1>Dashboard</h1></div>
    <div class="dashboard-grid">
      <div class="stat-card"><div class="stat-label">Total Prospects</div><div class="stat-value">${a.total||0}</div></div>
      <div class="stat-card"><div class="stat-label">Enrichment Rate</div><div class="stat-value">${a.enrichmentRate||0}%</div></div>
      <div class="stat-card"><div class="stat-label">With Email</div><div class="stat-value">${a.withEmail||0}</div></div>
      <div class="stat-card"><div class="stat-label">With Phone</div><div class="stat-value">${a.withPhone||0}</div></div>
    </div>
    <div class="dashboard-section">
      <h2>Pipeline Funnel</h2>
      <div class="funnel">
        ${statuses.map(s => {
          const cnt = a.statusCounts?.[s]||0;
          const pct = a.total ? Math.max(cnt/a.total*100, 2) : 0;
          return `<div class="funnel-bar"><div class="bar-label">${s}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[s]}">${cnt}</div></div></div>`;
        }).join('')}
      </div>
    </div>
    ${a.icpBreakdown?.length ? `<div class="dashboard-section"><h2>ICP Segments</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${a.icpBreakdown.map(i => `<div class="stat-card" style="border-left:3px solid ${i.color}"><div class="stat-label">${esc(i.name)}</div><div class="stat-value">${i.count}</div><div class="stat-sub">Avg Score: ${i.avgScore}</div></div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

// ==================== PROSPECTS ====================
async function renderProspects(el) {
  await loadProspects();
  await loadICPs();
  
  el.innerHTML = `
    <div class="page-header">
      <h1>Prospects</h1>
      <div class="page-header-actions">
        <button class="btn" onclick="ProspectHub.showImportModal()">${icons.upload} Import CSV</button>
        <button class="btn btn-primary" onclick="ProspectHub.showAddModal()">${icons.plus} Add Prospect</button>
      </div>
    </div>
    <div class="table-toolbar">
      <input type="text" class="search-input" placeholder="Search prospects..." value="${esc(state.search)}" oninput="ProspectHub.onSearch(this.value)">
      <select onchange="ProspectHub.onFilterStatus(this.value)">
        <option value="">All Statuses</option>
        <option value="new" ${state.filterStatus==='new'?'selected':''}>New</option>
        <option value="enriched" ${state.filterStatus==='enriched'?'selected':''}>Enriched</option>
        <option value="contacted" ${state.filterStatus==='contacted'?'selected':''}>Contacted</option>
        <option value="replied" ${state.filterStatus==='replied'?'selected':''}>Replied</option>
        <option value="qualified" ${state.filterStatus==='qualified'?'selected':''}>Qualified</option>
        <option value="disqualified" ${state.filterStatus==='disqualified'?'selected':''}>Disqualified</option>
      </select>
      <select onchange="ProspectHub.onFilterIcp(this.value)">
        <option value="">All ICPs</option>
        ${state.icps.map(i => `<option value="${i.id}" ${state.filterIcp===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}
      </select>
      <div style="flex:1"></div>
      <span style="font-size:12px;color:var(--text-dim)">${state.total} prospect${state.total!==1?'s':''}</span>
    </div>
    <div class="bulk-toolbar ${state.selectedIds.size?'':'hidden'}" id="bulk-toolbar">
      <span>${state.selectedIds.size} selected</span>
      <button class="btn btn-sm btn-primary" onclick="ProspectHub.enrichSelected()">${icons.enrich} Enrich</button>
      <button class="btn btn-sm" onclick="ProspectHub.exportSelected()">${icons.download} Export CSV</button>
      <button class="btn btn-sm btn-danger" onclick="ProspectHub.deleteSelected()">${icons.trash} Delete</button>
      <button class="btn btn-sm" onclick="ProspectHub.clearSelection()">${icons.close} Clear</button>
    </div>
    <div class="table-container" id="table-container">
      <table class="enrich-table">
        <thead><tr>
          <th><input type="checkbox" class="row-checkbox" onchange="ProspectHub.toggleAll(this.checked)"></th>
          ${columns.map(c => {
            const sorted = state.sort === c.key || state.sort === '-'+c.key;
            const desc = state.sort === '-'+c.key;
            return `<th class="${sorted?'sorted':''}" style="min-width:${c.width}px">
              <div class="th-inner" onclick="ProspectHub.onSort('${c.key}')">
                ${esc(c.label)}
                <span class="sort-arrow">${sorted?(desc?icons.arrowDown:icons.arrowUp):icons.arrowUp}</span>
              </div>
              <div class="resize-handle"></div>
            </th>`;
          }).join('')}
          <th style="width:60px"><div class="th-inner">Actions</div></th>
        </tr></thead>
        <tbody id="prospect-tbody">
          ${renderProspectRows()}
        </tbody>
      </table>
    </div>
  `;
}

function renderProspectRows() {
  if (!state.prospects.length) {
    return `<tr><td colspan="${columns.length+2}" style="text-align:center;padding:40px;color:var(--text-muted)">No prospects yet. Import a CSV or add manually.</td></tr>`;
  }
  return state.prospects.map(p => {
    const sel = state.selectedIds.has(p.id);
    const enriching = state.enrichingIds.has(p.id);
    return `<tr class="${sel?'selected':''}" data-id="${p.id}">
      <td><input type="checkbox" class="row-checkbox" ${sel?'checked':''} onchange="ProspectHub.toggleSelect('${p.id}',this.checked)"></td>
      ${columns.map(c => {
        let content;
        if (c.render) {
          content = c.render(p);
        } else {
          content = esc(p[c.key] || '');
        }
        // Enrichment cell status
        let cellClass = '';
        if (c.enrichField) {
          if (enriching) content = '<span class="enrich-spinner"></span>';
          else if (p[c.key]) cellClass = p.enrichmentData?.fields?.[c.key] ? 'cell-verified' : '';
          else cellClass = 'cell-missing';
        }
        const editable = c.editable && !enriching ? `ondblclick="ProspectHub.startEdit('${p.id}','${c.key}',this)"` : '';
        return `<td class="${cellClass}" ${editable}>${content}</td>`;
      }).join('')}
      <td>
        <button class="row-action-btn" onclick="ProspectHub.enrichOne('${p.id}')" title="Enrich">${icons.enrich}</button>
        <button class="row-action-btn" onclick="ProspectHub.showDetail('${p.id}')" title="Detail">${icons.edit}</button>
      </td>
    </tr>`;
  }).join('');
}

async function loadProspects() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.filterStatus) params.set('status', state.filterStatus);
  if (state.filterIcp) params.set('icp', state.filterIcp);
  if (state.sort) params.set('sort', state.sort);
  const data = await api('/api/prospects?' + params);
  state.prospects = data.prospects || [];
  state.total = data.total || 0;
}

async function loadICPs() { state.icps = await api('/api/icps'); }

// Prospect table interactions
let searchTimer;
window.ProspectHub = {
  onSearch(val) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      state.search = val;
      await loadProspects();
      document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
    }, 300);
  },
  async onFilterStatus(val) {
    state.filterStatus = val;
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
  },
  async onFilterIcp(val) {
    state.filterIcp = val;
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
  },
  onSort(key) {
    if (state.sort === key) state.sort = '-' + key;
    else if (state.sort === '-' + key) state.sort = '';
    else state.sort = key;
    render('prospects');
  },
  toggleAll(checked) {
    if (checked) state.prospects.forEach(p => state.selectedIds.add(p.id));
    else state.selectedIds.clear();
    updateBulkToolbar();
    document.querySelectorAll('#prospect-tbody .row-checkbox').forEach(cb => cb.checked = checked);
    document.querySelectorAll('#prospect-tbody tr').forEach(tr => tr.classList.toggle('selected', checked));
  },
  toggleSelect(id, checked) {
    if (checked) state.selectedIds.add(id); else state.selectedIds.delete(id);
    updateBulkToolbar();
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) tr.classList.toggle('selected', checked);
  },
  clearSelection() {
    state.selectedIds.clear();
    updateBulkToolbar();
    document.querySelectorAll('#prospect-tbody .row-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('#prospect-tbody tr').forEach(tr => tr.classList.remove('selected'));
  },
  async enrichOne(id) {
    state.enrichingIds.add(id);
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
    try {
      await api('/api/prospects/enrich', { method: 'POST', body: { prospectIds: [id] } });
      toast('Enrichment complete', 'success');
    } catch(e) { toast('Enrichment failed', 'error'); }
    state.enrichingIds.delete(id);
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
  },
  async enrichSelected() {
    const ids = [...state.selectedIds];
    if (!ids.length) return;
    ids.forEach(id => state.enrichingIds.add(id));
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
    try {
      await api('/api/prospects/enrich', { method: 'POST', body: { prospectIds: ids } });
      toast(`Enriched ${ids.length} prospects`, 'success');
    } catch(e) { toast('Enrichment failed', 'error'); }
    ids.forEach(id => state.enrichingIds.delete(id));
    state.selectedIds.clear();
    await loadProspects();
    render('prospects');
  },
  async deleteSelected() {
    const ids = [...state.selectedIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} prospects?`)) return;
    await api('/api/prospects', { method: 'DELETE', body: { ids } });
    state.selectedIds.clear();
    toast(`Deleted ${ids.length} prospects`, 'success');
    await loadProspects();
    render('prospects');
  },
  exportSelected() {
    const ids = state.selectedIds.size ? [...state.selectedIds] : null;
    const data = ids ? state.prospects.filter(p => ids.includes(p.id)) : state.prospects;
    const headers = ['firstName','lastName','email','phone','title','company','companySize','industry','linkedinUrl','location','status','icpScore'];
    let csv = headers.join(',') + '\n';
    data.forEach(p => { csv += headers.map(h => `"${(p[h]||'').toString().replace(/"/g,'""')}"`).join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prospects.csv';
    a.click();
    toast('CSV exported', 'success');
  },
  startEdit(id, key, td) {
    const p = state.prospects.find(x => x.id === id);
    if (!p) return;
    td.classList.add('cell-editing');
    td.innerHTML = `<input type="text" value="${esc(p[key]||'')}" onblur="ProspectHub.finishEdit('${id}','${key}',this)" onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.dataset.cancel='1';this.blur();}">`;
    td.querySelector('input').focus();
  },
  async finishEdit(id, key, input) {
    if (input.dataset.cancel) { await loadProspects(); document.getElementById('prospect-tbody').innerHTML = renderProspectRows(); return; }
    const val = input.value;
    await api(`/api/prospects/${id}`, { method: 'PUT', body: { [key]: val } });
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
  },
  showDetail(id) {
    const p = state.prospects.find(x => x.id === id);
    if (!p) return;
    state.detailProspect = p;
    const sidebar = document.getElementById('detail-sidebar');
    sidebar.classList.add('open');
    sidebar.innerHTML = `
      <div class="detail-header">
        <h2>${esc(p.firstName)} ${esc(p.lastName)}</h2>
        <button class="btn btn-icon" onclick="ProspectHub.closeDetail()">${icons.close}</button>
      </div>
      <div class="detail-body">
        <div class="detail-section">
          <h3>Contact Info</h3>
          ${detailField('Email', p.email, true)}
          ${detailField('Phone', p.phone)}
          ${detailField('Title', p.title)}
          ${detailField('Company', p.company)}
          ${detailField('LinkedIn', p.linkedinUrl, true)}
          ${detailField('Location', p.location)}
          ${detailField('Industry', p.industry)}
          ${detailField('Company Size', p.companySize)}
        </div>
        <div class="detail-section">
          <h3>Pipeline</h3>
          ${detailField('Status', `<span class="status-badge status-${p.status}">${p.status}</span>`)}
          ${detailField('ICP Score', p.icpScore||0)}
          ${detailField('ICP', state.icps.find(i=>i.id===p.icpId)?.name || 'None')}
        </div>
        ${p.tags?.length ? `<div class="detail-section"><h3>Tags</h3><div>${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
        ${p.enrichmentData?.enrichedAt ? `<div class="detail-section">
          <h3>Enrichment</h3>
          ${detailField('Provider', p.enrichmentData.provider)}
          ${detailField('Enriched At', new Date(p.enrichmentData.enrichedAt).toLocaleString())}
        </div>` : ''}
        <div class="detail-section">
          <h3>Notes</h3>
          <textarea id="detail-notes" style="width:100%;min-height:80px" onblur="ProspectHub.saveNotes('${p.id}',this.value)">${esc(p.notes||'')}</textarea>
        </div>
        <div class="detail-section">
          <h3>Actions</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="ProspectHub.enrichOne('${p.id}')">${icons.enrich} Enrich</button>
            <select onchange="ProspectHub.updateStatus('${p.id}',this.value)" style="font-size:12px">
              ${['new','enriched','contacted','replied','qualified','disqualified'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <select onchange="ProspectHub.assignIcp('${p.id}',this.value)" style="font-size:12px">
              <option value="">Assign ICP</option>
              ${state.icps.map(i => `<option value="${i.id}" ${p.icpId===i.id?'selected':''}>${esc(i.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  },
  closeDetail,
  async saveNotes(id, val) { await api(`/api/prospects/${id}`, { method: 'PUT', body: { notes: val } }); },
  async updateStatus(id, val) {
    await api(`/api/prospects/${id}`, { method: 'PUT', body: { status: val } });
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
    this.showDetail(id);
  },
  async assignIcp(id, val) {
    await api(`/api/prospects/${id}`, { method: 'PUT', body: { icpId: val } });
    await loadProspects();
    document.getElementById('prospect-tbody').innerHTML = renderProspectRows();
    this.showDetail(id);
  },

  // Add prospect modal
  showAddModal() {
    showModal('Add Prospect', `
      <div class="form-group"><label>First Name</label><input type="text" id="add-fn"></div>
      <div class="form-group"><label>Last Name</label><input type="text" id="add-ln"></div>
      <div class="form-group"><label>Email</label><input type="email" id="add-email"></div>
      <div class="form-group"><label>Title</label><input type="text" id="add-title"></div>
      <div class="form-group"><label>Company</label><input type="text" id="add-company"></div>
      <div class="form-group"><label>Phone</label><input type="text" id="add-phone"></div>
      <div class="form-group"><label>LinkedIn URL</label><input type="url" id="add-linkedin"></div>
      <div class="form-group"><label>Location</label><input type="text" id="add-location"></div>
      <div class="form-group"><label>Industry</label><input type="text" id="add-industry"></div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      { label: 'Add Prospect', primary: true, action: 'ProspectHub.doAdd()' }
    ]);
  },
  async doAdd() {
    const g = id => document.getElementById(id)?.value || '';
    await api('/api/prospects', { method: 'POST', body: {
      firstName: g('add-fn'), lastName: g('add-ln'), email: g('add-email'),
      title: g('add-title'), company: g('add-company'), phone: g('add-phone'),
      linkedinUrl: g('add-linkedin'), location: g('add-location'), industry: g('add-industry')
    }});
    closeModal();
    toast('Prospect added', 'success');
    render('prospects');
  },

  // Import CSV modal
  showImportModal() {
    showModal('Import CSV', `
      <div class="form-group">
        <label>Upload CSV file</label>
        <input type="file" id="csv-file" accept=".csv" style="padding:8px" onchange="ProspectHub.previewCSV()">
      </div>
      <div id="csv-preview" style="max-height:300px;overflow:auto;font-size:12px"></div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      { label: 'Import', primary: true, action: 'ProspectHub.doImport()' }
    ], 'modal-lg');
  },
  previewCSV() {
    const file = document.getElementById('csv-file').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').slice(0, 6);
      const preview = document.getElementById('csv-preview');
      preview.innerHTML = `<div style="color:var(--text-dim);margin-bottom:8px">${file.name} — Preview (first 5 rows)</div>
        <table class="enrich-table" style="font-size:11px">${lines.map((l,i) => 
          `<tr>${l.split(',').map(c => `<${i===0?'th':'td'} style="padding:4px 8px;border:1px solid var(--border)">${esc(c.replace(/^"|"$/g,'').trim())}</${i===0?'th':'td'}>`).join('')}</tr>`
        ).join('')}</table>`;
    };
    reader.readAsText(file);
  },
  async doImport() {
    const file = document.getElementById('csv-file').files[0];
    if (!file) { toast('Select a CSV file', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    const result = await api('/api/prospects/import', { method: 'POST', body: fd });
    closeModal();
    toast(`Imported ${result.imported} prospects`, 'success');
    render('prospects');
  }
};

function detailField(label, val, isLink) {
  const display = isLink && val ? `<a href="${val.includes('@')?'mailto:':''}${esc(val)}" target="_blank">${esc(val)}</a>` : (typeof val === 'string' ? esc(val) : val);
  return `<div class="detail-field"><span class="field-label">${label}</span><span class="field-value">${display||'—'}</span></div>`;
}

function updateBulkToolbar() {
  const tb = document.getElementById('bulk-toolbar');
  if (tb) {
    tb.classList.toggle('hidden', state.selectedIds.size === 0);
    tb.querySelector('span').textContent = state.selectedIds.size + ' selected';
  }
}

function closeDetail() {
  document.getElementById('detail-sidebar').classList.remove('open');
  state.detailProspect = null;
}

// ==================== ICPs ====================
async function renderICPs(el) {
  state.icps = await api('/api/icps');
  const prospects = (await api('/api/prospects')).prospects || [];
  
  el.innerHTML = `
    <div class="page-header"><h1>Ideal Customer Profiles</h1>
      <div class="page-header-actions"><button class="btn btn-primary" onclick="ICPHub.showAdd()">${icons.plus} New ICP</button></div>
    </div>
    <div class="icp-grid">
      ${state.icps.length ? state.icps.map(icp => {
        const cnt = prospects.filter(p => p.icpId === icp.id).length;
        const c = icp.criteria || {};
        const tags = [...(c.industries||[]), ...(c.titles||[]), ...(c.locations||[]), ...(c.companySizes||[])];
        return `<div class="icp-card">
          <div class="icp-card-header"><div class="icp-color-dot" style="background:${icp.color||'#ff6b35'}"></div><h3>${esc(icp.name)}</h3></div>
          ${icp.description ? `<p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${esc(icp.description)}</p>` : ''}
          <div class="icp-criteria-list">${tags.map(t => `<span class="criteria-tag">${esc(t)}</span>`).join('')}</div>
          <div class="icp-card-footer">
            <span>${cnt} prospect${cnt!==1?'s':''}</span>
            <div class="icp-card-actions">
              <button class="btn btn-sm" onclick="ICPHub.edit('${icp.id}')">${icons.edit} Edit</button>
              <button class="btn btn-sm btn-danger" onclick="ICPHub.del('${icp.id}')">${icons.trash}</button>
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><p>No ICPs defined yet. Create your first ideal customer profile.</p></div>'}
    </div>
  `;
}

window.ICPHub = {
  showAdd(existing) {
    const icp = existing || { name:'', description:'', criteria: { industries:[], companySizes:[], titles:[], locations:[], fundingStages:[], techStack:[] }, color:'#ff6b35' };
    const isEdit = !!existing;
    const colors = ['#ff6b35','#3b82f6','#22c55e','#eab308','#ef4444','#a855f7','#ec4899','#06b6d4'];
    showModal(isEdit ? 'Edit ICP' : 'New ICP', `
      <div class="form-group"><label>Name</label><input type="text" id="icp-name" value="${esc(icp.name)}"></div>
      <div class="form-group"><label>Description</label><textarea id="icp-desc">${esc(icp.description)}</textarea></div>
      <div class="form-group"><label>Color</label><div class="color-picker-row">${colors.map(c => `<div class="color-swatch ${c===icp.color?'selected':''}" style="background:${c}" onclick="document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));this.classList.add('selected');this.dataset.sel='1'" data-color="${c}"></div>`).join('')}</div></div>
      <div class="form-group"><label>Industries (comma separated)</label><input type="text" id="icp-industries" value="${(icp.criteria.industries||[]).join(', ')}"></div>
      <div class="form-group"><label>Titles / Roles (comma separated)</label><input type="text" id="icp-titles" value="${(icp.criteria.titles||[]).join(', ')}"></div>
      <div class="form-group"><label>Locations (comma separated)</label><input type="text" id="icp-locations" value="${(icp.criteria.locations||[]).join(', ')}"></div>
      <div class="form-group"><label>Company Sizes (comma separated)</label><input type="text" id="icp-sizes" value="${(icp.criteria.companySizes||[]).join(', ')}"></div>
      <div class="form-group"><label>Tech Stack (comma separated)</label><input type="text" id="icp-tech" value="${(icp.criteria.techStack||[]).join(', ')}"></div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      { label: isEdit ? 'Update' : 'Create', primary: true, action: isEdit ? `ICPHub.doEdit('${icp.id}')` : 'ICPHub.doAdd()' }
    ]);
  },
  async doAdd() {
    const data = getICPForm();
    await api('/api/icps', { method: 'POST', body: data });
    closeModal(); toast('ICP created', 'success'); render('icps');
  },
  async edit(id) {
    const icp = state.icps.find(i => i.id === id);
    if (icp) this.showAdd(icp);
  },
  async doEdit(id) {
    const data = getICPForm();
    await api(`/api/icps/${id}`, { method: 'PUT', body: data });
    closeModal(); toast('ICP updated', 'success'); render('icps');
  },
  async del(id) {
    if (!confirm('Delete this ICP?')) return;
    await api(`/api/icps/${id}`, { method: 'DELETE' });
    toast('ICP deleted', 'success'); render('icps');
  }
};

function getICPForm() {
  const split = v => v.split(',').map(s => s.trim()).filter(Boolean);
  const color = document.querySelector('.color-swatch.selected')?.dataset?.color || '#ff6b35';
  return {
    name: document.getElementById('icp-name').value,
    description: document.getElementById('icp-desc').value,
    color,
    criteria: {
      industries: split(document.getElementById('icp-industries').value),
      titles: split(document.getElementById('icp-titles').value),
      locations: split(document.getElementById('icp-locations').value),
      companySizes: split(document.getElementById('icp-sizes').value),
      techStack: split(document.getElementById('icp-tech').value),
      fundingStages: []
    }
  };
}

// ==================== CAMPAIGNS ====================
async function renderCampaigns(el) {
  state.campaigns = await api('/api/campaigns');
  
  el.innerHTML = `
    <div class="page-header"><h1>Campaigns</h1>
      <div class="page-header-actions"><button class="btn btn-primary" onclick="CampaignHub.showAdd()">${icons.plus} New Campaign</button></div>
    </div>
    <div class="campaign-list">
      ${state.campaigns.length ? state.campaigns.map(c => `
        <div class="campaign-item" onclick="CampaignHub.showDetail('${c.id}')">
          <div class="campaign-info">
            <h3>${esc(c.name)}</h3>
            <div class="campaign-meta">
              <span class="status-badge status-${c.status==='active'?'enriched':c.status==='paused'?'contacted':'new'}">${c.status}</span>
              <span>${c.steps?.length||0} steps</span>
              <span>${c.prospects?.length||0} prospects</span>
            </div>
          </div>
          <div class="campaign-stats">
            <span>Sent: <span class="campaign-stat-val">${c.stats?.sent||0}</span></span>
            <span>Opened: <span class="campaign-stat-val">${c.stats?.opened||0}</span></span>
            <span>Replied: <span class="campaign-stat-val">${c.stats?.replied||0}</span></span>
          </div>
        </div>
      `).join('') : '<div class="empty-state"><p>No campaigns yet. Create your first outreach sequence.</p></div>'}
    </div>
  `;
}

window.CampaignHub = {
  showAdd() {
    showModal('New Campaign', `
      <div class="form-group"><label>Campaign Name</label><input type="text" id="camp-name"></div>
      <div class="form-group"><label>ICP</label><select id="camp-icp">
        <option value="">Select ICP</option>
        ${state.icps.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}
      </select></div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      { label: 'Create', primary: true, action: 'CampaignHub.doAdd()' }
    ]);
  },
  async doAdd() {
    await api('/api/campaigns', { method: 'POST', body: {
      name: document.getElementById('camp-name').value,
      icpId: document.getElementById('camp-icp').value
    }});
    closeModal(); toast('Campaign created', 'success'); render('campaigns');
  },
  async showDetail(id) {
    const c = state.campaigns.find(x => x.id === id);
    if (!c) return;
    const el = document.getElementById('page-content');
    el.innerHTML = `
      <div class="page-header">
        <h1><button class="btn btn-sm" onclick="render('campaigns')" style="margin-right:8px">&larr;</button> ${esc(c.name)}</h1>
        <div class="page-header-actions">
          <select onchange="CampaignHub.updateStatus('${id}',this.value)">
            ${['draft','active','paused','completed'].map(s => `<option value="${s}" ${c.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <button class="btn btn-danger btn-sm" onclick="CampaignHub.del('${id}')">${icons.trash} Delete</button>
        </div>
      </div>
      <div class="campaign-detail">
        <div style="display:flex;gap:16px;margin-bottom:24px">
          <div class="stat-card"><div class="stat-label">Sent</div><div class="stat-value">${c.stats?.sent||0}</div></div>
          <div class="stat-card"><div class="stat-label">Opened</div><div class="stat-value">${c.stats?.opened||0}</div></div>
          <div class="stat-card"><div class="stat-label">Replied</div><div class="stat-value">${c.stats?.replied||0}</div></div>
          <div class="stat-card"><div class="stat-label">Bounced</div><div class="stat-value">${c.stats?.bounced||0}</div></div>
        </div>
        <h2 style="font-size:14px;font-weight:600;margin-bottom:8px">Sequence Steps</h2>
        <div class="step-cards" id="step-cards">
          ${(c.steps||[]).map((s,i) => `
            ${i>0?'<div class="step-connector"></div>':''}
            <div class="step-card">
              <div class="step-card-header"><div class="step-number">${i+1}</div><span>Day ${s.delayDays||0} — ${esc(s.subject||'No subject')}</span>
                <button class="row-action-btn" style="margin-left:auto" onclick="CampaignHub.removeStep('${id}',${i})">${icons.x}</button>
              </div>
              <div style="font-size:12px;color:var(--text-dim);white-space:pre-wrap">${esc(s.body||'')}</div>
            </div>
          `).join('')}
        </div>
        <button class="btn" style="margin-top:12px" onclick="CampaignHub.addStep('${id}')">${icons.plus} Add Step</button>
        <h2 style="font-size:14px;font-weight:600;margin:24px 0 8px">Prospects (${c.prospects?.length||0})</h2>
        <p style="font-size:12px;color:var(--text-dim)">Add prospects from the Prospects table using bulk select.</p>
      </div>
    `;
  },
  addStep(id) {
    showModal('Add Step', `
      <div class="form-group"><label>Delay (days from previous)</label><input type="number" id="step-delay" value="3" min="0"></div>
      <div class="form-group"><label>Subject</label><input type="text" id="step-subject" placeholder="Hi {first_name}, ..."></div>
      <div class="form-group"><label>Body</label><textarea id="step-body" rows="6" placeholder="Use {first_name}, {company}, {title} as merge fields..."></textarea></div>
      <div style="font-size:11px;color:var(--text-dim)">Available merge fields: {first_name}, {last_name}, {company}, {title}, {industry}</div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      { label: 'Add Step', primary: true, action: `CampaignHub.doAddStep('${id}')` }
    ]);
  },
  async doAddStep(id) {
    const c = state.campaigns.find(x => x.id === id);
    const steps = [...(c.steps||[]), {
      order: (c.steps?.length||0)+1,
      delayDays: parseInt(document.getElementById('step-delay').value)||0,
      subject: document.getElementById('step-subject').value,
      body: document.getElementById('step-body').value
    }];
    await api(`/api/campaigns/${id}`, { method: 'PUT', body: { steps } });
    closeModal();
    state.campaigns = await api('/api/campaigns');
    this.showDetail(id);
  },
  async removeStep(id, idx) {
    const c = state.campaigns.find(x => x.id === id);
    const steps = (c.steps||[]).filter((_,i) => i !== idx);
    await api(`/api/campaigns/${id}`, { method: 'PUT', body: { steps } });
    state.campaigns = await api('/api/campaigns');
    this.showDetail(id);
  },
  async updateStatus(id, status) {
    await api(`/api/campaigns/${id}`, { method: 'PUT', body: { status } });
    state.campaigns = await api('/api/campaigns');
    toast('Campaign updated', 'success');
  },
  async del(id) {
    if (!confirm('Delete this campaign?')) return;
    await api(`/api/campaigns/${id}`, { method: 'DELETE' });
    toast('Campaign deleted', 'success');
    render('campaigns');
  }
};

// ==================== TEMPLATES ====================
async function renderTemplates(el) {
  state.templates = await api('/api/templates');
  
  el.innerHTML = `
    <div class="page-header"><h1>Email Templates</h1>
      <div class="page-header-actions"><button class="btn btn-primary" onclick="TemplateHub.showAdd()">${icons.plus} New Template</button></div>
    </div>
    <div class="template-grid">
      ${state.templates.length ? state.templates.map(t => `
        <div class="template-card" onclick="TemplateHub.edit('${t.id}')">
          <div class="template-category">${esc(t.category||'')}</div>
          <h3>${esc(t.name)}</h3>
          <div style="font-size:11px;color:var(--text-dim);margin:4px 0">${esc(t.subject)}</div>
          <div class="template-preview">${esc(t.body)}</div>
        </div>
      `).join('') : '<div class="empty-state"><p>No templates yet. Create your first email template.</p></div>'}
    </div>
  `;
}

window.TemplateHub = {
  showAdd(existing) {
    const t = existing || { name:'', category:'cold-intro', subject:'', body:'' };
    const isEdit = !!existing?.id;
    showModal(isEdit ? 'Edit Template' : 'New Template', `
      <div class="form-group"><label>Name</label><input type="text" id="tpl-name" value="${esc(t.name)}"></div>
      <div class="form-group"><label>Category</label><select id="tpl-cat">
        ${['cold-intro','follow-up','breakup','referral','event'].map(c => `<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Subject</label><input type="text" id="tpl-subject" value="${esc(t.subject)}" placeholder="Hi {first_name}, ..."></div>
      <div class="form-group"><label>Body</label><textarea id="tpl-body" rows="8">${esc(t.body)}</textarea></div>
      <div style="font-size:11px;color:var(--text-dim)">Merge fields: {first_name}, {last_name}, {company}, {title}, {industry}</div>
    `, [
      { label: 'Cancel', action: 'closeModal()' },
      isEdit ? { label: 'Delete', action: `TemplateHub.del('${t.id}')`, danger: true } : null,
      { label: isEdit ? 'Update' : 'Create', primary: true, action: isEdit ? `TemplateHub.doEdit('${t.id}')` : 'TemplateHub.doAdd()' }
    ].filter(Boolean), 'modal-lg');
  },
  async doAdd() {
    await api('/api/templates', { method: 'POST', body: {
      name: document.getElementById('tpl-name').value,
      category: document.getElementById('tpl-cat').value,
      subject: document.getElementById('tpl-subject').value,
      body: document.getElementById('tpl-body').value,
      mergeFields: ['first_name','last_name','company','title','industry']
    }});
    closeModal(); toast('Template created', 'success'); render('templates');
  },
  async edit(id) {
    const t = state.templates.find(x => x.id === id);
    if (t) this.showAdd(t);
  },
  async doEdit(id) {
    await api(`/api/templates/${id}`, { method: 'PUT', body: {
      name: document.getElementById('tpl-name').value,
      category: document.getElementById('tpl-cat').value,
      subject: document.getElementById('tpl-subject').value,
      body: document.getElementById('tpl-body').value
    }});
    closeModal(); toast('Template updated', 'success'); render('templates');
  },
  async del(id) {
    if (!confirm('Delete this template?')) return;
    await api(`/api/templates/${id}`, { method: 'DELETE' });
    closeModal(); toast('Template deleted', 'success'); render('templates');
  }
};

// ==================== SETTINGS ====================
async function renderSettings(el) {
  state.config = await api('/api/config');
  const c = state.config;
  
  el.innerHTML = `
    <div class="page-header"><h1>Settings</h1></div>
    <div class="settings-page">
      <div class="settings-section">
        <h2>API Keys</h2>
        <div class="form-group"><label>Apollo.io</label><input type="password" id="key-apollo" value="${esc(c.apiKeys?.apollo||'')}" placeholder="Enter Apollo API key"></div>
        <div class="form-group"><label>ContactOut</label><input type="password" id="key-contactout" value="${esc(c.apiKeys?.contactout||'')}" placeholder="Enter ContactOut API key"></div>
        <div class="form-group"><label>RocketReach</label><input type="password" id="key-rocketreach" value="${esc(c.apiKeys?.rocketreach||'')}" placeholder="Enter RocketReach API key"></div>
        <div class="form-group"><label>Hunter.io</label><input type="password" id="key-hunter" value="${esc(c.apiKeys?.hunter||'')}" placeholder="Enter Hunter API key"></div>
      </div>
      <div class="settings-section">
        <h2>Enrichment Waterfall Order</h2>
        <div class="waterfall-list" id="waterfall-list">
          ${(c.waterfallOrder||['apollo','contactout','rocketreach','hunter']).map((p,i) => `
            <div class="waterfall-item" draggable="true" data-provider="${p}">
              <span class="drag-handle">&#x2261;</span>
              <span style="flex:1;text-transform:capitalize">${p}</span>
              <span style="font-size:11px;color:var(--text-muted)">#${i+1}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="settings-section">
        <h2>Sender Configuration</h2>
        <div class="form-group"><label>Sender Name</label><input type="text" id="sender-name" value="${esc(c.senderName||'')}"></div>
        <div class="form-group"><label>Sender Email</label><input type="email" id="sender-email" value="${esc(c.senderEmail||'')}"></div>
      </div>
      <button class="btn btn-primary" onclick="SettingsHub.save()">Save Settings</button>
    </div>
  `;
  
  // Waterfall drag and drop
  initWaterfallDrag();
}

function initWaterfallDrag() {
  const list = document.getElementById('waterfall-list');
  if (!list) return;
  let dragItem = null;
  list.querySelectorAll('.waterfall-item').forEach(item => {
    item.addEventListener('dragstart', () => { dragItem = item; item.style.opacity = '0.4'; });
    item.addEventListener('dragend', () => { item.style.opacity = '1'; });
    item.addEventListener('dragover', (e) => { e.preventDefault(); });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragItem && dragItem !== item) {
        const items = [...list.children];
        const fromIdx = items.indexOf(dragItem);
        const toIdx = items.indexOf(item);
        if (fromIdx < toIdx) item.after(dragItem);
        else item.before(dragItem);
        // Update numbers
        list.querySelectorAll('.waterfall-item').forEach((el,i) => {
          el.querySelector('span:last-child').textContent = '#' + (i+1);
        });
      }
    });
  });
}

window.SettingsHub = {
  async save() {
    const waterfallOrder = [...document.querySelectorAll('#waterfall-list .waterfall-item')].map(el => el.dataset.provider);
    await api('/api/config', { method: 'PUT', body: {
      apiKeys: {
        apollo: document.getElementById('key-apollo').value,
        contactout: document.getElementById('key-contactout').value,
        rocketreach: document.getElementById('key-rocketreach').value,
        hunter: document.getElementById('key-hunter').value
      },
      waterfallOrder,
      senderName: document.getElementById('sender-name').value,
      senderEmail: document.getElementById('sender-email').value
    }});
    toast('Settings saved', 'success');
  }
};

// ==================== MODAL ====================
function showModal(title, bodyHtml, buttons, extraClass) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal ${extraClass||''}">
      <div class="modal-header"><h2>${title}</h2><button class="modal-close" onclick="closeModal()">${icons.close}</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${buttons.map(b => `<button class="btn ${b.primary?'btn-primary':''} ${b.danger?'btn-danger':''}" onclick="${b.action}">${b.label}</button>`).join('')}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-overlay').innerHTML = '';
};

// Click on prospect name opens detail
document.addEventListener('click', (e) => {
  const nameEl = e.target.closest('.prospect-name');
  if (nameEl) ProspectHub.showDetail(nameEl.dataset.id);
});

// Init
route();
})();
