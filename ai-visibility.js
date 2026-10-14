/* ==========================================================================
   AI VISIBILITY

   An "AI Visibility" tab for each SEO client, plus the renderer the public
   report page (ai-report.html) shares. Data comes from the AI Visibility
   Tracker (a Google Sheet + Apps Script web app), which collects:

     GA4            clicks arriving from ChatGPT, Perplexity, Gemini, Copilot...
     Search Console Generative AI impressions (AI Overviews / AI Mode)
     Bing WMT       Copilot / Bing AI citations, pages and grounding queries
     Server logs    live fetches by ChatGPT-User, Claude-User, Perplexity-User
     Prompt checks  weekly questions asked of ChatGPT, Gemini, Perplexity, Claude

   This file deliberately lives outside index.html. It reads the app's shared
   globals (state, save, fbDb) and attaches to the tab strip from the
   outside, so the main app needs only the one <script> line that loads it.
   ========================================================================== */
(function(){
'use strict';

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = n => (Number(n) || 0).toLocaleString('en-CA');
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const normDomain = v => String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#:]/)[0];
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
const isoDay = d => d.toISOString().slice(0, 10);
const daysAgo = n => isoDay(new Date(Date.now() - n * 86400000));
const prettyDate = d => {
  if (!d) return 'never';
  const t = new Date(d + 'T12:00:00');
  return isNaN(t) ? d : t.toLocaleDateString('en-CA', {month:'short', day:'numeric', year:'numeric'});
};
const prettyMonth = m => {
  const t = new Date(m + '-15T12:00:00');
  return isNaN(t) ? m : t.toLocaleDateString('en-CA', {month:'short', year:'numeric'});
};
const shortUrl = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '') || '/';

const PLATFORM_ORDER = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Copilot', 'Meta AI', 'Grok', 'DeepSeek', 'Other AI'];

/* ---------- styles (scoped to .aiv) ---------- */
function injectStyles(){
  if (document.getElementById('aivStyles')) return;
  const css = `
.aiv{--aiv-brand:var(--brand,#e87722);--aiv-deep:var(--brand-deep,#b8570f);--aiv-wash:var(--brand-wash,#fdf1e6);
  --aiv-card:var(--card,#fff);--aiv-card2:var(--card-2,#f7f9fa);--aiv-line:var(--line,#e4e9ed);--aiv-line2:var(--line-2,#eef2f5);
  --aiv-ink:var(--ink,#1b222a);--aiv-ink2:var(--ink-2,#57646f);--aiv-ink3:var(--ink-3,#8b98a3);--aiv-good:var(--good,#0f7a58);
  --aiv-goodw:var(--good-wash,#e6f5ef);--aiv-alert:var(--alert,#b5352a);
  font-family:var(--ui,Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif);color:var(--aiv-ink);font-size:13px;}
.aiv *{box-sizing:border-box;}
.aiv-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:4px 0 18px;}
.aiv-title{font-family:var(--display,Poppins,Inter,sans-serif);font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0;}
.aiv-sub{color:var(--aiv-ink2);font-size:12.5px;margin-top:4px;}
.aiv-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.aiv-btn{font:600 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--aiv-line);background:var(--aiv-card);color:var(--aiv-ink);
  border-radius:9px;padding:7px 12px;cursor:pointer;transition:all .15s;}
.aiv-btn:hover{border-color:var(--aiv-brand);color:var(--aiv-deep);}
.aiv-btn.go{background:var(--aiv-brand);border-color:var(--aiv-brand);color:#fff;}
.aiv-btn.go:hover{background:var(--aiv-deep);color:#fff;}
.aiv-btn[disabled]{opacity:.55;cursor:default;}
.aiv-seg{display:inline-flex;background:var(--aiv-line2);border-radius:9px;padding:3px;}
.aiv-seg button{border:0;background:none;font:600 12px var(--ui,Inter,sans-serif);color:var(--aiv-ink2);padding:5px 10px;border-radius:7px;cursor:pointer;}
.aiv-seg button.on{background:var(--aiv-card);color:var(--aiv-deep);box-shadow:0 1px 2px rgba(20,28,36,.08);}
.aiv-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:18px;}
.aiv-tile{background:var(--aiv-card);border:1px solid var(--aiv-line);border-radius:16px;padding:16px 18px;}
.aiv-tile-label{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--aiv-ink3);font-weight:700;}
.aiv-tile-val{font-family:var(--display,Poppins,Inter,sans-serif);font-size:28px;font-weight:600;letter-spacing:-.02em;margin:6px 0 2px;}
.aiv-tile-note{font-size:11.5px;color:var(--aiv-ink2);}
.aiv-tile-kind{display:inline-block;font-size:10px;font-weight:700;border-radius:20px;padding:2px 7px;margin-top:8px;}
.aiv-kind-real{background:var(--aiv-goodw);color:var(--aiv-good);}
.aiv-kind-sample{background:var(--aiv-wash);color:var(--aiv-deep);}
.aiv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px;}
.aiv-card{background:var(--aiv-card);border:1px solid var(--aiv-line);border-radius:16px;padding:18px 20px;min-width:0;}
.aiv-card h3{font-family:var(--display,Poppins,Inter,sans-serif);font-size:15px;font-weight:600;letter-spacing:-.01em;margin:0 0 4px;}
.aiv-card .aiv-cap{color:var(--aiv-ink2);font-size:12px;margin:0 0 14px;}
.aiv-chart{width:100%;height:auto;display:block;}
.aiv-chart .bar{fill:var(--aiv-brand);}
.aiv-chart .bar:hover{fill:var(--aiv-deep);}
.aiv-chart .axis{fill:var(--aiv-ink3);font-size:13px;font-family:var(--mono,Consolas,monospace);}
.aiv-chart .grid{stroke:var(--aiv-line2);stroke-width:1;}
.aiv-empty{color:var(--aiv-ink3);font-size:12.5px;padding:14px 0;}
.aiv-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.aiv-table th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--aiv-ink3);font-weight:700;
  padding:8px 10px;border-bottom:1px solid var(--aiv-line);white-space:nowrap;}
.aiv-table td{padding:8px 10px;border-bottom:1px solid var(--aiv-line2);vertical-align:top;}
.aiv-table td.num,.aiv-table th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.aiv-table tr:last-child td{border-bottom:0;}
.aiv-table a{color:var(--aiv-deep);text-decoration:none;word-break:break-all;}
.aiv-table a:hover{text-decoration:underline;}
.aiv-scroll{overflow-x:auto;max-height:460px;overflow-y:auto;}
.aiv-pill{display:inline-block;font-size:10.5px;font-weight:700;border-radius:20px;padding:2px 8px;white-space:nowrap;}
.aiv-yes{background:var(--aiv-goodw);color:var(--aiv-good);}
.aiv-no{background:var(--aiv-line2);color:var(--aiv-ink3);}
.aiv-bar-row{display:grid;grid-template-columns:110px 1fr 60px;gap:10px;align-items:center;margin:7px 0;font-size:12.5px;}
.aiv-bar-track{height:8px;background:var(--aiv-line2);border-radius:6px;overflow:hidden;}
.aiv-bar-fill{height:100%;background:var(--aiv-brand);border-radius:6px;}
.aiv-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.aiv-filters select,.aiv-filters input,.aiv-form input{font:500 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--aiv-line);
  border-radius:8px;padding:6px 9px;background:var(--aiv-card);color:var(--aiv-ink);}
.aiv-filters input{flex:1;min-width:160px;}
.aiv-notes{font-size:12px;color:var(--aiv-ink2);line-height:1.55;}
.aiv-notes b{color:var(--aiv-ink);}
.aiv-notes p{margin:0 0 8px;}
.aiv-msg{background:var(--aiv-card);border:1px solid var(--aiv-line);border-radius:16px;padding:28px;text-align:center;color:var(--aiv-ink2);}
.aiv-msg h3{font-family:var(--display,Poppins,Inter,sans-serif);color:var(--aiv-ink);margin:0 0 8px;font-size:17px;font-weight:600;}
.aiv-msg.err{border-color:#f0c9c4;}
.aiv-form{max-width:520px;margin:0 auto;text-align:left;}
.aiv-form label{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--aiv-ink3);font-weight:700;margin:14px 0 6px;}
.aiv-form input{width:100%;}
.aiv-form .aiv-actions{margin-top:16px;}
.aiv-share{background:var(--aiv-card2);border:1px solid var(--aiv-line);border-radius:12px;padding:14px 16px;margin-bottom:16px;}
.aiv-share textarea,.aiv-share input{width:100%;font:12px var(--mono,Consolas,monospace);border:1px solid var(--aiv-line);border-radius:8px;padding:7px 9px;
  background:var(--aiv-card);color:var(--aiv-ink);resize:none;margin:4px 0 10px;}
.aiv-share label{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--aiv-ink3);font-weight:700;}
.aiv-status{font-size:12px;color:var(--aiv-ink2);}
.aiv-status.err{color:var(--aiv-alert);}
.aiv-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--aiv-ink2);cursor:pointer;}
.aiv-spin{display:inline-block;width:14px;height:14px;border:2px solid var(--aiv-line);border-top-color:var(--aiv-brand);border-radius:50%;
  animation:aivspin .8s linear infinite;vertical-align:-2px;margin-right:6px;}
@keyframes aivspin{to{transform:rotate(360deg);}}
@media (max-width:640px){.aiv-grid{grid-template-columns:1fr;}.aiv-bar-row{grid-template-columns:90px 1fr 50px;}}
`;
  const st = document.createElement('style');
  st.id = 'aivStyles';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ---------- tracker API ---------- */
async function apiGet(base, params){
  const qs = Object.keys(params).filter(k => params[k] != null && params[k] !== '')
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  const res = await fetch(base + (base.indexOf('?') > -1 ? '&' : '?') + qs, {redirect:'follow'});
  if (!res.ok) throw new Error('The tracker answered with HTTP ' + res.status + '.');
  const json = await res.json().catch(() => { throw new Error('The tracker did not return data. Check the web app is deployed with access set to Anyone.'); });
  if (json && json.error) throw new Error(json.error === 'unauthorized' ? 'The tracker did not accept this key.' : json.error);
  return json;
}
/* text/plain keeps this a "simple" request, so the browser skips the CORS
   preflight Apps Script cannot answer. */
async function apiPost(base, body){
  const res = await fetch(base, {method:'POST', body: JSON.stringify(body), redirect:'follow'});
  if (!res.ok) throw new Error('The tracker answered with HTTP ' + res.status + '.');
  const json = await res.json();
  if (json && json.error) throw new Error(json.error === 'unauthorized' ? 'The tracker did not accept this key.' : json.error);
  return json;
}

/* ---------- data shaping ---------- */
function sumSince(daily, since, field){
  return (daily || []).reduce((t, r) => r.d >= since ? t + (Number(r[field || 'n']) || 0) : t, 0);
}
function bucketDaily(daily, since, field){
  /* Daily bars up to 90 days, weekly beyond that so bars stay readable. */
  const days = Math.round((Date.now() - new Date(since + 'T00:00:00')) / 86400000);
  const weekly = days > 95;
  const map = {};
  (daily || []).forEach(r => {
    if (r.d < since) return;
    let key = r.d;
    if (weekly){
      const t = new Date(r.d + 'T12:00:00');
      t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      key = isoDay(t);
    }
    map[key] = (map[key] || 0) + (Number(r[field || 'n']) || 0);
  });
  const out = [];
  const start = new Date(since + 'T12:00:00');
  if (weekly) start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date();
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + (weekly ? 7 : 1))){
    const k = isoDay(t);
    out.push({d: k, n: map[k] || 0});
  }
  return {rows: out, weekly};
}

function barChart(series, label){
  const rows = series.rows;
  if (!rows.length || !rows.some(r => r.n)) return '<div class="aiv-empty">No ' + esc(label) + ' recorded in this period yet.</div>';
  const W = 640, H = 160, padL = 44, padB = 20, padT = 8;
  const max = Math.max(...rows.map(r => r.n));
  const niceMax = max <= 5 ? 5 : Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const bw = (W - padL) / rows.length;
  const y = v => padT + (H - padT - padB) * (1 - v / niceMax);
  let svg = '<svg class="aiv-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + ' over time">';
  [0, .5, 1].forEach(f => {
    const v = Math.round(niceMax * f), yy = y(v);
    svg += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '"/>';
    svg += '<text class="axis" x="' + (padL - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' + fmt(v) + '</text>';
  });
  rows.forEach((r, i) => {
    const h = Math.max(r.n ? 1.5 : 0, (H - padT - padB) - (y(r.n) - padT));
    const x = padL + i * bw + bw * 0.15;
    svg += '<rect class="bar" x="' + x.toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + Math.max(1, bw * 0.7).toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="1.5"><title>' + (series.weekly ? 'Week of ' : '') + esc(prettyDate(r.d)) + ': ' + fmt(r.n) + '</title></rect>';
  });
  const first = rows[0].d, last = rows[rows.length - 1].d;
  svg += '<text class="axis" x="' + padL + '" y="' + (H - 4) + '">' + esc(prettyDate(first)) + '</text>';
  svg += '<text class="axis" x="' + W + '" y="' + (H - 4) + '" text-anchor="end">' + esc(prettyDate(last)) + '</text>';
  return svg + '</svg>';
}

function barList(rows, valueLabel){
  if (!rows.length) return '<div class="aiv-empty">Nothing recorded yet.</div>';
  const max = Math.max(...rows.map(r => r.n), 1);
  return rows.map(r => '<div class="aiv-bar-row"><span>' + esc(r.label) + '</span>' +
    '<div class="aiv-bar-track"><div class="aiv-bar-fill" style="width:' + (r.n / max * 100).toFixed(1) + '%"></div></div>' +
    '<span class="num" style="text-align:right">' + esc(r.text || fmt(r.n)) + '</span></div>').join('') +
    (valueLabel ? '<div class="aiv-cap" style="margin:8px 0 0">' + esc(valueLabel) + '</div>' : '');
}

function linkCell(u){
  const s = safeUrl(u);
  if (!s) return esc(u || '/');
  return '<a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + esc(shortUrl(s)) + '</a>';
}
function pathCell(domain, p){
  if (safeUrl(p)) return linkCell(p);
  const path = String(p || '/');
  return linkCell('https://' + domain + (path.charAt(0) === '/' ? '' : '/') + path);
}

/* ==========================================================================
   SHARED RENDERER  (SEO tool tab and public report)
   ========================================================================== */
function render(root, feed, opts){
  opts = opts || {};
  injectStyles();
  const period = opts.period || 30;
  const since = daysAgo(period);
  const domain = feed.domain;

  const ga4Clicks = sumSince(feed.ga4.daily, since, 's');
  const ga4Conv = sumSince(feed.ga4.daily, since, 'k');
  const gImp = sumSince(feed.google.daily, since);
  const bCit = sumSince(feed.bing.daily, since);
  const fetches = sumSince(feed.fetches.daily, since);
  const checks = (feed.llm.checks || []).filter(c => c.d >= since);
  const cited = checks.filter(c => c.cited).length;
  const named = checks.filter(c => c.brand).length;

  const tile = (label, val, note, kind) =>
    '<div class="aiv-tile"><div class="aiv-tile-label">' + esc(label) + '</div><div class="aiv-tile-val">' + val + '</div>' +
    '<div class="aiv-tile-note">' + note + '</div>' +
    '<span class="aiv-tile-kind ' + (kind === 'sample' ? 'aiv-kind-sample">Sampled' : 'aiv-kind-real">Measured') + '</span></div>';

  const up = feed.updated || {};
  const tiles =
    tile('Google AI impressions', fmt(gImp), 'AI Overviews &amp; AI Mode, from Search Console' + (up.google ? ' · to ' + esc(prettyDate(up.google)) : ' · not imported yet'), 'real') +
    tile('Copilot / Bing citations', fmt(bCit), 'Times Bing AI cited the site' + (up.bing ? ' · to ' + esc(prettyDate(up.bing)) : ' · not imported yet'), 'real') +
    tile('Clicks from AI', fmt(ga4Clicks), (feed.tracking.ga4 ? 'GA4 visits from AI assistants' + (ga4Conv ? ' · ' + fmt(ga4Conv) + ' key events' : '') : 'GA4 not connected for this site'), 'real') +
    tile('AI prompt citations', checks.length ? pct(cited, checks.length) : '—',
      checks.length ? fmt(cited) + ' of ' + fmt(checks.length) + ' test questions cited the site · named in ' + fmt(named) : (feed.tracking.llm ? 'First checks run on the next weekly cycle' : 'Prompt checks are off for this client'), 'sample') +
    (feed.fetches.daily.length ? tile('Live AI page reads', fmt(fetches), 'ChatGPT, Claude &amp; Perplexity reading pages to answer someone', 'real') : '');

  /* platform breakdown: GA4 clicks + prompt-check citation rate */
  const byPlat = {};
  (feed.ga4.daily || []).forEach(r => { if (r.d >= since) byPlat[r.p] = (byPlat[r.p] || 0) + (Number(r.s) || 0); });
  const platRows = Object.keys(byPlat).sort((a, b) => byPlat[b] - byPlat[a]).map(p => ({label: p, n: byPlat[p]}));
  const llmPlat = {};
  checks.forEach(c => { const o = llmPlat[c.p] = llmPlat[c.p] || {n:0, y:0}; o.n++; if (c.cited) o.y++; });
  const llmRows = Object.keys(llmPlat).sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b))
    .map(p => ({label: p, n: llmPlat[p].y / llmPlat[p].n * 100, text: llmPlat[p].y + ' / ' + llmPlat[p].n}));

  /* competitors seen alongside us in prompt answers */
  const comp = {};
  checks.forEach(c => (c.comp || []).forEach(h => { comp[h] = (comp[h] || 0) + 1; }));
  const compRows = Object.keys(comp).sort((a, b) => comp[b] - comp[a]).slice(0, 10).map(h => ({label: h, n: comp[h]}));

  /* monthly table */
  const months = (feed.monthly || []).slice().reverse();
  const monthTable = months.length ? '<div class="aiv-scroll"><table class="aiv-table"><thead><tr><th>Month</th>' +
      '<th class="num">Google AI impr.</th><th class="num">Bing citations</th><th class="num">AI clicks</th>' +
      (feed.fetches.daily.length ? '<th class="num">Live reads</th>' : '') + '<th class="num">Prompt citations</th></tr></thead><tbody>' +
      months.map(m => '<tr><td>' + esc(prettyMonth(m.m)) + '</td><td class="num">' + fmt(m.google) + '</td><td class="num">' + fmt(m.bing) +
        '</td><td class="num">' + fmt(m.ga4) + '</td>' + (feed.fetches.daily.length ? '<td class="num">' + fmt(m.fetch) + '</td>' : '') +
        '<td class="num">' + (m.llm ? fmt(m.llmYes) + ' / ' + fmt(m.llm) + ' (' + pct(m.llmYes, m.llm) + ')' : '—') + '</td></tr>').join('') +
      '</tbody></table></div>'
    : '<div class="aiv-empty">No monthly data yet.</div>';

  const pagesTable = (rows, valHead, d) => rows.length
    ? '<div class="aiv-scroll" style="max-height:340px"><table class="aiv-table"><thead><tr><th>Page</th><th class="num">' + esc(valHead) + '</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + pathCell(d, r.u) + '</td><td class="num">' + fmt(r.n) + '</td></tr>').join('') + '</tbody></table></div>'
    : '<div class="aiv-empty">Nothing recorded yet.</div>';

  const queries = feed.bing.queries || [];
  const queryTable = queries.length
    ? '<div class="aiv-scroll" style="max-height:340px"><table class="aiv-table"><thead><tr><th>Question Copilot answered</th><th class="num">Citations</th><th class="num">Share</th></tr></thead><tbody>' +
      queries.map(q => '<tr><td>' + esc(q.q) + '</td><td class="num">' + fmt(q.n) + '</td><td class="num">' + (q.share == null ? '—' : Math.round(q.share * 100) + '%') + '</td></tr>').join('') +
      '</tbody></table></div>'
    : '<div class="aiv-empty">Bing has not reported any grounding queries yet.</div>';

  const chartRange = since;
  const charts = [
    ['Google AI impressions', bucketDaily(feed.google.daily, chartRange), 'Search Console, Generative AI report', 'impressions'],
    ['Copilot / Bing citations', bucketDaily(feed.bing.daily, chartRange), 'Bing Webmaster Tools, AI Performance report', 'citations'],
    ['Clicks from AI assistants', bucketDaily(feed.ga4.daily, chartRange, 's'), 'Google Analytics 4 sessions from AI sources', 'clicks']
  ];

  root.innerHTML =
    '<div class="aiv">' +
      '<div class="aiv-head"><div>' +
        '<h2 class="aiv-title">' + esc(opts.title || ((feed.name || domain) + ' — AI visibility')) + '</h2>' +
        '<div class="aiv-sub">' + esc(domain) + ' · how often AI search and assistants show, cite and send visitors to the site</div>' +
      '</div><div class="aiv-actions">' +
        '<div class="aiv-seg" data-aiv-period>' + [30, 90, 365].map(p => '<button type="button" data-p="' + p + '"' + (p === period ? ' class="on"' : '') + '>' + (p === 365 ? '12 months' : p + ' days') + '</button>').join('') + '</div>' +
        (opts.actionsHtml || '') +
      '</div></div>' +
      (opts.topHtml || '') +
      '<div class="aiv-tiles">' + tiles + '</div>' +
      '<div class="aiv-grid">' + charts.map(c =>
        '<section class="aiv-card"><h3>' + esc(c[0]) + '</h3><p class="aiv-cap">' + esc(c[2]) + (c[1].weekly ? ' · weekly totals' : ' · daily') + '</p>' + barChart(c[1], c[3]) + '</section>').join('') +
        '<section class="aiv-card"><h3>Which AI platforms</h3><p class="aiv-cap">Clicks by platform (GA4), and how often each assistant cited the site in prompt checks</p>' +
          (platRows.length ? barList(platRows) : '<div class="aiv-empty">No AI clicks in this period.</div>') +
          (llmRows.length ? '<div style="margin-top:14px;border-top:1px solid var(--aiv-line2);padding-top:10px">' + barList(llmRows, 'Prompt checks citing the site, per assistant') + '</div>' : '') +
        '</section>' +
      '</div>' +
      '<section class="aiv-card" style="margin-bottom:16px"><h3>Month by month</h3><p class="aiv-cap">Every source, totalled per calendar month</p>' + monthTable + '</section>' +
      '<section class="aiv-card" style="margin-bottom:16px"><h3>Prompt checks</h3>' +
        '<p class="aiv-cap">Each question asked of an AI assistant, and whether the answer cited ' + esc(domain) + '. These are samples, not counts of real users.</p>' +
        '<div class="aiv-filters"><select data-aiv-f="p"><option value="">All assistants</option>' +
          Object.keys(llmPlat).map(p => '<option>' + esc(p) + '</option>').join('') + '</select>' +
          '<select data-aiv-f="c"><option value="">Cited or not</option><option value="1">Cited the site</option><option value="0">Did not cite</option></select>' +
          '<input type="search" data-aiv-f="q" placeholder="Filter questions"></div>' +
        '<div data-aiv-checks></div>' +
      '</section>' +
      '<div class="aiv-grid">' +
        '<section class="aiv-card"><h3>Pages Google AI shows</h3><p class="aiv-cap">From the newest Search Console export' + (feed.google.exported ? ' (' + esc(prettyDate(feed.google.exported)) + ')' : '') + '</p>' + pagesTable(feed.google.pages || [], 'Impressions', domain) + '</section>' +
        '<section class="aiv-card"><h3>Pages Copilot cites</h3><p class="aiv-cap">From the newest Bing export' + (feed.bing.exported ? ' (' + esc(prettyDate(feed.bing.exported)) + ')' : '') + '</p>' + pagesTable(feed.bing.pages || [], 'Citations', domain) + '</section>' +
        '<section class="aiv-card"><h3>Questions Copilot cited the site for</h3><p class="aiv-cap">Bing grounding queries and the site’s share of citations</p>' + queryTable + '</section>' +
        '<section class="aiv-card"><h3>Pages AI visitors land on</h3><p class="aiv-cap">GA4 landing pages for AI-referred sessions, last 12 months</p>' + pagesTable(feed.ga4.pages || [], 'Sessions', domain) + '</section>' +
        (compRows.length ? '<section class="aiv-card"><h3>Other sites AI cites</h3><p class="aiv-cap">Domains that appeared in the same prompt-check answers</p>' + barList(compRows, 'Number of answers each domain appeared in') + '</section>' : '') +
      '</div>' +
      '<section class="aiv-card"><h3>About these numbers</h3><div class="aiv-notes">' +
        '<p><b>Measured</b> figures come straight from Google, Microsoft, Google Analytics or the web server. <b>Sampled</b> figures come from asking AI assistants a fixed set of questions each week, so they show direction, not totals.</p>' +
        '<p>ChatGPT, Claude, Perplexity and the Gemini app do not share impression data with website owners, so no tool can count every time they mention a site. Search Console and Bing report daily totals, not individual conversations, and some app visits reach GA4 without a referrer, so AI clicks are a floor.</p>' +
      '</div></section>' +
    '</div>';

  /* prompt-check table with filters */
  const box = root.querySelector('[data-aiv-checks]');
  const fP = root.querySelector('[data-aiv-f="p"]'), fC = root.querySelector('[data-aiv-f="c"]'), fQ = root.querySelector('[data-aiv-f="q"]');
  const drawChecks = () => {
    const q = (fQ.value || '').toLowerCase();
    const rows = checks.filter(c => (!fP.value || c.p === fP.value) && (fC.value === '' || String(+c.cited) === fC.value) && (!q || String(c.q).toLowerCase().indexOf(q) > -1));
    if (!rows.length){ box.innerHTML = '<div class="aiv-empty">' + (checks.length ? 'No checks match these filters.' : 'No prompt checks in this period.') + '</div>'; return; }
    box.innerHTML = '<div class="aiv-scroll"><table class="aiv-table"><thead><tr><th>Date</th><th>Assistant</th><th>Question</th><th>Site cited</th><th>Brand named</th><th>Page cited</th></tr></thead><tbody>' +
      rows.slice(0, 300).map(c => '<tr><td style="white-space:nowrap">' + esc(prettyDate(c.d)) + '</td><td>' + esc(c.p) +
        (c.m ? '<div style="color:var(--aiv-ink3);font-size:11px">' + esc(c.m) + '</div>' : '') + '</td><td>' + esc(c.q) +
        (c.t ? ' <span class="aiv-pill aiv-no">' + esc(c.t) + '</span>' : '') + '</td>' +
        '<td><span class="aiv-pill ' + (c.cited ? 'aiv-yes">Yes' : 'aiv-no">No') + '</span></td>' +
        '<td><span class="aiv-pill ' + (c.brand ? 'aiv-yes">Yes' : 'aiv-no">No') + '</span></td>' +
        '<td>' + ((c.urls || []).map(linkCell).join('<br>') || '<span style="color:var(--aiv-ink3)">—</span>') + '</td></tr>').join('') +
      '</tbody></table></div>' + (rows.length > 300 ? '<div class="aiv-cap" style="margin:8px 0 0">Showing the newest 300 of ' + fmt(rows.length) + '.</div>' : '');
  };
  [fP, fC].forEach(el => el.addEventListener('change', drawChecks));
  fQ.addEventListener('input', drawChecks);
  drawChecks();

  root.querySelectorAll('[data-aiv-period] button').forEach(b => b.addEventListener('click', () => {
    if (opts.onPeriod) opts.onPeriod(Number(b.dataset.p));
  }));
}

function renderMessage(root, title, body, isErr){
  injectStyles();
  root.innerHTML = '<div class="aiv"><div class="aiv-msg' + (isErr ? ' err' : '') + '"><h3>' + esc(title) + '</h3><div>' + body + '</div></div></div>';
}

/* Public renderer for ai-report.html. */
window.AIVis = {render, renderMessage, apiGet, normDomain};

/* ==========================================================================
   SEO TOOL TAB
   Only runs inside the SEO tool (where the shared `state` global exists).
   ========================================================================== */
if (typeof state === 'undefined' || !document.getElementById('seoModes')) return;

const VIEW = 'ai';
let active = false;
let period = 30;
let loadedFor = null;
let registeredSig = null;
let tokens = {};          // domain -> read-only report token, from the tracker
let llmOn = {};           // domain -> prompt checks switched on
let busy = false;

function settings(){
  state.settings = state.settings || {};
  return state.settings.aiTracker || {url: '', key: ''};
}
function activeClient(){
  return (state.seoClients || []).find(c => c.id === state.activeSeoClientId) || null;
}
function view(){
  let v = document.getElementById('seoview-ai');
  if (!v){
    const anchor = document.getElementById('seoview-embed') || document.getElementById('seoview-keywords');
    if (!anchor) return null;
    v = document.createElement('div');
    v.className = 'seo-view';
    v.id = 'seoview-ai';
    anchor.parentNode.insertBefore(v, anchor.nextSibling);
  }
  return v;
}

/* The app rebuilds its tab strip whenever a client opens; put ours back
   right after Keywords each time. */
function placeButton(){
  const nav = document.getElementById('seoModes');
  if (!nav) return;
  const have = nav.querySelector('[data-seoview="' + VIEW + '"]');
  if (have){
    have.classList.toggle('on', active);
    if (active) nav.querySelectorAll('.seo-mode').forEach(x => { if (x !== have) x.classList.remove('on'); });
    return;
  }
  const kw = nav.querySelector('[data-seoview="keywords"]');
  if (!kw) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'seo-mode' + (active ? ' on' : '');
  b.dataset.seoview = VIEW;
  b.textContent = 'AI Visibility';
  b.title = 'How AI search and assistants show, cite and send visitors to this client';
  kw.after(b);
  if (active) nav.querySelectorAll('.seo-mode').forEach(x => { if (x !== b) x.classList.remove('on'); });
}

function show(on){
  active = on;
  const v = view();
  if (v) v.classList.toggle('on', on);
  placeButton();
  if (on) load(false);
}

/* The app's own strip listener runs first: it hides its views and rebuilds
   the strip. This one then decides whether ours should be showing. */
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('#seoModes .seo-mode, .seo-mode[data-seoview]');
  if (!btn || !btn.dataset.seoview) return;
  show(btn.dataset.seoview === VIEW);
});

new MutationObserver(() => {
  placeButton();
  if (active){
    const c = activeClient();
    if ((c ? c.id : null) !== loadedFor) load(false);
  }
}).observe(document.getElementById('seoModes'), {childList: true});
placeButton();

/* ---------- connection ---------- */
function renderConnect(v, errMsg){
  const s = settings();
  renderMessage(v, 'Connect the AI Visibility Tracker',
    '<p style="margin:0 0 4px">In the tracker sheet, open <b>AI Tracker → Connect the SEO tool</b> and paste the two values here. They are saved to your account, not to any client report.</p>' +
    '<div class="aiv-form"><label for="aivUrl">Tracker URL</label><input id="aivUrl" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(s.url) + '">' +
    '<label for="aivKey">Key</label><input id="aivKey" type="password" autocomplete="off" value="' + esc(s.key) + '">' +
    '<div class="aiv-actions"><button class="aiv-btn go" type="button" id="aivSave">Connect</button>' +
    (s.url && s.key ? '<button class="aiv-btn" type="button" id="aivCancel">Cancel</button>' : '') +
    '<span class="aiv-status' + (errMsg ? ' err' : '') + '" id="aivConnStatus">' + esc(errMsg || '') + '</span></div></div>');
  v.querySelector('#aivSave').addEventListener('click', async () => {
    const url = v.querySelector('#aivUrl').value.trim(), key = v.querySelector('#aivKey').value.trim();
    const st = v.querySelector('#aivConnStatus');
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { st.className = 'aiv-status err'; st.textContent = 'That doesn’t look like an Apps Script web app URL.'; return; }
    if (!key){ st.className = 'aiv-status err'; st.textContent = 'Paste the key too.'; return; }
    st.className = 'aiv-status'; st.innerHTML = '<span class="aiv-spin"></span>Checking…';
    try{
      await apiGet(url, {action: 'clients', key});
    }catch(err){ st.className = 'aiv-status err'; st.textContent = err.message; return; }
    state.settings.aiTracker = {url, key};
    try{ save(); }catch(e){}
    registeredSig = null;
    load(true);
  });
  const cancel = v.querySelector('#aivCancel');
  if (cancel) cancel.addEventListener('click', () => load(false));
}

/* Send the tool's client list so new clients appear in the tracker with
   prompts built from their tracked keywords. Only when the list changed. */
async function register(s){
  const list = (state.seoClients || []).filter(c => normDomain(c.website).indexOf('.') > -1).map(c => ({
    id: c.id, name: c.name || '', website: c.website, status: c.status || '',
    keywords: (c.keywords || []).slice(0, 25).map(k => ({text: k.text || '', location: ((k.locations || [])[0] || {}).label || ''}))
  }));
  const sig = JSON.stringify(list.map(c => [c.id, c.name, normDomain(c.website), c.status, c.keywords.length]));
  if (sig === registeredSig) return;
  const res = await apiPost(s.url, {key: s.key, action: 'register', clients: list});
  registeredSig = sig;
  (res.clients || []).forEach(c => { tokens[c.domain] = c.token; llmOn[c.domain] = !!c.llm; });
}

async function load(force){
  const v = view();
  if (!v || !active) return;
  const c = activeClient();
  loadedFor = c ? c.id : null;
  if (!c){ renderMessage(v, 'No client selected', 'Pick an SEO client on the left.'); return; }
  const s = settings();
  if (!s.url || !s.key){ renderConnect(v); return; }
  const domain = normDomain(c.website);
  if (domain.indexOf('.') < 0){
    renderMessage(v, 'Add this client’s website first', 'AI visibility is matched by domain. Add the website on the Dashboard tab, then come back.');
    return;
  }
  const forId = c.id;
  renderMessage(v, 'Loading AI visibility', '<span class="aiv-spin"></span>Reading ' + esc(domain) + ' from the tracker…');
  try{
    try{ await register(s); }catch(err){ if (/key/.test(err.message)) throw err; }
    const feed = await apiGet(s.url, {action: 'feed', domain, key: s.key, _: force ? Date.now() : ''});
    if (loadedFor !== forId) return;
    if (!tokens[domain]){
      try{ const cl = await apiGet(s.url, {action: 'clients', key: s.key}); (cl.clients || []).forEach(x => { tokens[x.domain] = x.token; llmOn[x.domain] = !!x.llm; }); }catch(e){}
    }
    llmOn[domain] = feed.tracking ? !!feed.tracking.llm : llmOn[domain];
    draw(v, c, feed);
  }catch(err){
    if (loadedFor !== forId) return;
    if (/key/.test(err.message)){ renderConnect(v, err.message); return; }
    if (/unknown client/.test(err.message)){
      renderMessage(v, 'Not in the tracker yet', esc(domain) + ' hasn’t reached the tracker yet. It is added automatically; try again in a moment.' +
        '<div class="aiv-actions" style="justify-content:center;margin-top:14px"><button class="aiv-btn" type="button" data-aiv-retry>Try again</button></div>');
      registeredSig = null;
      v.querySelector('[data-aiv-retry]').addEventListener('click', () => load(true));
      return;
    }
    renderMessage(v, 'Couldn’t reach the tracker', esc(err.message) +
      '<div class="aiv-actions" style="justify-content:center;margin-top:14px"><button class="aiv-btn" type="button" data-aiv-retry>Try again</button>' +
      '<button class="aiv-btn" type="button" data-aiv-conn>Connection settings</button></div>', true);
    v.querySelector('[data-aiv-retry]').addEventListener('click', () => load(true));
    v.querySelector('[data-aiv-conn]').addEventListener('click', () => renderConnect(v));
  }
}

function reportId(c){ return 'aireport-' + c.id; }
function reportUrl(c){
  const base = location.origin + location.pathname.replace(/[^\/]*$/, '');
  return base + 'ai-report.html?r=' + encodeURIComponent(reportId(c));
}
function embedCode(url){
  return '<iframe src="' + url + '" style="width:100%;height:1600px;border:0" loading="lazy" title="AI visibility"></iframe>';
}

function draw(v, c, feed){
  const domain = feed.domain;
  const tracking = feed.tracking || {};
  const actions =
    '<label class="aiv-toggle" title="Weekly test questions on ChatGPT, Gemini, Perplexity and Claude (about $0.75 a week per client)">' +
      '<input type="checkbox" data-aiv-llm' + (llmOn[domain] ? ' checked' : '') + '> Prompt checks</label>' +
    (tracking.ga4 ? '<button class="aiv-btn" type="button" data-aiv-refresh title="Pull the latest GA4 AI clicks for this client now">Refresh GA4</button>' : '') +
    '<button class="aiv-btn go" type="button" data-aiv-share>Share report</button>' +
    '<button class="aiv-btn" type="button" data-aiv-conn title="Tracker connection">⚙</button>';
  const top = '<div data-aiv-sharebox></div>' + (!tracking.ga4
    ? '<div class="aiv-share" style="font-size:12.5px;color:var(--aiv-ink2)">GA4 isn’t matched for ' + esc(domain) + ' yet. The tracker looks for a GA4 web stream with this website each week; you can also type the property number into the Clients tab of the tracker sheet.</div>'
    : '');

  render(v, feed, {
    period, actionsHtml: actions, topHtml: top,
    onPeriod: p => { period = p; draw(v, c, feed); }
  });

  const s = settings();
  const llmBox = v.querySelector('[data-aiv-llm]');
  llmBox.addEventListener('change', async () => {
    const want = llmBox.checked;
    llmBox.disabled = true;
    try{
      await apiPost(s.url, {key: s.key, action: 'setLlm', domain, on: want});
      llmOn[domain] = want;
    }catch(err){ llmBox.checked = !want; alert('Couldn’t change prompt checks: ' + err.message); }
    llmBox.disabled = false;
  });

  const ref = v.querySelector('[data-aiv-refresh]');
  if (ref) ref.addEventListener('click', async () => {
    if (busy) return;
    busy = true; ref.disabled = true; ref.innerHTML = '<span class="aiv-spin"></span>Refreshing';
    try{ await apiPost(s.url, {key: s.key, action: 'refresh', domain}); busy = false; load(true); }
    catch(err){ busy = false; ref.disabled = false; ref.textContent = 'Refresh GA4'; alert('GA4 refresh failed: ' + err.message); }
  });

  v.querySelector('[data-aiv-conn]').addEventListener('click', () => renderConnect(v));
  v.querySelector('[data-aiv-share]').addEventListener('click', () => share(v, c, domain));
}

/* Publishes a pointer, not data: the public page fetches live numbers with
   a read-only token that only opens this one client. The admin key never
   leaves this account, and the link never needs re-publishing. */
async function share(v, c, domain){
  const box = v.querySelector('[data-aiv-sharebox]');
  const s = settings();
  box.innerHTML = '<div class="aiv-share"><span class="aiv-spin"></span>Publishing…</div>';
  try{
    if (typeof fbDb === 'undefined' || !fbDb) throw new Error('Not connected to the cloud.');
    if (!tokens[domain]){
      const cl = await apiGet(s.url, {action: 'clients', key: s.key});
      (cl.clients || []).forEach(x => { tokens[x.domain] = x.token; });
    }
    if (!tokens[domain]) throw new Error('The tracker has no token for ' + domain + '.');
    await fbDb.collection('publicViews').doc(reportId(c)).set({
      type: 'aireport', clientName: c.name || domain, domain,
      title: (c.name || domain) + ' — AI visibility',
      feedUrl: s.url, token: tokens[domain], updatedAt: Date.now()
    });
    const url = reportUrl(c);
    box.innerHTML = '<div class="aiv-share"><label>Report link</label><input readonly value="' + esc(url) + '">' +
      '<label>Embed code</label><textarea readonly rows="2">' + esc(embedCode(url)) + '</textarea>' +
      '<div class="aiv-actions"><button class="aiv-btn" type="button" data-copy="link">Copy link</button><button class="aiv-btn" type="button" data-copy="embed">Copy embed code</button>' +
      '<a class="aiv-btn" href="' + esc(url) + '" target="_blank" rel="noopener" style="text-decoration:none">Open</a>' +
      '<span class="aiv-status">Shows live data, so it never needs publishing again.</span></div></div>';
    box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      const text = b.dataset.copy === 'link' ? url : embedCode(url);
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = b.dataset.copy === 'link' ? 'Copy link' : 'Copy embed code'; }, 1500); },
        () => { const el = box.querySelector(b.dataset.copy === 'link' ? 'input' : 'textarea'); el.select(); });
    }));
  }catch(err){
    box.innerHTML = '<div class="aiv-share"><span class="aiv-status err">Couldn’t publish: ' + esc(err.message) + '</span></div>';
  }
}

})();
