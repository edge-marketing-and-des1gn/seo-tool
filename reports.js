/* ==========================================================================
   TEAM REPORT and CLIENT REPORT

   Two tabs on every SEO client, beside AI Visibility.

   Team report   Every widget the tool can draw, from every source it tracks:
                 GA4 conversions and traffic (all channels), AI visits,
                 assistants and visitor journeys, Google AI impressions, AI
                 Overview citations, Copilot citations, prompt checks, Search
                 Console, keyword rankings and Google Business Profile grids.
                 Every number opens what is behind it. "Customize" adds,
                 removes, resizes and drags widgets.

   Client report Starts blank. A team widget's "Send to client" puts a copy
                 here, where it has its own order and size. Text and embedded
                 pages (any URL) can be added too. "Share" publishes a link
                 (client-report.html) that shows live numbers.

   Layouts live on the client record (c.reports), so they sync like everything
   else. Data comes from the AI Visibility Tracker (feed, ga4report,
   gscQueries, journeys) and from the client record itself (keywords) and the
   GBP tracker (grids). The renderer is shared with the public page, which
   reads a stored copy first and then live numbers with a read-only token.
   ========================================================================== */
(function(){
'use strict';
const AIV = window.AIVis;
if (!AIV || !AIV.ui) return;
const U = AIV.ui;
const {esc, fmt, fmtK, prettyDate, shortDate, addDays, today, pageKey, shortUrl, safeUrl, linkTo, dotName,
  lineChart, donut, table, barCell, statsRow, delta, keLabel, keyEventsOf, pcol, PLATFORMS} = U;

/* ---------- small helpers ---------- */
const sum = (rows, i) => rows.reduce((t, r) => t + (Number(r[i]) || 0), 0);
const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pct = (a, b) => b ? (a / b * 100) : 0;
const pctS = (a, b) => b ? (Math.round(a / b * 1000) / 10) + '%' : '—';
const isoDay = d => d.toISOString().slice(0, 10);
const CHC = {'Organic Search': '#2a78d6', Direct: '#1baf7a', 'Paid Search': '#eda100', 'Cross-network': '#6250d6', Referral: '#e87ba4',
  'Organic Social': '#008300', 'Paid Social': '#e34948', Email: '#8a5a00', 'Organic Shopping': '#0b8fa3', 'Organic Video': '#a33ea1',
  Display: '#c96a00', Unassigned: '#8795a1', '(other)': '#8795a1'};
const chColor = ch => ch && ch.indexOf('AI: ') === 0 ? pcol(ch.slice(4)) : (CHC[ch] || '#57646f');
const chName = ch => ch && ch.indexOf('AI: ') === 0 ? ch.slice(4) + ' (AI)' : (ch || 'Unassigned');
const isAi = ch => !!ch && ch.indexOf('AI: ') === 0;
const KW_COL = '#2a78d6';

/* ---------- icons ----------
   Brand marks are the services' own site icons, fetched from Google's public
   favicon service (nothing is redrawn here). If one can't load, a lettered
   badge in the brand colour takes its place. Glyphs are simple line icons. */
const BRAND = {ChatGPT: 'chatgpt.com', Perplexity: 'perplexity.ai', Gemini: 'gemini.google.com', Copilot: 'copilot.microsoft.com', Claude: 'claude.ai',
  'Meta AI': 'meta.ai', Grok: 'grok.com', DeepSeek: 'deepseek.com',
  ga4: 'analytics.google.com', gsc: 'search.google.com', google: 'google.com', gads: 'ads.google.com', bing: 'bing.com', gbp: 'business.google.com', maps: 'maps.google.com',
  facebook: 'facebook.com', instagram: 'instagram.com', linkedin: 'linkedin.com', youtube: 'youtube.com'};
const BRAND_NAME = {ga4: 'Google Analytics', gsc: 'Search Console', google: 'Google', gads: 'Google Ads', bing: 'Bing', gbp: 'Business Profile', maps: 'Google Maps'};
const favUrl = (domain, sz) => 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=' + (sz || 64);
const brandCol = k => PLATFORMS.indexOf(k) > -1 ? pcol(k) : ({ga4: '#e37400', gsc: '#2a78d6', google: '#2a78d6', gads: '#1baf7a', bing: '#0b8fa3', gbp: '#2a78d6', maps: '#1baf7a'}[k] || '#8795a1');
/* <img> of a brand mark; size in px. */
const logo = (k, sz, extra) => {
  const d = BRAND[k];
  if (!d) return k === 'Other AI' ? glyph('spark', sz, '#8795a1') : '';
  const nm = BRAND_NAME[k] || k;
  return '<img class="rp-logo" src="' + favUrl(d, sz > 24 ? 128 : 64) + '" width="' + sz + '" height="' + sz + '" alt="' + esc(nm) + '" title="' + esc(nm) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
    ' data-fb="' + esc(nm.charAt(0)) + '" data-fc="' + brandCol(k) + '"' + (extra ? ' ' + extra : '') + '>';
};
/* Overlapping row of brand marks. */
const logoStack = (ks, sz) => '<span class="rp-stack">' + ks.map(k => logo(k, sz || 16)).join('') + '</span>';
const AI_STACK = ['ChatGPT', 'Perplexity', 'Gemini', 'Copilot'];
const GLYPH = {
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  line: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  donut: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  path: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 15V9a4 4 0 0 1 4-4h8M19 9v6a4 4 0 0 1-4 4H9',
  page: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
  up: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  bars: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  text: 'M4 6h16M4 12h16M4 18h10',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  device: 'M4 5h16v10H4zM2 19h20M9 15v4M15 15v4',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  quote: 'M7 7h4v4c0 3-2 5-4 5M14 7h4v4c0 3-2 5-4 5',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  brush: 'M14 4l6 6-9 9H5v-6zM12 6l6 6',
  resize: 'M21 15l-6 6M21 9L9 21'
};
const glyph = (k, sz, color) => '<svg class="rp-gl" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="none" stroke="' + (color || 'currentColor') +
  '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (GLYPH[k] || GLYPH.bars) + '"/></svg>';
/* A lettered badge stands in for a brand mark that didn't load. */
if (!window.__rpLogoFb){
  window.__rpLogoFb = true;
  document.addEventListener('error', e => {
    const t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.classList.contains('rp-logo')) return;
    const s = document.createElement('span');
    s.className = 'rp-logo rp-logo-fb'; s.textContent = t.dataset.fb || '?'; s.title = t.title || '';
    s.style.cssText = 'width:' + t.width + 'px;height:' + t.height + 'px;font-size:' + Math.max(8, Math.round(t.width * 0.58)) + 'px;background:' + (t.dataset.fc || '#8795a1');
    t.replaceWith(s);
  }, true);
}
/* Brand mark for a GA4 channel name, if there is one. */
const chLogo = ch => isAi(ch) ? ch.slice(4) : ({'Organic Search': 'google', 'Paid Search': 'gads', 'Organic Video': 'youtube'}[ch] || '');
const chLabel = (ch, sz) => { const k = chLogo(ch); return k && BRAND[k] ? '<span class="rp-nm">' + logo(k, sz || 14) + esc(chName(ch)) + '</span>' : dotName(chName(ch), chColor(ch)); };
const platLabel = (p, sz) => BRAND[p] ? '<span class="rp-nm">' + logo(p, sz || 14) + esc(p) + '</span>' : dotName(p, pcol(p));

/* Periods. Every widget on a board shares one. */
const PERIODS = [['7', 'Last 7 days', '7 days'], ['30', 'Last 30 days', '30 days'], ['90', 'Last 90 days', '90 days'], ['thisMonth', 'This month', 'This month'],
  ['lastMonth', 'Last month', 'Last month'], ['lastQuarter', 'Last quarter', 'Last quarter'], ['ytd', 'Year to date', 'Year to date'], ['365', 'Last 12 months', '12 months']];
/* What a client report offered before periods could be chosen: kept for reports set up then. */
const CLIENT_PERIODS_DEFAULT = ['30', '90', 'lastMonth', '365'];
const validPeriod = p => PERIODS.some(x => x[0] === String(p));
function rangeOf(p){
  const end0 = addDays(today(), -1);
  let since, end;
  const t = new Date();
  if (p === 'lastMonth'){
    since = isoDay(new Date(Date.UTC(t.getFullYear(), t.getMonth() - 1, 1, 12)));
    end = isoDay(new Date(Date.UTC(t.getFullYear(), t.getMonth(), 0, 12)));
  } else if (p === 'thisMonth'){
    end = end0; since = isoDay(new Date(Date.UTC(t.getFullYear(), t.getMonth(), 1, 12)));
    if (since > end) since = end;
  } else if (p === 'ytd'){
    end = end0; since = isoDay(new Date(Date.UTC(t.getFullYear(), 0, 1, 12)));
    if (since > end) since = end;
  } else if (p === 'lastQuarter'){
    const q = Math.floor(t.getMonth() / 3);
    since = isoDay(new Date(Date.UTC(t.getFullYear(), (q - 1) * 3, 1, 12)));
    end = isoDay(new Date(Date.UTC(t.getFullYear(), q * 3, 0, 12)));
  } else {
    const n = Number(p) || 30;
    end = end0; since = addDays(end, -(n - 1));
  }
  const days = Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(since + 'T12:00:00Z')) / 86400000) + 1;
  const prevEnd = addDays(since, -1), prevSince = addDays(prevEnd, -(days - 1));
  const label = (PERIODS.find(x => x[0] === String(p)) || [0, ''])[1];
  return {key: String(p), since, end, prevSince, prevEnd, days, weekly: days > 35, label,
    text: prettyDate(since) + ' – ' + prettyDate(end)};
}
/* Day or week buckets for charts over a range. */
function buckets(R){
  const bucket = d => { if (!R.weekly) return d; const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return isoDay(t); };
  const labels = [];
  let first = bucket(R.since);
  if (R.weekly && first < R.since) first = addDays(first, 7);
  for (let d = first; d <= R.end; d = addDays(d, R.weekly ? 7 : 1)) labels.push(d);
  if (R.weekly && labels.length > 1 && addDays(labels[labels.length - 1], 6) > R.end) labels.pop();
  const idx = {}; labels.forEach((d, i) => { idx[d] = i; });
  return {labels, slot: d => idx[bucket(d)], zero: () => labels.map(() => 0)};
}

/* ==========================================================================
   STYLES
   ========================================================================== */
function styles(){
  if (document.getElementById('rpStyles')) return;
  U.injectStyles();
  const st = document.createElement('style');
  st.id = 'rpStyles';
  st.textContent = `
.rp{max-width:1280px;margin:0 auto;}
.rp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;}
.rp-title{font-family:var(--display,Poppins,Inter,sans-serif);font-size:21px;font-weight:600;letter-spacing:-.01em;margin:0;}
.rp-sub{color:var(--a-ink2);font-size:12.5px;margin-top:4px;}
.rp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.rp-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:stretch;grid-auto-flow:row dense;}
.rp-w a{color:var(--a-deep);}
.rp-w.plain .rp-wh{display:none;} .rp.editing .rp-w.plain .rp-wh{display:flex;}
.aiv-filters select{font:500 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--a-line);border-radius:9px;padding:7px 10px;background:var(--a-card);color:var(--a-ink);}
.rp-w{grid-column:span var(--c,6);background:var(--a-card);border:1px solid var(--a-line);border-radius:18px;padding:16px 18px;min-width:0;position:relative;
  display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(20,28,36,.04);transition:box-shadow .2s,border-color .2s,transform .2s;animation:rpIn .35s ease both;}
.rp-w:hover{box-shadow:0 10px 28px -14px rgba(20,28,36,.22);}
.rp-w > [data-body]{flex:1;min-height:0;}
.rp-w.fixh > [data-body]{overflow:auto;}
@keyframes rpIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.rp-w{animation:none;transition:none;}}
.rp-w::before{content:"";position:absolute;left:18px;right:18px;top:0;height:3px;border-radius:0 0 3px 3px;background:var(--tint,var(--a-brand));opacity:.85;}
.rp-w.plain::before,.rp-w.bare::before{display:none;}
.rp-wic{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--tint,var(--a-brand));
  background:color-mix(in srgb,var(--tint,var(--a-brand)) 13%,transparent);}
.rp-wt{display:flex;gap:10px;align-items:flex-start;min-width:0;}
.rp-src{display:inline-flex;align-items:center;gap:5px;font:600 10.5px var(--ui,Inter,sans-serif);color:var(--a-ink3);background:var(--a-card2);border:1px solid var(--a-line2);
  border-radius:20px;padding:2px 8px 2px 4px;white-space:nowrap;margin-top:5px;}
.rp-logo{display:inline-block;border-radius:4px;flex:none;object-fit:contain;vertical-align:middle;}
.rp-logo-fb{display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:var(--ui,Inter,sans-serif);border-radius:50%;line-height:1;}
.rp-stack{display:inline-flex;align-items:center;}
.rp-stack .rp-logo{background:#fff;border-radius:50%;box-shadow:0 0 0 2px var(--a-card);margin-left:-4px;} .rp-stack .rp-logo:first-child{margin-left:0;}
.rp-nm{display:inline-flex;align-items:center;gap:7px;min-width:0;}
.rp-gl{display:block;flex:none;}
.rp-rz{position:absolute;display:none;z-index:3;}
.rp.editing .rp-rz{display:block;}
.rp-rz.e{top:14px;bottom:14px;right:-7px;width:12px;cursor:ew-resize;}
.rp-rz.s{left:14px;right:14px;bottom:-7px;height:12px;cursor:ns-resize;}
.rp-rz.se{right:-6px;bottom:-6px;width:20px;height:20px;cursor:nwse-resize;border-radius:6px;background:var(--a-card);border:1.5px solid var(--a-brand);
  box-shadow:0 2px 6px rgba(20,28,36,.15);display:none;align-items:center;justify-content:center;color:var(--a-brand);}
.rp.editing .rp-rz.se{display:flex;}
.rp-rz.e::after,.rp-rz.s::after{content:"";position:absolute;background:var(--a-brand);border-radius:3px;opacity:0;transition:opacity .15s;}
.rp-rz.e::after{top:30%;bottom:30%;left:4px;width:4px;} .rp-rz.s::after{left:30%;right:30%;top:4px;height:4px;}
.rp-rz:hover::after,.rp-w.resizing .rp-rz::after{opacity:1;}
.rp-w.resizing{box-shadow:0 0 0 2px var(--a-brand),0 18px 40px -18px rgba(20,28,36,.35);transition:none;}
.rp-rzbadge{position:absolute;right:10px;bottom:10px;background:var(--a-ink);color:#fff;font:600 11px var(--ui,Inter,sans-serif);padding:3px 8px;border-radius:7px;z-index:4;pointer-events:none;}
body.rp-resizing{user-select:none;cursor:nwse-resize;}
.rp-brand{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
.rp-brand img{max-height:var(--logoh,44px);max-width:220px;width:auto;object-fit:contain;display:block;}
.rp-brand .rp-x2{width:1px;height:28px;background:var(--a-line);}
.rp-banner{background:linear-gradient(120deg,color-mix(in srgb,var(--a-brand) 16%,var(--a-card)),var(--a-card) 62%);border:1px solid var(--a-line);border-radius:20px;padding:18px 20px;}
.rp-rank{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:24px;padding:0 7px;border-radius:8px;font:700 12px var(--ui,Inter,sans-serif);color:#fff;background:#8795a1;font-variant-numeric:tabular-nums;}
.rp-rank.t3{background:#0f7a58;} .rp-rank.t10{background:#1baf7a;} .rp-rank.t20{background:#2a78d6;} .rp-rank.t50{background:#eda100;} .rp-rank.t100{background:#eb6834;} .rp-rank.out{background:#c3ccd3;color:#3d4852;}
.rp-kwc{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;}
.rp-kwc > div{border:1px solid var(--a-line);border-radius:14px;padding:12px 14px;background:var(--a-card);display:flex;flex-direction:column;gap:6px;min-width:0;}
.rp-kwc button{all:unset;cursor:pointer;}
.rp-kwc .k{font-weight:600;font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.rp-kwc .l{font-size:11px;color:var(--a-ink3);display:flex;align-items:center;gap:4px;}
.rp-kwc .r{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.rp-kwc .big{font-family:var(--display,Poppins,Inter,sans-serif);font-size:26px;font-weight:600;line-height:1;}
.rp-kwc svg.sp{width:100%;height:30px;display:block;}
.rp-dist{display:flex;height:12px;border-radius:7px;overflow:hidden;background:var(--a-line2);margin-top:12px;}
.rp-dist i{display:block;height:100%;}
.rp-kpi-h{display:flex;align-items:center;justify-content:space-between;gap:6px;} .rp-kpi-h .rp-kpi-l{flex:1;min-width:0;}
.rp-legend span.rp-logo,.rp-legend .rp-stack{flex:none;}
.rp-cat-i .rp-wic{width:34px;height:34px;}
.rp-panel{background:var(--a-card);border:1px solid var(--a-line);border-radius:16px;padding:16px 18px;margin-bottom:16px;display:grid;gap:12px;}
.rp-panel h4{margin:0;font-family:var(--display,Poppins,Inter,sans-serif);font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
.rp-panel .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.rp-panel .lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--a-ink3);width:100%;}
.rp-chipx{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--a-line);border-radius:20px;padding:5px 11px;font:600 12px var(--ui,Inter,sans-serif);cursor:pointer;background:var(--a-card);color:var(--a-ink2);user-select:none;}
.rp-chipx input{margin:0;accent-color:var(--a-brand);}
.rp-chipx.on{border-color:var(--a-brand);color:var(--a-deep);background:var(--a-wash);}
.rp-panel select,.rp-panel input[type=text],.rp-panel input[type=url]{font:500 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--a-line);border-radius:9px;padding:7px 10px;background:var(--a-card);color:var(--a-ink);}
.rp-sw{width:26px;height:26px;border-radius:50%;border:2px solid var(--a-card);box-shadow:0 0 0 1px var(--a-line);cursor:pointer;padding:0;}
.rp-sw.on{box-shadow:0 0 0 2px var(--a-ink);}
.rp-lock{display:inline-flex;align-items:center;gap:6px;font:600 12px var(--ui,Inter,sans-serif);color:var(--a-ink2);background:var(--a-line2);border-radius:9px;padding:6px 10px;}
.rp-w.bare{background:none;border:0;padding:0;}
.rp-wh{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;min-height:20px;flex-wrap:wrap;}
.rp-wh h3{font-family:var(--display,Poppins,Inter,sans-serif);font-size:14.5px;font-weight:600;margin:0;letter-spacing:-.01em;}
.rp-wh p{margin:2px 0 0;color:var(--a-ink3);font-size:11.5px;}
.rp-acts{display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;opacity:0;transition:opacity .15s;max-width:100%;}
.rp-w:hover .rp-acts,.rp-w:focus-within .rp-acts,.rp.editing .rp-acts{opacity:1;}
.rp-ib{border:1px solid var(--a-line);background:var(--a-card);color:var(--a-ink2);border-radius:8px;font:600 11px var(--ui,Inter,sans-serif);
  padding:3px 7px;cursor:pointer;white-space:nowrap;line-height:1.4;}
.rp-ib:hover{border-color:var(--a-ink3);color:var(--a-ink);}
.rp-ib.on{background:var(--a-goodw);border-color:transparent;color:var(--a-good);}
.rp-ib.go{background:var(--a-brand);border-color:var(--a-brand);color:#fff;}
.rp-ib select{border:0;background:none;font:inherit;color:inherit;padding:0;cursor:pointer;}
.rp-drag{cursor:grab;color:var(--a-ink3);font-size:15px;padding:0 4px;display:none;user-select:none;}
.rp.editing .rp-drag{display:inline;}
.rp.editing .rp-w{outline:1px dashed var(--a-line);outline-offset:3px;}
.rp-w.dragging{opacity:.4;}
.rp-w.dropbefore{box-shadow:-4px 0 0 0 var(--a-brand);}
.rp-edit-only{display:none !important;}
.rp.editing .rp-edit-only{display:inline-flex !important;}
.rp-empty{grid-column:span 12;border:1.5px dashed var(--a-line);border-radius:16px;padding:44px 20px;text-align:center;color:var(--a-ink2);background:var(--a-card);}
.rp-empty h3{font-family:var(--display,Poppins,Inter,sans-serif);color:var(--a-ink);margin:0 0 6px;font-size:16px;}
.rp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}
.rp-kpi{border:1px solid var(--a-line);border-radius:14px;position:relative;padding:12px 14px 8px;background:var(--a-card);text-align:left;font:inherit;color:inherit;min-width:0;}
button.rp-kpi{cursor:pointer;} button.rp-kpi:hover{border-color:var(--a-ink3);box-shadow:0 4px 14px -6px rgba(20,28,36,.18);}
.rp-kpi-l{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-ink3);font-weight:700;}
.rp-kpi-v{font-family:var(--display,Poppins,Inter,sans-serif);font-size:24px;font-weight:600;margin:4px 0 2px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.rp-kpi-n{font-size:11.5px;color:var(--a-ink2);min-height:15px;}
.rp-kpi svg{display:block;width:100%;height:26px;margin-top:4px;}
.rp-kpi svg.rp-gl{width:18px;height:18px;margin:0;}
.rp-big{font-family:var(--display,Poppins,Inter,sans-serif);font-size:32px;font-weight:600;line-height:1.1;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.rp-legend{display:flex;flex-direction:column;gap:6px;font-size:12.5px;min-width:0;flex:1;}
.rp-legend button,.rp-legend div{display:flex;align-items:center;gap:8px;border:0;background:none;font:inherit;color:inherit;padding:2px 0;text-align:left;cursor:pointer;min-width:0;}
.rp-legend i{width:10px;height:10px;border-radius:3px;flex:none;}
.rp-legend span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rp-legend b{font-variant-numeric:tabular-nums;}
.rp-legend em{font-style:normal;color:var(--a-ink3);width:44px;text-align:right;font-size:11.5px;}
.rp-donutrow{display:flex;gap:18px;align-items:center;flex-wrap:wrap;}
.rp-donutrow .aiv-donut{width:140px;height:140px;flex:none;}
.rp-text{font-size:13px;line-height:1.6;color:var(--a-ink2);white-space:pre-wrap;}
.rp-text h2{font-family:var(--display,Poppins,Inter,sans-serif);font-size:19px;color:var(--a-ink);margin:0 0 4px;font-weight:600;}
.rp-frame{width:100%;border:0;border-radius:10px;background:var(--a-card2);display:block;}
.rp-form{display:grid;gap:8px;margin-top:8px;}
.rp-form label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--a-ink3);}
.rp-form input,.rp-form textarea,.rp-form select{font:500 13px var(--ui,Inter,sans-serif);border:1px solid var(--a-line);border-radius:9px;padding:8px 10px;background:var(--a-card);color:var(--a-ink);width:100%;box-sizing:border-box;}
.rp-form textarea{min-height:90px;resize:vertical;}
.rp-load{color:var(--a-ink3);font-size:12.5px;padding:16px 0;text-align:center;}
.rp-err{color:var(--a-ink3);font-size:12px;padding:14px 4px;text-align:center;line-height:1.5;}
.rp-cat-back{position:fixed;inset:0;background:rgba(20,26,33,.45);z-index:9998;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;}
.rp-cat{background:var(--a-card2,#f7f9fa);border-radius:18px;width:min(880px,100%);padding:20px 22px 24px;box-shadow:0 30px 60px -20px rgba(0,0,0,.4);}
.rp-cat h2{font-family:var(--display,Poppins,Inter,sans-serif);margin:0 0 4px;font-size:18px;font-weight:600;}
.rp-cat-g{margin-top:16px;}
.rp-cat-g > b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-ink3);margin-bottom:8px;}
.rp-cat-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;}
.rp-cat-i{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border:1px solid var(--a-line);border-radius:12px;padding:10px 12px;background:var(--a-card);}
.rp-cat-i div{min-width:0;} .rp-cat-i strong{display:block;font-size:13px;} .rp-cat-i small{color:var(--a-ink3);font-size:11.5px;line-height:1.4;display:block;margin-top:2px;}
.rp-pill{display:inline-block;font-size:10.5px;font-weight:700;border-radius:20px;padding:2px 8px;background:var(--a-line2);color:var(--a-ink2);}
.rp-heat{display:grid;gap:3px;margin-top:8px;}
.rp-heat i{display:block;aspect-ratio:1;border-radius:4px;font:700 9px/1 var(--ui,Inter,sans-serif);color:#fff;display:flex;align-items:center;justify-content:center;font-style:normal;}
.rp-gbp{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}
.rp-gbp > div{border:1px solid var(--a-line);border-radius:12px;padding:10px 12px;}
.rp-chk{color:var(--a-good);font-weight:700;} .rp-x{color:var(--a-ink3);}
.rp-share{background:var(--a-card);border:1px solid var(--a-line);border-radius:14px;padding:14px 16px;margin-bottom:16px;display:grid;gap:8px;}
.rp-share input,.rp-share textarea{font:500 12.5px var(--mono,monospace);border:1px solid var(--a-line);border-radius:8px;padding:7px 9px;width:100%;box-sizing:border-box;background:var(--a-card2);}
@media (max-width:1100px){.rp-w.nar{grid-column:span 6;}}
@media (max-width:760px){.rp-w{grid-column:span 12 !important;height:auto !important;} .rp-rz{display:none !important;}}
`;
  document.head.appendChild(st);
}

/* ==========================================================================
   DATA
   ctx.get(name) -> promise. Names: feed, g4, gsc, jrn, kw, gbp.
   The tool and the public page each supply their own loaders.
   ========================================================================== */
/* AI model for the period, built once per board render. */
function aiModel(ctx, feed){
  ctx._m = ctx._m || {};
  const k = ctx.R.since + '|' + ctx.R.end;
  if (!ctx._m[k]) ctx._m[k] = U.model(feed, {since: ctx.R.since, end: ctx.R.end});
  return ctx._m[k];
}
/* GA4 report rows, split into the period and the one before it. */
function g4Split(ctx, g4){
  const R = ctx.R;
  const conv = (g4.conv || []), traffic = (g4.traffic || []);
  return {
    conv: conv.filter(r => r[0] >= R.since && r[0] <= R.end),
    convPrev: conv.filter(r => r[0] >= R.prevSince && r[0] <= R.prevEnd),
    traffic: traffic.filter(r => r[0] >= R.since && r[0] <= R.end),
    trafficPrev: traffic.filter(r => r[0] >= R.prevSince && r[0] <= R.prevEnd),
    hasPrev: (g4.range && g4.range.start <= R.prevSince) || traffic.some(r => r[0] < R.since)
  };
}
const group = (rows, keyFn, valIdx) => {
  const m = {};
  rows.forEach(r => { const k = keyFn(r); m[k] = (m[k] || 0) + (Number(r[valIdx]) || 0); });
  return Object.keys(m).map(k => ({k, n: m[k]})).sort((a, b) => b.n - a.n);
};

/* Keyword rankings from the client record. */
function kwRows(c){
  const out = [];
  ((c && c.keywords) || []).forEach(k => (k.locations || []).forEach(l => {
    const hist = (l.history || []).filter(h => h && h.checkedAt);
    out.push({kw: k.text, loc: l.label || '', rank: l.rank == null ? null : l.rank, prev: l.prevRank == null ? null : l.prevRank,
      at: l.checkedAt || 0, url: l.sourceUrl || '', hist: hist.slice(-24).map(h => [h.checkedAt, h.rank])});
  }));
  return out;
}
const rankTxt = r => r == null ? '—' : r === 0 ? 'Not in top 100' : '#' + r;
const rankMove = (r, p) => {
  if (r == null || p == null) return {cls: 'flat', txt: ''};
  const a = r === 0 ? 101 : r, b = p === 0 ? 101 : p;
  if (a === b) return {cls: 'flat', txt: '='};
  return a < b ? {cls: 'up', txt: '▲ ' + (b === 101 ? 'new' : (b - a))} : {cls: 'down', txt: '▼ ' + (a === 101 ? 'lost' : (a - b))};
};

/* GBP grids: the GBP tracker profiles matching this client, latest scan per keyword. */
function gbpSummary(gbps){
  return (gbps || []).map(g => ({name: g.name || g.bizName || 'Profile', biz: g.bizName || '',
    kws: (g.keywords || []).map(k => {
      const sc = (k.scans || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const last = sc[sc.length - 1], prev = sc[sc.length - 2];
      const stat = s => {
        if (!s) return null;
        const pts = (s.points || []).filter(p => !p.error);
        const ranked = pts.filter(p => p.rank != null && p.rank > 0);
        const avg = ranked.length ? ranked.reduce((t, p) => t + p.rank, 0) / ranked.length : null;
        return {ts: s.ts, n: pts.length, found: ranked.length, top3: ranked.filter(p => p.rank <= 3).length, avg,
          grid: s.grid || Math.round(Math.sqrt(pts.length)) || 0,
          pts: (s.points || []).map(p => [p.row, p.col, p.rank == null || p.error ? null : p.rank])};
      };
      return {kw: k.text, last: stat(last), prev: stat(prev)};
    }).filter(k => k.last)})).filter(g => g.kws.length);
}

/* ==========================================================================
   DRILL-DOWNS (Team report only)
   ========================================================================== */
const DRILL = {};
/* Conversions: everything behind a conversions number, with filters. */
DRILL.conv = (ctx, f) => {
  f = f || {};
  ctx.get('g4').then(g4 => {
    const S = g4Split(ctx, g4);
    const title = f.ai ? 'Conversions from AI' : f.channel ? 'Conversions · ' + chName(f.channel) : f.event ? keLabel(f.event) : f.day ? 'Conversions · ' + prettyDate(f.day) : f.page ? 'Conversions · ' + pageKey(f.page) : 'All conversions';
    U.openDrawer(title + ' · ' + ctx.R.label.toLowerCase(), f.channel ? chColor(f.channel) : f.ai ? '#eb6834' : '#2a78d6', body => {
      const st = {ch: f.channel || (f.ai ? '__ai' : ''), ev: f.event || '', day: f.day || '', page: f.page ? pageKey(f.page) : ''};
      const chans = group(S.conv, r => r[1], 5).map(x => x.k);
      const evs = group(S.conv, r => r[3], 5).map(x => x.k);
      body.innerHTML = '<div data-stats></div>' +
        '<div class="aiv-card"><div class="aiv-filters" style="margin-bottom:0">' +
        '<select data-f="ch"><option value="">All channels</option><option value="__ai">All AI assistants</option>' + chans.map(c => '<option value="' + esc(c) + '">' + esc(chName(c)) + '</option>').join('') + '</select>' +
        '<select data-f="ev"><option value="">All conversion types</option>' + evs.map(e => '<option value="' + esc(e) + '">' + esc(keLabel(e)) + '</option>').join('') + '</select>' +
        (st.day ? '<button class="aiv-btn" type="button" data-clear-day>' + esc(prettyDate(st.day)) + ' ×</button>' : '') +
        (st.page ? '<button class="aiv-btn" type="button" data-clear-page>' + esc(st.page) + ' ×</button>' : '') +
        '</div></div>' +
        '<div class="aiv-card"><h3>By type</h3><div data-by-ev style="margin-top:8px"></div></div>' +
        '<div class="aiv-card"><h3>By channel</h3><div data-by-ch style="margin-top:8px"></div></div>' +
        '<div class="aiv-card"><h3>Every conversion, day by day</h3><p class="aiv-cap" style="margin-bottom:8px">One row per day, channel, source, type and landing page, as GA4 records it.</p><div data-list></div></div>';
      const sel = body.querySelectorAll('[data-f]');
      sel[0].value = st.ch; sel[1].value = st.ev;
      const draw = () => {
        const rows = S.conv.filter(r => (!st.ch || (st.ch === '__ai' ? isAi(r[1]) : r[1] === st.ch)) && (!st.ev || r[3] === st.ev) &&
          (!st.day || r[0] === st.day || (ctx.R.weekly && r[0] >= st.day && r[0] <= addDays(st.day, 6))) && (!st.page || pageKey(r[4]) === st.page));
        const tot = sum(rows, 5);
        const types = group(rows, r => r[3], 5), chs = group(rows, r => r[1], 5);
        body.querySelector('[data-stats]').innerHTML = statsRow([['Conversions', fmt(tot)], ['Types', fmt(types.length), types[0] ? esc(keLabel(types[0].k)) + ' leads' : ''],
          ['Channels', fmt(chs.length), chs[0] ? esc(chName(chs[0].k)) + ' leads' : ''], ['Landing pages', fmt(group(rows, r => pageKey(r[4]), 5).length)]]);
        const maxE = Math.max(1, ...types.map(x => x.n)), maxC = Math.max(1, ...chs.map(x => x.n));
        table(body.querySelector('[data-by-ev]'), types, [
          {key: 'k', label: 'Conversion', fmt: r => esc(keLabel(r.k)) + ' <span style="color:var(--a-ink3);font-size:11px">' + esc(r.k) + '</span>'},
          {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, maxE, '#2a78d6')}], {sort: 'n', onRow: r => { st.ev = r.k; sel[1].value = r.k; draw(); }});
        table(body.querySelector('[data-by-ch]'), chs, [
          {key: 'k', label: 'Channel', fmt: r => chLabel(r.k)},
          {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, maxC, chColor(r.k))}], {sort: 'n', onRow: r => { st.ch = r.k; sel[0].value = r.k; draw(); }});
        table(body.querySelector('[data-list]'), rows.map(r => ({d: r[0], ch: r[1], src: r[2], ev: r[3], pg: r[4], n: r[5]})), [
          {key: 'd', label: 'Date', fmt: r => esc(shortDate(r.d))},
          {key: 'ev', label: 'Conversion', fmt: r => esc(keLabel(r.ev))},
          {key: 'ch', label: 'Channel', fmt: r => chLabel(r.ch) + (r.src && r.src !== '(not set)' && r.src !== '(direct)' ? ' <span style="color:var(--a-ink3);font-size:11px">' + esc(r.src) + '</span>' : '')},
          {key: 'pg', label: 'Landing page', fmt: r => '<span class="aiv-page">' + esc(pageKey(r.pg)) + '</span>'},
          {key: 'n', label: 'Count', num: true}], {sort: 'd', empty: 'No conversions match.', maxH: 520});
      };
      sel[0].addEventListener('change', () => { st.ch = sel[0].value; draw(); });
      sel[1].addEventListener('change', () => { st.ev = sel[1].value; draw(); });
      const cd = body.querySelector('[data-clear-day]'); if (cd) cd.addEventListener('click', () => { st.day = ''; cd.remove(); draw(); });
      const cp = body.querySelector('[data-clear-page]'); if (cp) cp.addEventListener('click', () => { st.page = ''; cp.remove(); draw(); });
      draw();
    });
  });
};
/* Traffic for one channel. */
DRILL.channel = (ctx, ch) => {
  ctx.get('g4').then(g4 => {
    const S = g4Split(ctx, g4), B = buckets(ctx.R);
    const rows = S.traffic.filter(r => !ch || r[1] === ch), prev = S.trafficPrev.filter(r => !ch || r[1] === ch);
    const conv = S.conv.filter(r => !ch || r[1] === ch);
    U.openDrawer((ch ? chName(ch) : 'All traffic') + ' · ' + ctx.R.label.toLowerCase(), ch ? chColor(ch) : '#2a78d6', body => {
      const s = sum(rows, 2), e = sum(rows, 3), k = sum(rows, 5);
      const d = delta(s, sum(prev, 2), S.hasPrev);
      body.innerHTML = statsRow([['Sessions', fmt(s), d.txt ? esc(d.txt) + ' vs previous' : ''], ['Engaged', fmt(e), pctS(e, s) + ' engagement rate'],
        ['Users', fmt(sum(rows, 4))], ['Conversions', fmt(k), pctS(k, s) + ' of sessions']]) +
        '<div class="aiv-card"><h3>Sessions and conversions</h3><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' +
        '<div class="aiv-card"><h3>Conversions</h3><p class="aiv-cap" style="margin-bottom:8px">Click one for every occurrence.</p><div data-ev></div></div>';
      const ss = B.zero(), ks = B.zero();
      rows.forEach(r => { const i = B.slot(r[0]); if (i != null){ ss[i] += r[2]; ks[i] += r[5]; } });
      lineChart(body.querySelector('[data-c]'), {labels: B.labels, weekly: ctx.R.weekly, height: 200,
        series: [{name: 'Sessions', color: ch ? chColor(ch) : '#2a78d6', values: ss, area: true}, {name: 'Conversions', color: '#26313c', values: ks, dash: true}],
        onClick: day => DRILL.conv(ctx, {channel: ch, day})});
      const evs = group(conv, r => r[3], 5), max = Math.max(1, ...evs.map(x => x.n));
      table(body.querySelector('[data-ev]'), evs, [{key: 'k', label: 'Conversion', fmt: r => esc(keLabel(r.k))}, {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, max, ch ? chColor(ch) : '#2a78d6')}],
        {sort: 'n', empty: 'No conversions from this channel in the period.', onRow: r => DRILL.conv(ctx, {channel: ch, event: r.k})});
    });
  });
};
DRILL.kw = (ctx, r) => {
  U.openDrawer(r.kw + (r.loc ? ' · ' + r.loc : ''), KW_COL, body => {
    const m = rankMove(r.rank, r.prev);
    body.innerHTML = statsRow([['Position now', esc(rankTxt(r.rank)), m.txt && m.txt !== '=' ? esc(m.txt) + ' since last check' : ''], ['Previous', esc(rankTxt(r.prev))],
      ['Last checked', r.at ? esc(prettyDate(isoDay(new Date(r.at)))) : '—'], ['Ranking page', r.url ? linkTo('', r.url) : '—']]) +
      '<div class="aiv-card"><h3>Position over time</h3><p class="aiv-cap">Higher on the chart is better. Gaps are checks where the site was outside the top 100.</p><div class="aiv-chart" data-c style="margin-top:10px"></div></div>';
    const h = r.hist.filter(x => x[0]);
    const labels = h.map(x => isoDay(new Date(x[0])));
    /* Rank charted as 101 - rank so up means better. */
    lineChart(body.querySelector('[data-c]'), {labels, height: 200, label: 'position',
      series: [{name: 'Position (101 − rank)', color: KW_COL, values: h.map(x => x[1] > 0 ? 101 - x[1] : null), area: true}],
      empty: 'Only one check so far.'});
  });
};
DRILL.gscQuery = (ctx, q) => {
  U.openDrawer('“' + q[0] + '”', '#2a78d6', body => {
    body.innerHTML = statsRow([['Clicks', fmt(q[1])], ['Impressions', fmt(q[2])], ['CTR', esc(String(q[3])) + '%'], ['Avg position', esc(String(q[4]))]]) +
      '<div class="aiv-card"><h3>Page Google showed</h3><p class="aiv-cap">' + (q[5] ? linkTo('', q[5]) : 'Not recorded') + '</p></div>' +
      '<div class="aiv-note">Search Console numbers for ' + esc(ctx.gscRange || 'the period') + '. Position is the average for this query across all searches that showed the site.</div>';
  });
};

/* ==========================================================================
   WIDGET LIBRARY
   Each: {g: group, t: title, d: description, size, needs: [...], internal?,
          render(host, ctx, w, data)}   data = {feed, g4, gsc, jrn, kw, gbp} as needed
   ========================================================================== */
const W = {};
const G = {
  overview: 'Overview', conv: 'Conversions (GA4, every channel)', traffic: 'Traffic (GA4)', ai: 'AI assistants (GA4)',
  gai: 'Google AI search', bing: 'Copilot / Bing', llm: 'AI answers (prompt checks)', gsc: 'Search Console', kw: 'Keyword rankings',
  gbp: 'Google Business Profile', content: 'Text and embeds'
};
const kpiTile = (label, val, note, opts) => {
  opts = opts || {};
  const tag = opts.click ? 'button type="button"' : 'div';
  return '<' + tag + ' class="rp-kpi"' + (opts.click ? ' data-k="' + esc(opts.click) + '"' : '') + '><div class="rp-kpi-h"><div class="rp-kpi-l">' + esc(label) + '</div>' + (opts.icon || '') + '</div>' +
    '<div class="rp-kpi-v">' + val + (opts.d && opts.d.txt ? '<span class="aiv-delta ' + opts.d.cls + '" style="font-family:var(--ui,Inter,sans-serif)">' + esc(opts.d.txt) + '</span>' : '') + '</div>' +
    '<div class="rp-kpi-n">' + (note || '') + '</div>' + (opts.spark ? U.sparkline(opts.spark, opts.color || '#2a78d6') : '') + '</' + tag.split(' ')[0] + '>';
};
const bigNum = (val, d, note) => '<div class="rp-big">' + val + (d && d.txt ? '<span class="aiv-delta ' + d.cls + '" style="font:600 12px var(--ui,Inter,sans-serif)">' + esc(d.txt) + '</span>' : '') + '</div>' +
  (note ? '<div class="aiv-cap" style="margin-top:4px">' + note + '</div>' : '');
const legendRows = (items, total, opts) => '<div class="rp-legend">' + items.map(x =>
  '<' + (opts && opts.click ? 'button type="button" data-l="' + esc(x.k) + '"' : 'div') + '><i style="background:' + x.color + '"></i>' + (x.logo && BRAND[x.logo] ? logo(x.logo, 16) : '') + '<span>' + esc(x.label) + '</span><b>' + fmt(x.n) + '</b><em>' + pctS(x.n, total) + '</em></' + (opts && opts.click ? 'button' : 'div') + '>').join('') + '</div>';
/* Line chart plus a legend underneath when there is more than one line. */
const chart = (host, cfg) => {
  host.innerHTML = '<div class="aiv-chart"></div>' + (cfg.series.length > 1 ? '<div class="aiv-chips" style="margin-top:8px">' +
    cfg.series.map(x => '<span class="aiv-chip" style="cursor:default"><i style="background:' + x.color + '"></i>' + esc(x.name) + '</span>').join('') + '</div>' : '') + (cfg.foot ? '<p class="aiv-foot">' + cfg.foot + '</p>' : '');
  lineChart(host.firstChild, cfg);
};
/* Chart height: grows with a widget the team made taller. */
const chH = (w, dflt, chrome) => w && w.h ? Math.max(120, w.h - 74 - (chrome || 0)) : dflt;
const onClick = (host, sel, fn) => host.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));

/* ---------- Overview ---------- */
W.headline = {g: 'overview', t: 'Headline numbers', d: 'Sessions, conversions, AI visits, Google clicks and keyword position side by side.', size: 'xl', needs: ['g4', 'feed', 'gsc', 'kw'], soft: true,
  render(h, ctx, w, D){
    const tiles = [];
    if (D.g4){
      const S = g4Split(ctx, D.g4), B = buckets(ctx.R), ss = B.zero(), ks = B.zero();
      S.traffic.forEach(r => { const i = B.slot(r[0]); if (i != null){ ss[i] += r[2]; ks[i] += r[5]; } });
      tiles.push(kpiTile('Sessions', fmt(sum(S.traffic, 2)), 'All channels', {d: delta(sum(S.traffic, 2), sum(S.trafficPrev, 2), S.hasPrev), spark: ss, click: ctx.drill && 'traffic', icon: logo('ga4', 18)}));
      tiles.push(kpiTile('Conversions', fmt(sum(S.conv, 5)), 'GA4 key events, every channel', {d: delta(sum(S.conv, 5), sum(S.convPrev, 5), S.hasPrev), spark: ks, color: '#0f7a58', click: ctx.drill && 'conv', icon: glyph('target', 18, '#0f7a58')}));
      const ai = S.conv.filter(r => isAi(r[1]));
      tiles.push(kpiTile('Conversions from AI', fmt(sum(ai, 5)), 'ChatGPT, Perplexity, Gemini…', {d: delta(sum(ai, 5), sum(S.convPrev.filter(r => isAi(r[1])), 5), S.hasPrev), click: ctx.drill && 'convai', icon: logoStack(AI_STACK.slice(0, 3), 16)}));
    }
    if (D.feed){
      const M = aiModel(ctx, D.feed);
      tiles.push(kpiTile('AI visits', fmt(M.ai.s), 'Visitors sent by AI assistants', {d: delta(M.ai.s, M.ai.ps, M.ai.hasPrev), spark: M.ai.series, color: '#eb6834', click: ctx.drill && 'ai', icon: logoStack(AI_STACK, 16)}));
    }
    if (D.gsc && D.gsc.totals){
      const t = D.gsc.totals, p = (D.gsc.previous || {}).totals;
      tiles.push(kpiTile('Google clicks', fmt(t.clicks), esc(D.gsc.range ? D.gsc.range.label : 'Search Console'), {d: p ? delta(t.clicks, p.clicks, true) : null, click: ctx.drill && 'gsc', icon: logo('gsc', 18)}));
    }
    if (D.kw){
      const ranked = D.kw.filter(r => r.rank > 0);
      const avg = ranked.length ? ranked.reduce((t, r) => t + r.rank, 0) / ranked.length : null;
      tiles.push(kpiTile('Keywords in top 10', fmt(ranked.filter(r => r.rank <= 10).length) + '<small style="font-size:14px;color:var(--a-ink3)"> / ' + D.kw.length + '</small>',
        avg ? 'Average position ' + avg.toFixed(1) : 'No positions yet', {click: ctx.drill && 'kw', icon: glyph('trophy', 18, '#6250d6')}));
    }
    h.innerHTML = tiles.length ? '<div class="rp-kpis">' + tiles.join('') + '</div>' : '<div class="rp-err">No data sources are connected for this client yet.</div>';
    onClick(h, '[data-k]', el => {
      const k = el.dataset.k;
      if (k === 'traffic') DRILL.channel(ctx, '');
      if (k === 'conv') DRILL.conv(ctx, {});
      if (k === 'convai') DRILL.conv(ctx, {ai: true});
      if (k === 'ai') U.openAllAi(aiModel(ctx, D.feed), ctx.domain, 'visits');
      if (k === 'gsc') ctx.scrollTo && ctx.scrollTo('gsc_queries');
      if (k === 'kw') ctx.scrollTo && ctx.scrollTo('kw_table');
    });
  }};

/* ---------- Conversions ---------- */
W.conv_kpi = {g: 'conv', t: 'Conversions', d: 'Total GA4 key events, every channel, with the change from the previous period.', size: 's', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), B = buckets(ctx.R), ks = B.zero();
    S.conv.forEach(r => { const i = B.slot(r[0]); if (i != null) ks[i] += r[5]; });
    const top = group(S.conv, r => r[3], 5)[0];
    h.innerHTML = '<div' + (ctx.drill ? ' role="button" tabindex="0" style="cursor:pointer" data-go' : '') + '>' +
      bigNum(fmt(sum(S.conv, 5)), delta(sum(S.conv, 5), sum(S.convPrev, 5), S.hasPrev), top ? 'Most: ' + esc(keLabel(top.k)) + ' (' + fmt(top.n) + ')' : 'None in this period') +
      '<div style="margin-top:8px">' + U.sparkline(ks, '#0f7a58') + '</div></div>';
    const s = h.querySelector('svg'); if (s){ s.style.width = '100%'; s.style.height = '34px'; }
    onClick(h, '[data-go]', () => DRILL.conv(ctx, {}));
  }};
W.conv_trend = {g: 'conv', t: 'Conversions over time', d: 'Daily or weekly conversions, split by the top channels. Click a day for what happened.', size: 'l', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), B = buckets(ctx.R);
    const chans = group(S.conv, r => r[1], 5).slice(0, 5).map(x => x.k);
    const series = [{name: 'All conversions', color: '#0f7a58', values: B.zero(), area: true}].concat(chans.map(c => ({name: chName(c), color: chColor(c), values: B.zero()})));
    S.conv.forEach(r => { const i = B.slot(r[0]); if (i == null) return; series[0].values[i] += r[5]; const j = chans.indexOf(r[1]); if (j > -1) series[j + 1].values[i] += r[5]; });
    chart(h, {labels: B.labels, weekly: ctx.R.weekly, height: chH(w, 230, 70), series, empty: 'No conversions in this period.', onClick: ctx.drill ? day => DRILL.conv(ctx, {day}) : null});
  }};
W.conv_by_channel = {g: 'conv', t: 'Conversions by channel', d: 'Where converting visitors came from, with AI assistants shown on their own.', size: 'm', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), tot = sum(S.conv, 5);
    const items = group(S.conv, r => r[1], 5).map(x => ({k: x.k, n: x.n, label: chName(x.k), color: chColor(x.k), logo: chLogo(x.k)}));
    if (!items.length){ h.innerHTML = '<div class="rp-err">No conversions in this period.</div>'; return; }
    const top = items.slice(0, 7), rest = items.slice(7);
    if (rest.length) top.push({k: '', n: rest.reduce((t, x) => t + x.n, 0), label: 'Other', color: '#c3ccd3'});
    h.innerHTML = '<div class="rp-donutrow">' + donut(top.map(x => ({key: x.k, label: x.label, n: x.n, color: x.color})), {sub: 'conversions'}) + legendRows(top, tot, {click: ctx.drill}) + '</div>';
    onClick(h, '[data-l]', el => DRILL.conv(ctx, {channel: el.dataset.l}));
  }};
W.conv_by_event = {g: 'conv', t: 'Conversions by type', d: 'Each kind of conversion (form, call, booking…) and how many.', size: 'm', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), cur = group(S.conv, r => r[3], 5), prev = group(S.convPrev, r => r[3], 5);
    const max = Math.max(1, ...cur.map(x => x.n));
    table(h, cur.map(x => Object.assign(x, {p: (prev.find(y => y.k === x.k) || {n: 0}).n})), [
      {key: 'k', label: 'Conversion', fmt: r => esc(keLabel(r.k)) + (ctx.internal ? ' <span style="color:var(--a-ink3);font-size:11px">' + esc(r.k) + '</span>' : '')},
      {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, max, '#0f7a58')},
      {key: 'p', label: 'Change', num: true, fmt: r => { const d = delta(r.n, r.p, S.hasPrev); return d.txt ? '<span class="aiv-delta ' + d.cls + '">' + esc(d.txt) + '</span>' : '—'; }}
    ], {sort: 'n', empty: 'No conversions in this period.', onRow: ctx.drill ? r => DRILL.conv(ctx, {event: r.k}) : null});
  }};
W.conv_by_page = {g: 'conv', t: 'Pages that convert', d: 'Landing pages ranked by the conversions that started there.', size: 'l', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4);
    const m = {};
    S.conv.forEach(r => { const k = pageKey(r[4]); const o = m[k] = m[k] || {k, n: 0, ev: {}}; o.n += r[5]; o.ev[r[3]] = (o.ev[r[3]] || 0) + r[5]; });
    const rows = Object.values(m).sort((a, b) => b.n - a.n), max = Math.max(1, ...rows.map(x => x.n));
    table(h, rows, [
      {key: 'k', label: 'Landing page', fmt: r => '<span class="aiv-page">' + esc(r.k) + '</span>'},
      {key: 'top', label: 'Mostly', fmt: r => esc(keLabel(Object.keys(r.ev).sort((a, b) => r.ev[b] - r.ev[a])[0])), sort: r => Object.keys(r.ev)[0]},
      {key: 'n', label: 'Conversions', num: true, fmt: r => barCell(r.n, max, '#0f7a58')}
    ], {sort: 'n', empty: 'No conversions in this period.', maxH: 380, onRow: ctx.drill ? r => DRILL.conv(ctx, {page: r.k}) : null});
  }};
W.conv_ai = {g: 'conv', t: 'Conversions from AI assistants', d: 'Conversions by visitors ChatGPT, Perplexity, Gemini and others sent, by assistant and type.', size: 'l', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), rows = S.conv.filter(r => isAi(r[1])), prev = S.convPrev.filter(r => isAi(r[1]));
    const tot = sum(rows, 5);
    if (!tot){ h.innerHTML = bigNum('0', null, 'No conversions from AI assistants in this period' + (sum(prev, 5) ? ' (' + fmt(sum(prev, 5)) + ' in the previous one).' : '.')); return; }
    const byA = group(rows, r => r[1], 5), byE = group(rows, r => r[3], 5);
    h.innerHTML = bigNum(fmt(tot), delta(tot, sum(prev, 5), S.hasPrev), pctS(tot, sum(S.conv, 5)) + ' of all conversions') +
      '<div class="aiv-grid2" style="margin-top:12px"><div>' + legendRows(byA.map(x => ({k: x.k, n: x.n, label: x.k.slice(4), color: chColor(x.k), logo: x.k.slice(4)})), tot, {click: ctx.drill}) + '</div>' +
      '<div class="rp-legend">' + byE.map(x => '<div><i style="background:#0f7a58"></i><span>' + esc(keLabel(x.k)) + '</span><b>' + fmt(x.n) + '</b></div>').join('') + '</div></div>';
    onClick(h, '[data-l]', el => DRILL.conv(ctx, {channel: el.dataset.l}));
    if (ctx.drill){ h.querySelector('.rp-big').style.cursor = 'pointer'; h.querySelector('.rp-big').addEventListener('click', () => DRILL.conv(ctx, {ai: true})); }
  }};
W.conv_list = {g: 'conv', t: 'Conversion log', d: 'Every conversion in the period: date, type, channel, source and landing page.', size: 'xl', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4);
    table(h, S.conv.map(r => ({d: r[0], ch: r[1], src: r[2], ev: r[3], pg: r[4], n: r[5]})), [
      {key: 'd', label: 'Date', fmt: r => esc(shortDate(r.d))},
      {key: 'ev', label: 'Conversion', fmt: r => esc(keLabel(r.ev))},
      {key: 'ch', label: 'Channel', fmt: r => chLabel(r.ch)},
      {key: 'src', label: 'Source', fmt: r => esc(r.src === '(direct)' ? 'Direct' : r.src)},
      {key: 'pg', label: 'Landing page', fmt: r => '<span class="aiv-page">' + esc(pageKey(r.pg)) + '</span>'},
      {key: 'n', label: 'Count', num: true}
    ], {sort: 'd', empty: 'No conversions in this period.', maxH: 420, onRow: ctx.drill ? r => DRILL.conv(ctx, {event: r.ev, channel: r.ch}) : null});
  }};

/* ---------- Traffic ---------- */
W.traffic_kpis = {g: 'traffic', t: 'Traffic summary', d: 'Sessions, users, engagement and conversion rate.', size: 'xl', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), t = S.traffic, p = S.trafficPrev;
    const s = sum(t, 2), e = sum(t, 3), k = sum(t, 5);
    h.innerHTML = '<div class="rp-kpis">' +
      kpiTile('Sessions', fmt(s), '', {d: delta(s, sum(p, 2), S.hasPrev), click: ctx.drill && 'all'}) +
      kpiTile('Users', fmt(sum(t, 4)), '', {d: delta(sum(t, 4), sum(p, 4), S.hasPrev)}) +
      kpiTile('Engagement rate', pctS(e, s), fmt(e) + ' engaged sessions', {}) +
      kpiTile('Conversion rate', pctS(k, s), fmt(k) + ' conversions', {click: ctx.drill && 'conv'}) + '</div>';
    onClick(h, '[data-k]', el => el.dataset.k === 'conv' ? DRILL.conv(ctx, {}) : DRILL.channel(ctx, ''));
  }};
W.traffic_trend = {g: 'traffic', t: 'Sessions by channel', d: 'Organic, direct, paid, referral and AI visits over time.', size: 'l', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), B = buckets(ctx.R);
    const chans = group(S.traffic, r => r[1], 2).slice(0, 6).map(x => x.k);
    const series = chans.map(c => ({name: chName(c), color: chColor(c), values: B.zero()}));
    S.traffic.forEach(r => { const i = B.slot(r[0]), j = chans.indexOf(r[1]); if (i != null && j > -1) series[j].values[i] += r[2]; });
    chart(h, {labels: B.labels, weekly: ctx.R.weekly, height: chH(w, 230, 70), series, empty: 'No sessions recorded in this period.', onClick: ctx.drill ? () => DRILL.channel(ctx, '') : null});
  }};
W.traffic_channels = {g: 'traffic', t: 'Channels table', d: 'Each channel’s sessions, engagement, conversions and conversion rate.', size: 'l', needs: ['g4'],
  render(h, ctx, w, D){
    const S = g4Split(ctx, D.g4), m = {};
    S.traffic.forEach(r => { const o = m[r[1]] = m[r[1]] || {k: r[1], s: 0, e: 0, k2: 0, p: 0}; o.s += r[2]; o.e += r[3]; o.k2 += r[5]; });
    S.trafficPrev.forEach(r => { const o = m[r[1]] = m[r[1]] || {k: r[1], s: 0, e: 0, k2: 0, p: 0}; o.p += r[2]; });
    const rows = Object.values(m).filter(x => x.s || x.p), max = Math.max(1, ...rows.map(x => x.s));
    table(h, rows, [
      {key: 'k', label: 'Channel', fmt: r => chLabel(r.k)},
      {key: 's', label: 'Sessions', num: true, fmt: r => barCell(r.s, max, chColor(r.k))},
      {key: 'p', label: 'Change', num: true, fmt: r => { const d = delta(r.s, r.p, S.hasPrev); return d.txt ? '<span class="aiv-delta ' + d.cls + '">' + esc(d.txt) + '</span>' : '—'; }},
      {key: 'e', label: 'Engaged', num: true, fmt: r => pctS(r.e, r.s)},
      {key: 'k2', label: 'Conversions', num: true, fmt: r => fmt(r.k2)},
      {key: 'cr', label: 'Conv. rate', num: true, fmt: r => pctS(r.k2, r.s), sort: r => pct(r.k2, r.s)}
    ], {sort: 's', empty: 'No sessions in this period.', onRow: ctx.drill ? r => DRILL.channel(ctx, r.k) : null});
  }};

/* ---------- AI assistants ---------- */
W.ai_visits = {g: 'ai', t: 'AI visits', d: 'Visitors sent by AI assistants, over time.', size: 'l', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    h.innerHTML = bigNum(fmt(M.ai.s), delta(M.ai.s, M.ai.ps, M.ai.hasPrev), fmt(M.ai.k) + ' key events from AI visitors') + '<div style="margin-top:10px"></div>';
    chart(h.lastChild, {labels: M.labels, weekly: M.weekly, height: chH(w, 190, 150), empty: 'No AI visits in this period.',
      series: [{name: 'AI visits', color: '#eb6834', values: M.ai.series, area: true}, {name: 'Key events', color: '#2a78d6', values: M.ai.keySeries, dash: true}],
      onClick: ctx.drill ? d => U.openDay(M, ctx.domain, d) : null});
    if (ctx.drill){ const b = h.querySelector('.rp-big'); b.style.cursor = 'pointer'; b.addEventListener('click', () => U.openAllAi(M, ctx.domain, 'visits')); }
  }};
W.ai_assistants = {g: 'ai', t: 'Visits by assistant', d: 'ChatGPT, Perplexity, Gemini, Copilot, Claude… with visits and key events.', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed), tot = M.ai.s;
    if (!M.plats.length){ h.innerHTML = '<div class="rp-err">No AI visits in this period.</div>'; return; }
    h.innerHTML = '<div class="rp-donutrow">' + donut(M.plats.map(p => ({key: p.name, label: p.name, n: p.s, color: pcol(p.name)})), {sub: 'AI visits'}) +
      legendRows(M.plats.map(p => ({k: p.name, n: p.s, label: p.name + (p.k ? ' · ' + p.k + ' key ev.' : ''), color: pcol(p.name), logo: p.name})), tot, {click: ctx.drill}) + '</div>';
    onClick(h, '[data-l]', el => U.openPlatform(M, ctx.domain, el.dataset.l));
  }};
W.ai_vs_channels = {g: 'ai', t: 'AI vs Organic vs Direct', d: 'AI visits next to Google organic and direct visits, for scale.', size: 'l', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    chart(h, {labels: M.labels, weekly: M.weekly, height: chH(w, 220, 70), empty: 'Nothing recorded in this period yet.',
      series: [{name: 'AI', color: '#eb6834', values: M.ai.series, area: true}, {name: 'Organic Search', color: '#2a78d6', values: M.channels['Organic Search'].series, dash: true},
        {name: 'Direct', color: '#1baf7a', values: M.channels.Direct.series, dash: true}]});
  }};
W.ai_keyevents = {g: 'ai', t: 'What AI visitors did', d: 'The key events AI visitors triggered, by type and assistant.', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed), ev = keyEventsOf(M.keyEv.rows), max = Math.max(1, ...ev.map(x => x.n));
    table(h, ev, [
      {key: 'label', label: 'Key event', fmt: r => esc(r.label)},
      {key: 'from', label: 'From', fmt: r => logoStack(Object.keys(r.plats), 16), sort: r => Object.keys(r.plats)[0]},
      {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, max, '#2a78d6')}
    ], {sort: 'n', empty: M.keyEv.known ? 'No key events from AI visitors in this period.' : 'Key event names aren’t coming through from the tracker yet.', onRow: ctx.drill ? () => U.openAllAi(M, ctx.domain, 'keys') : null});
  }};
W.ai_pages = {g: 'ai', t: 'Pages AI sends people to', d: 'Landing pages of AI visits, with Google AI impressions and citations.', size: 'l', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed), rows = M.pages.filter(p => p.s || p.g), maxS = Math.max(1, ...rows.map(r => r.s));
    table(h, rows, [
      {key: 'key', label: 'Page', fmt: r => '<span class="aiv-page">' + esc(r.key) + '</span>'},
      {key: 's', label: 'AI visits', num: true, fmt: r => barCell(r.s, maxS, '#eb6834')},
      {key: 'k', label: 'Key events', num: true, fmt: r => fmt(r.k)},
      {key: 'g', label: 'Google AI impr.', num: true, fmt: r => M.google.imported ? fmt(r.g) : '—'}
    ], {sort: rows.some(p => p.s) ? 's' : 'g', empty: 'No pages recorded yet.', maxH: 380, onRow: ctx.drill ? r => U.openPage(M, ctx.domain, r) : null});
  }};
W.ai_journeys = {g: 'ai', t: 'AI visitor journeys', d: 'Each person an AI assistant sent, page by page. Internal only: never sent to a client.', size: 'xl', needs: ['feed'], internal: true,
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    M.loadJourneys = ctx.loadJourneys || null;
    if (!M.loadJourneys){ h.innerHTML = '<div class="rp-err">Journeys need the tracker connection.</div>'; return; }
    U.drawJourneys(h, M, ctx.domain, {});
  }};

/* ---------- Google AI search ---------- */
W.gai_impr = {g: 'gai', t: 'Google AI impressions', d: 'Times the site showed in AI Overviews and AI Mode (Search Console).', size: 'l', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    if (!M.google.imported){ h.innerHTML = '<div class="rp-err">Not imported yet. Needs Search Console access in the tracker.</div>'; return; }
    h.innerHTML = bigNum(fmt(M.google.n), delta(M.google.n, M.google.prev, M.google.prev > 0), 'AI Overviews &amp; AI Mode · data to ' + esc(shortDate(M.google.latest))) + '<div class="aiv-chart" style="margin-top:10px"></div>';
    lineChart(h.querySelector('.aiv-chart'), {labels: M.labels, weekly: M.weekly, height: chH(w, 190, 150), series: [{name: 'Impressions', color: '#1baf7a', values: M.google.series, area: true}]});
    if (ctx.drill){ const b = h.querySelector('.rp-big'); b.style.cursor = 'pointer'; b.addEventListener('click', () => U.openGoogle(M, ctx.domain)); }
  }};
W.gai_pages = {g: 'gai', t: 'Pages Google’s AI shows', d: 'Pages with the most AI Overview / AI Mode impressions.', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed), m = {};
    M.google.pages.forEach(p => { const k = pageKey(p.u); m[k] = (m[k] || 0) + p.n; });
    const rows = Object.keys(m).map(k => ({k, n: m[k]})), max = Math.max(1, ...rows.map(r => r.n));
    table(h, rows, [{key: 'k', label: 'Page', fmt: r => '<span class="aiv-page">' + esc(r.k) + '</span>'}, {key: 'n', label: 'Impressions*', num: true, fmt: r => barCell(r.n, max, '#1baf7a')}],
      {sort: 'n', empty: 'No Google AI page data yet.', maxH: 340});
  }};
W.gai_organic = {g: 'gai', t: 'Google visits to AI-shown pages', d: 'Organic visits and key events on the pages Google’s AI showed (the closest view of AI Overview click-throughs).', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    if (!M.gorg.known){ h.innerHTML = '<div class="rp-err">Not available from the tracker yet.</div>'; return; }
    const ev = keyEventsOf(M.gorg.events);
    h.innerHTML = '<div class="rp-kpis">' + kpiTile('Visits', fmt(M.gorg.s), pctS(M.gorg.e, M.gorg.s) + ' engaged') + kpiTile('Key events', fmt(M.gorg.k), ev[0] ? esc(ev[0].label) + ' leads' : '') + '</div>';
  }};
W.aio = {g: 'gai', t: 'AI Overview citations', d: 'For each tracked keyword and location: did Google show an AI Overview, and did it cite the site?', size: 'l', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    if (ctx.drill){ U.drawAio(h, M, ctx.domain, false); return; }
    if (!M.aio.length){ h.innerHTML = '<div class="rp-err">No AI Overview checks yet.</div>'; return; }
    const lbl = {cited: ['Cited', 'aiv-yes'], named: ['Named', 'aiv-yes'], miss: ['Not mentioned', 'aiv-mid'], none: ['No Overview', 'aiv-no']};
    const cnt = {cited: 0, named: 0, miss: 0, none: 0}; M.aio.forEach(c => cnt[M.aioState(c)]++);
    h.innerHTML = '<div class="rp-donutrow">' + donut([{key: 'cited', label: 'Cited', n: cnt.cited, color: '#1baf7a'}, {key: 'named', label: 'Named', n: cnt.named, color: '#2a78d6'},
      {key: 'miss', label: 'Without the site', n: cnt.miss, color: '#eb6834'}, {key: 'none', label: 'No Overview', n: cnt.none, color: '#c3ccd3'}], {sub: 'searches'}) +
      legendRows([{n: cnt.cited, label: 'Cited the site', color: '#1baf7a'}, {n: cnt.named, label: 'Named the business', color: '#2a78d6'},
        {n: cnt.miss, label: 'Overview without the site', color: '#eb6834'}, {n: cnt.none, label: 'No AI Overview', color: '#c3ccd3'}], M.aio.length) + '</div><div data-t style="margin-top:10px"></div>';
    table(h.querySelector('[data-t]'), M.aio.map(c => ({k: c.k, loc: c.loc, st: M.aioState(c)})), [
      {key: 'k', label: 'Search', fmt: r => esc(r.k)}, {key: 'loc', label: 'Location', fmt: r => esc(r.loc)},
      {key: 'st', label: 'Result', fmt: r => '<span class="aiv-pill ' + lbl[r.st][1] + '">' + lbl[r.st][0] + '</span>'}], {sort: 'st', maxH: 300});
  }};

/* ---------- Copilot ---------- */
W.bing_cites = {g: 'bing', t: 'Copilot citations', d: 'Times Copilot cited the site (Bing Webmaster Tools).', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed);
    if (!M.bing.imported){ h.innerHTML = '<div class="rp-err">Not imported yet. Needs Bing Webmaster Tools access.</div>'; return; }
    h.innerHTML = bigNum(fmt(M.bing.n), delta(M.bing.n, M.bing.prev, M.bing.prev > 0), 'Data to ' + esc(shortDate(M.bing.latest))) + '<div class="aiv-chart" style="margin-top:8px"></div>';
    lineChart(h.querySelector('.aiv-chart'), {labels: M.labels, weekly: M.weekly, height: chH(w, 150, 150), series: [{name: 'Citations', color: '#eda100', values: M.bing.series, area: true}]});
    if (ctx.drill){ const b = h.querySelector('.rp-big'); b.style.cursor = 'pointer'; b.addEventListener('click', () => U.openBing(M, ctx.domain)); }
  }};
W.bing_queries = {g: 'bing', t: 'Questions Copilot cited the site for', d: 'Grounding queries reported by Bing.', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const M = aiModel(ctx, D.feed), max = Math.max(1, ...M.bing.queries.map(q => q.n));
    table(h, M.bing.queries, [{key: 'q', label: 'Question', fmt: r => esc(r.q)}, {key: 'n', label: 'Citations', num: true, fmt: r => barCell(r.n, max, '#eda100')}],
      {sort: 'n', empty: 'No questions reported yet.', maxH: 320});
  }};

/* ---------- Prompt checks ---------- */
function llmLatest(feed){
  const all = (feed.llm && feed.llm.checks) || [];
  const m = {};
  all.forEach(c => { const k = c.p + '|' + c.q; if (!m[k] || c.d > m[k].d) m[k] = c; });
  return {all, latest: Object.values(m)};
}
W.llm_share = {g: 'llm', t: 'AI answer visibility', d: 'Share of tracked prompts where each assistant mentions or cites the business.', size: 'm', needs: ['feed'],
  render(h, ctx, w, D){
    const L = llmLatest(D.feed).latest;
    if (!L.length){ h.innerHTML = '<div class="rp-err">Prompt checks aren’t switched on for this client.</div>'; return; }
    const by = {};
    L.forEach(c => { const o = by[c.p] = by[c.p] || {p: c.p, n: 0, brand: 0, cited: 0}; o.n++; if (c.brand) o.brand++; if (c.cited) o.cited++; });
    const rows = Object.values(by);
    table(h, rows, [{key: 'p', label: 'Assistant', fmt: r => platLabel(r.p)},
      {key: 'brand', label: 'Mentions the business', num: true, fmt: r => barCell(r.brand, r.n, pcol(r.p)) + ' <span style="color:var(--a-ink3);font-size:11px">' + r.brand + '/' + r.n + '</span>', sort: r => pct(r.brand, r.n)},
      {key: 'cited', label: 'Links to the site', num: true, fmt: r => pctS(r.cited, r.n), sort: r => pct(r.cited, r.n)}], {sort: 'brand'});
  }};
W.llm_checks = {g: 'llm', t: 'Prompt check results', d: 'Each tracked question asked to each assistant: mentioned, linked, and which competitors appeared.', size: 'xl', needs: ['feed'],
  render(h, ctx, w, D){
    const L = llmLatest(D.feed).latest;
    if (!L.length){ h.innerHTML = '<div class="rp-err">Prompt checks aren’t switched on for this client.</div>'; return; }
    const yes = b => b ? '<span class="rp-chk">✓</span>' : '<span class="rp-x">—</span>';
    table(h, L.map(c => ({q: c.q, p: c.p, t: c.t || '', brand: !!c.brand, cited: !!c.cited, comp: (c.comp || []).slice(0, 4).join(', '), d: c.d})), [
      {key: 'q', label: 'Question', fmt: r => esc(r.q) + (r.t ? ' <span class="rp-pill">' + esc(r.t) + '</span>' : '')},
      {key: 'p', label: 'Assistant', fmt: r => platLabel(r.p)},
      {key: 'brand', label: 'Mentioned', fmt: r => yes(r.brand), sort: r => r.brand ? 1 : 0},
      {key: 'cited', label: 'Linked', fmt: r => yes(r.cited), sort: r => r.cited ? 1 : 0},
      {key: 'comp', label: 'Also named', fmt: r => '<span style="color:var(--a-ink2);font-size:12px">' + esc(r.comp || '—') + '</span>'},
      {key: 'd', label: 'Checked', fmt: r => esc(shortDate(r.d))}], {sort: 'brand', maxH: 420});
  }};

/* ---------- Search Console ---------- */
const gscLabel = D => D.gsc && D.gsc.range ? D.gsc.range.label || (prettyDate(D.gsc.range.start) + ' – ' + prettyDate(D.gsc.range.end)) : '';
W.gsc_kpis = {g: 'gsc', t: 'Google Search summary', d: 'Clicks, impressions, click-through rate and average position.', size: 'xl', needs: ['gsc'],
  render(h, ctx, w, D){
    const t = D.gsc.totals || {}, p = (D.gsc.previous || {}).totals || null;
    const dd = (a, b, inv) => { if (!p) return null; const d = delta(a, b, true); if (inv && d.txt){ d.cls = d.cls === 'up' ? 'down' : d.cls === 'down' ? 'up' : d.cls; } return d; };
    h.innerHTML = '<div class="rp-kpis">' + kpiTile('Clicks', fmt(t.clicks), esc(gscLabel(D)), {d: dd(t.clicks, p && p.clicks)}) + kpiTile('Impressions', fmtK(t.impressions), '', {d: dd(t.impressions, p && p.impressions)}) +
      kpiTile('Click-through rate', esc(String(t.ctr || 0)) + '%', '', {}) + kpiTile('Average position', esc(String(t.position || '—')), 'Lower is better', {d: dd(t.position, p && p.position, true)}) +
      kpiTile('Search queries', fmt(t.queries), 'Different searches that showed the site', {}) + '</div>';
  }};
W.gsc_trend = {g: 'gsc', t: 'Clicks and impressions by day', d: 'Search Console, day by day.', size: 'l', needs: ['gsc'],
  render(h, ctx, w, D){
    const rows = D.gsc.daily || [];

    const maxI = Math.max(1, ...rows.map(r => Number(r[2]) || 0)), maxC = Math.max(1, ...rows.map(r => Number(r[1]) || 0));
    /* Impressions scaled onto the clicks axis so both lines read; the tooltip shows the real numbers via the label. */
    chart(h, {foot: esc(gscLabel(D)), labels: rows.map(r => r[0]), height: chH(w, 220, 90), series: [{name: 'Clicks', color: '#2a78d6', values: rows.map(r => Number(r[1]) || 0), area: true},
      {name: 'Impressions (scaled)', color: '#8795a1', values: rows.map(r => Math.round((Number(r[2]) || 0) / maxI * maxC * 10) / 10), dash: true}], empty: 'No Search Console data for this period.'});
  }};
const gscTable = (h, ctx, rows, opts) => table(h, rows.map(q => ({q: q[0], c: Number(q[1]) || 0, i: Number(q[2]) || 0, ctr: Number(q[3]) || 0, pos: Number(q[4]) || 0, pg: q[5] || '', raw: q})), [
  {key: 'q', label: opts.first || 'Query', fmt: r => opts.page ? '<span class="aiv-page">' + esc(pageKey(r.q)) + '</span>' : esc(r.q)},
  {key: 'c', label: 'Clicks', num: true, fmt: r => fmt(r.c)}, {key: 'i', label: 'Impressions', num: true, fmt: r => fmt(r.i)},
  {key: 'ctr', label: 'CTR', num: true, fmt: r => r.ctr + '%'}, {key: 'pos', label: 'Position', num: true, fmt: r => r.pos.toFixed(1)}
], {sort: opts.sort || 'c', asc: !!opts.asc, empty: opts.empty || 'No data for this period.', maxH: 400, limit: opts.limit || 200,
  onRow: ctx.drill && !opts.page ? r => DRILL.gscQuery(ctx, r.raw) : null});
W.gsc_queries = {g: 'gsc', t: 'Top search queries', d: 'The searches that brought the most clicks.', size: 'l', needs: ['gsc'],
  render(h, ctx, w, D){ gscTable(h, ctx, D.gsc.queries || [], {}); }};
W.gsc_pages = {g: 'gsc', t: 'Top landing pages from Google', d: 'Pages with the most clicks from Google Search.', size: 'l', needs: ['gsc'],
  render(h, ctx, w, D){ gscTable(h, ctx, D.gsc.pages || [], {first: 'Page', page: true}); }};
W.gsc_almost = {g: 'gsc', t: 'Almost on top', d: 'Queries ranking 4–15 with real impressions: the quickest wins.', size: 'l', needs: ['gsc'],
  render(h, ctx, w, D){ gscTable(h, ctx, (D.gsc.queries || []).filter(q => q[4] >= 4 && q[4] <= 15 && q[2] >= 20), {sort: 'i', empty: 'No queries between positions 4 and 15 with enough impressions.'}); }};
W.gsc_lowctr = {g: 'gsc', t: 'Seen often, rarely clicked', d: 'High-impression queries on page one with a low click-through rate.', size: 'l', needs: ['gsc'],
  render(h, ctx, w, D){ gscTable(h, ctx, (D.gsc.queries || []).filter(q => q[4] <= 10 && q[2] >= 100 && q[3] < 2), {sort: 'i', empty: 'Nothing stands out in this period.'}); }};
W.gsc_devices = {g: 'gsc', t: 'Devices', d: 'Clicks from desktop, mobile and tablet.', size: 's', needs: ['gsc'],
  render(h, ctx, w, D){
    const rows = (D.gsc.devices || []).map(r => ({k: r[0], n: Number(r[1]) || 0})), tot = rows.reduce((t, r) => t + r.n, 0);
    const col = {DESKTOP: '#2a78d6', MOBILE: '#eb6834', TABLET: '#1baf7a'};
    const nice = s => s.charAt(0) + s.slice(1).toLowerCase();
    h.innerHTML = '<div class="rp-donutrow" style="flex-direction:column;align-items:stretch">' + donut(rows.map(r => ({key: r.k, label: nice(r.k), n: r.n, color: col[r.k] || '#8795a1'})), {sub: 'clicks'}).replace('class="aiv-donut"', 'class="aiv-donut" style="margin:0 auto"') +
      legendRows(rows.map(r => ({n: r.n, label: nice(r.k), color: col[r.k] || '#8795a1'})), tot) + '</div>';
  }};
W.gsc_countries = {g: 'gsc', t: 'Top countries', d: 'Clicks by country.', size: 's', needs: ['gsc'],
  render(h, ctx, w, D){
    const rows = (D.gsc.countries || []).slice(0, 8).map(r => ({k: String(r[0]).toUpperCase(), n: Number(r[1]) || 0})), max = Math.max(1, ...rows.map(r => r.n));
    table(h, rows, [{key: 'k', label: 'Country', fmt: r => esc(r.k)}, {key: 'n', label: 'Clicks', num: true, fmt: r => barCell(r.n, max, '#2a78d6')}], {sort: 'n'});
  }};

/* ---------- Keyword rankings ---------- */
const rankCls = r => r == null ? 'out' : r === 0 ? 'out' : r <= 3 ? 't3' : r <= 10 ? 't10' : r <= 20 ? 't20' : r <= 50 ? 't50' : 't100';
const rankBadge = r => { r = r == null || r === '' || !isFinite(Number(r)) ? null : Number(r); return rankBadge_(r); };
const rankBadge_ = r => '<span class="rp-rank ' + rankCls(r) + '" title="' + esc(rankTxt(r)) + '">' + (r == null ? '—' : r === 0 ? '100+' : '#' + r) + '</span>';
const moveChip = (r, p) => { const m = rankMove(r, p); return m.txt && m.txt !== '=' ? '<span class="aiv-delta ' + m.cls + '">' + esc(m.txt) + '</span>' : '<span style="color:var(--a-ink3);font-size:11.5px">no change</span>'; };
/* Position history as a small line: higher is better, gaps where outside the top 100. */
const rankSpark = (hist, color) => {
  const v = (hist || []).filter(x => x[0]).map(x => x[1] > 0 ? 101 - x[1] : null);
  if (v.filter(x => x != null).length < 2) return '<svg class="sp" viewBox="0 0 100 30" preserveAspectRatio="none"></svg>';
  const n = v.length, pts = [];
  v.forEach((y, i) => { if (y != null) pts.push([i * 100 / (n - 1), 28 - (y / 100) * 26]); });
  const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('');
  return '<svg class="sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'L' + pts[pts.length - 1][0].toFixed(1) + ',30L' + pts[0][0].toFixed(1) + ',30Z" fill="' + color + '" opacity=".12"/>' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
};
const DIST = [['Top 3', x => x > 0 && x <= 3, '#0f7a58'], ['4–10', x => x >= 4 && x <= 10, '#1baf7a'], ['11–20', x => x >= 11 && x <= 20, '#2a78d6'], ['21–50', x => x >= 21 && x <= 50, '#eda100'],
  ['51–100', x => x >= 51, '#eb6834'], ['Not in top 100', x => x === 0, '#c3ccd3']];
const distOf = kw => DIST.map(z => ({label: z[0], n: kw.filter(r => r.rank != null && z[1](r.rank)).length, color: z[2]}));
W.kw_kpis = {g: 'kw', t: 'Ranking summary', d: 'Tracked keywords, top 3, top 10, and how many moved up or down.', size: 'xl', needs: ['kw'],
  render(h, ctx, w, D){
    const r = D.kw, ranked = r.filter(x => x.rank > 0);
    if (!r.length){ h.innerHTML = '<div class="rp-err">No keywords tracked for this client yet.</div>'; return; }
    const up = r.filter(x => rankMove(x.rank, x.prev).cls === 'up').length, down = r.filter(x => rankMove(x.rank, x.prev).cls === 'down').length;
    const avg = ranked.length ? (ranked.reduce((t, x) => t + x.rank, 0) / ranked.length).toFixed(1) : '—';
    const t3 = ranked.filter(x => x.rank <= 3).length, t10 = ranked.filter(x => x.rank <= 10).length;
    const dist = distOf(r), tot = dist.reduce((t, x) => t + x.n, 0) || 1;
    h.innerHTML = '<div class="rp-kpis">' + kpiTile('Tracked', fmt(r.length), 'keyword + location pairs', {icon: glyph('search', 18, '#6250d6')}) +
      kpiTile('In top 3', fmt(t3), pctS(t3, r.length) + ' of tracked', {icon: glyph('trophy', 18, '#0f7a58')}) +
      kpiTile('In top 10', fmt(t10), pctS(t10, r.length) + ' on page one', {icon: logo('google', 18)}) +
      kpiTile('Average position', avg, 'of the ' + ranked.length + ' ranking', {icon: glyph('bars', 18, '#2a78d6')}) +
      kpiTile('Moved up', '<span style="color:var(--a-good)">▲ ' + up + '</span>', 'since the previous check', {icon: glyph('up', 18, '#0f7a58')}) +
      kpiTile('Moved down', '<span style="color:#b5352a">▼ ' + down + '</span>', 'since the previous check', {}) + '</div>' +
      '<div class="rp-dist" role="img" aria-label="Position distribution">' + dist.filter(x => x.n).map(x => '<i style="width:' + (x.n / tot * 100) + '%;background:' + x.color + '" title="' + esc(x.label) + ': ' + x.n + '"></i>').join('') + '</div>' +
      '<div class="aiv-chips" style="margin-top:8px">' + dist.filter(x => x.n).map(x => '<span class="aiv-chip" style="cursor:default"><i style="background:' + x.color + '"></i>' + esc(x.label) + ' · ' + x.n + '</span>').join('') + '</div>';
  }};
W.kw_cards = {g: 'kw', t: 'Keyword scorecards', d: 'One card per keyword: position, change since the last check and the trend. Made for client reports.', size: 'xl', needs: ['kw'],
  render(h, ctx, w, D){
    const rows = D.kw.slice().sort((a, b) => (a.rank > 0 ? a.rank : 999) - (b.rank > 0 ? b.rank : 999));
    if (!rows.length){ h.innerHTML = '<div class="rp-err">No keywords tracked for this client yet.</div>'; return; }
    h.innerHTML = '<div class="rp-kwc">' + rows.map((r, i) => {
      const col = r.rank > 0 && r.rank <= 10 ? '#0f7a58' : r.rank > 0 && r.rank <= 20 ? '#2a78d6' : '#eb6834';
      return '<div' + (ctx.drill ? ' data-i="' + i + '" role="button" tabindex="0" style="cursor:pointer"' : '') + '>' +
        '<div class="r"><span class="big">' + (r.rank > 0 ? '#' + r.rank : '<span style="font-size:16px;color:var(--a-ink3)">100+</span>') + '</span>' + moveChip(r.rank, r.prev) + '</div>' +
        '<div class="k" title="' + esc(r.kw) + '">' + esc(r.kw) + '</div>' +
        (r.loc ? '<div class="l">' + glyph('pin', 12) + esc(r.loc) + '</div>' : '') + rankSpark(r.hist, col) + '</div>';
    }).join('') + '</div>';
    onClick(h, '[data-i]', el => DRILL.kw(ctx, rows[Number(el.dataset.i)]));
  }};
W.kw_table = {g: 'kw', t: 'Keyword positions', d: 'Every tracked keyword and location with its position, change and trend.', size: 'xl', needs: ['kw'],
  render(h, ctx, w, D){
    table(h, D.kw, [
      {key: 'kw', label: 'Keyword', fmt: r => '<b style="font-weight:600">' + esc(r.kw) + '</b>'},
      {key: 'loc', label: 'Location', fmt: r => r.loc ? '<span class="rp-nm" style="color:var(--a-ink2)">' + glyph('pin', 13) + esc(r.loc) + '</span>' : '—'},
      {key: 'rank', label: 'Position', num: true, fmt: r => rankBadge(r.rank), sort: r => r.rank == null ? 999 : r.rank === 0 ? 101 : r.rank},
      {key: 'mv', label: 'Change', num: true, fmt: r => { const m = rankMove(r.rank, r.prev); return m.txt && m.txt !== '=' ? '<span class="aiv-delta ' + m.cls + '">' + esc(m.txt) + '</span>' : '<span style="color:var(--a-ink3)">—</span>'; },
        sort: r => (r.prev == null || r.rank == null) ? 0 : (r.prev === 0 ? 101 : r.prev) - (r.rank === 0 ? 101 : r.rank)},
      {key: 'tr', label: 'Trend', fmt: r => '<span style="display:inline-block;width:90px;height:24px;vertical-align:middle">' + rankSpark(r.hist, '#2a78d6').replace('class="sp"', 'class="sp" style="width:90px;height:24px;display:block"') + '</span>', sort: r => r.hist.length},
      {key: 'url', label: 'Ranking page', fmt: r => r.url ? '<span class="aiv-page">' + esc(pageKey(r.url)) + '</span>' : '—'},
      {key: 'at', label: 'Checked', fmt: r => r.at ? esc(shortDate(isoDay(new Date(r.at)))) : '—'}
    ], {sort: 'rank', asc: true, maxH: w.h ? 0 : 460, empty: 'No keywords tracked for this client yet.', onRow: ctx.drill ? r => DRILL.kw(ctx, r) : null});
  }};
W.kw_movers = {g: 'kw', t: 'Biggest movers', d: 'Keywords that moved most since the previous check, up and down.', size: 'l', needs: ['kw'],
  render(h, ctx, w, D){
    const mv = D.kw.filter(r => r.rank != null && r.prev != null && r.rank !== r.prev).map(r => Object.assign({}, r, {dlt: (r.prev === 0 ? 101 : r.prev) - (r.rank === 0 ? 101 : r.rank)}));
    const ups = mv.filter(r => r.dlt > 0).sort((a, b) => b.dlt - a.dlt).slice(0, 6), downs = mv.filter(r => r.dlt < 0).sort((a, b) => a.dlt - b.dlt).slice(0, 6);
    const list = (rs, cls) => rs.length ? rs.map(r => '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--a-line2);font-size:12.5px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.kw) + ' <span style="color:var(--a-ink3)">' + esc(r.loc) + '</span></span><span style="white-space:nowrap;display:inline-flex;gap:6px;align-items:center">' + rankBadge(r.rank) + ' <span class="aiv-delta ' + cls + '">' + esc(rankMove(r.rank, r.prev).txt) + '</span></span></div>').join('') : '<div class="rp-err">None</div>';
    h.innerHTML = '<div class="aiv-grid2"><div><b style="font-size:12px;color:var(--a-good)">Up</b>' + list(ups, 'up') + '</div><div><b style="font-size:12px;color:#b5352a">Down</b>' + list(downs, 'down') + '</div></div>';
  }};
W.kw_dist = {g: 'kw', t: 'Position distribution', d: 'How many keywords sit in the top 3, 4–10, 11–20, 21–50 and beyond.', size: 'm', needs: ['kw'],
  render(h, ctx, w, D){
    const b = distOf(D.kw);
    const tot = b.reduce((t, x) => t + x.n, 0);
    h.innerHTML = '<div class="rp-donutrow">' + donut(b.map(x => ({key: x.label, label: x.label, n: x.n, color: x.color})), {sub: 'positions'}) + legendRows(b, tot) + '</div>';
  }};

/* ---------- GBP grids ---------- */
const heatCol = r => r == null ? '#c3ccd3' : r <= 3 ? '#0f7a58' : r <= 10 ? '#eda100' : r <= 20 ? '#eb6834' : '#b5352a';
W.gbp_grids = {g: 'gbp', t: 'Map pack grids', d: 'Latest Google Maps rank grid per keyword: average rank and share of points in the top 3.', size: 'xl', needs: ['gbp'],
  render(h, ctx, w, D){
    const S = D.gbp;
    if (!S.length){ h.innerHTML = '<div class="rp-err">No Google Business Profile scans found for this client in the GBP Tracker.</div>'; return; }
    h.innerHTML = S.map(g => '<div style="margin-bottom:10px"><b style="font-size:13px">' + esc(g.name) + '</b><div class="rp-gbp" style="margin-top:8px">' + g.kws.map(k => {
      const L = k.last, P = k.prev, n = L.grid || 1;
      const cells = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){ const p = L.pts.find(x => x[0] === r && x[1] === c); cells.push(p ? p[2] : null); }
      const d = P && P.avg && L.avg ? Math.round((P.avg - L.avg) * 10) / 10 : 0;
      return '<div><div style="font-size:12.5px;font-weight:600;line-height:1.3">' + esc(k.kw) + '</div>' +
        '<div style="font-size:11.5px;color:var(--a-ink2);margin-top:3px">' + (L.avg ? 'Avg #' + L.avg.toFixed(1) : 'Not found') + ' · ' + pctS(L.top3, L.n) + ' top 3' +
        (d ? ' <span class="aiv-delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '</span>' : '') + '</div>' +
        '<div class="rp-heat" style="grid-template-columns:repeat(' + n + ',1fr)">' + cells.map(v => '<i style="background:' + heatCol(v) + '">' + (v == null ? '' : v > 20 ? '20+' : esc(String(v))) + '</i>').join('') + '</div>' +
        '<div style="font-size:10.5px;color:var(--a-ink3);margin-top:4px">' + esc(prettyDate(isoDay(new Date(L.ts || Date.now())))) + '</div></div>';
    }).join('') + '</div></div>').join('');
  }};

/* ---------- Text and embeds ---------- */
W.text = {g: 'content', t: 'Text / heading', d: 'A heading and a note: a summary, next steps, anything worth saying in words.', size: 'xl', needs: [], editable: true, plain: true,
  render(h, ctx, w){
    const c = w.cfg || {};
    if (!c.heading && !c.body){ h.innerHTML = '<div class="rp-err">Empty text block. ' + (ctx.editable ? 'Click “Edit” to write something.' : '') + '</div>'; return; }
    h.innerHTML = '<div class="rp-text">' + (c.heading ? '<h2>' + esc(c.heading) + '</h2>' : '') + esc(c.body || '') + '</div>';
  },
  form: w => '<label>Heading</label><input data-c="heading" value="' + esc((w.cfg || {}).heading || '') + '"><label>Text</label><textarea data-c="body">' + esc((w.cfg || {}).body || '') + '</textarea>'};
W.embed = {g: 'content', t: 'Embedded page', d: 'Any web page shown inside the report: a Looker Studio board, a GitHub Pages dashboard, a video…', size: 'xl', needs: [], editable: true,
  render(h, ctx, w){
    const c = w.cfg || {};
    const url = safeUrl(c.url);
    if (!url){ h.innerHTML = '<div class="rp-err">No page set. ' + (ctx.editable ? 'Click “Edit” and paste a link.' : '') + '</div>'; return; }
    const ht = Math.max(200, Math.min(2400, Number(c.height) || 600));
    h.innerHTML = '<iframe class="rp-frame" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" src="' + esc(url) + '" style="height:' + ht + 'px" loading="lazy" referrerpolicy="no-referrer" allowfullscreen title="' + esc(c.title || 'Embedded page') + '"></iframe>' +
      (ctx.internal ? '<p class="aiv-foot">' + esc(url) + ' · <a href="' + esc(url) + '" target="_blank" rel="noopener">open ↗</a>. Some sites refuse to be shown inside another page.</p>' : '');
  },
  form: w => '<label>Link</label><input data-c="url" placeholder="https://…" value="' + esc((w.cfg || {}).url || '') + '"><label>Height (pixels)</label><input data-c="height" type="number" min="200" max="2400" step="50" value="' + esc(String((w.cfg || {}).height || 600)) + '">'};

/* ---------- what each widget looks like: source marks, icon, accent ---------- */
const GMETA = {
  overview: {src: ['ga4', 'gsc', 'ChatGPT'], lbl: 'All sources', ic: 'bolt', tint: '#e87722'},
  conv: {src: ['ga4'], lbl: 'GA4', ic: 'target', tint: '#0f7a58'},
  traffic: {src: ['ga4'], lbl: 'GA4', ic: 'users', tint: '#2a78d6'},
  ai: {src: AI_STACK, lbl: 'AI assistants', ic: 'spark', tint: '#eb6834'},
  gai: {src: ['google'], lbl: 'Google AI', ic: 'spark', tint: '#1baf7a'},
  bing: {src: ['Copilot', 'bing'], lbl: 'Copilot · Bing', ic: 'chat', tint: '#d08c00'},
  llm: {src: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'], lbl: 'Prompt checks', ic: 'quote', tint: '#6250d6'},
  gsc: {src: ['gsc'], lbl: 'Search Console', ic: 'search', tint: '#2a78d6'},
  kw: {src: ['google'], lbl: 'Rankings', ic: 'trophy', tint: '#6250d6'},
  gbp: {src: ['gbp', 'maps'], lbl: 'Business Profile', ic: 'pin', tint: '#e34948'},
  content: {src: [], lbl: '', ic: 'text', tint: '#8795a1'}
};
const WIC = {conv_trend: 'line', conv_by_channel: 'donut', conv_by_event: 'bars', conv_by_page: 'page', conv_list: 'table', traffic_trend: 'line', traffic_channels: 'table',
  ai_visits: 'line', ai_assistants: 'donut', ai_vs_channels: 'line', ai_keyevents: 'flag', ai_pages: 'page', ai_journeys: 'path', gai_impr: 'line', gai_pages: 'page', gai_organic: 'users',
  aio: 'quote', llm_share: 'donut', llm_checks: 'table', gsc_trend: 'line', gsc_pages: 'page', gsc_almost: 'up', gsc_lowctr: 'target', gsc_devices: 'device', gsc_countries: 'globe',
  kw_cards: 'grid', kw_table: 'table', kw_movers: 'up', kw_dist: 'donut', gbp_grids: 'grid', embed: 'globe'};
const WSRC = {conv_ai: ['ga4', 'ChatGPT', 'Perplexity'], ai_vs_channels: ['ChatGPT', 'google'], gai_organic: ['google', 'ga4'], aio: ['google'], kw_kpis: ['google'], embed: []};
const metaOf = type => {
  const def = W[type] || {}, g = GMETA[def.g] || GMETA.content;
  return {src: WSRC[type] || g.src, lbl: type === 'embed' ? '' : g.lbl, ic: WIC[type] || g.ic, tint: g.tint};
};
const wIcon = (type, sz) => { const m = metaOf(type); return '<span class="rp-wic" style="--tint:' + m.tint + '">' + glyph(m.ic, sz || 16) + '</span>'; };
const srcChip = type => { const m = metaOf(type); return m.src.length || m.lbl ? '<span class="rp-src" title="Data from ' + esc(m.lbl) + '">' + (m.src.length ? logoStack(m.src, 14) : '') + esc(m.lbl) + '</span>' : ''; };

/* Default Team report: a bit of everything, most useful first. */
const TEAM_DEFAULT = [
  ['headline', 'xl'], ['conv_trend', 'l'], ['conv_by_channel', 'l'], ['conv_by_event', 'l'], ['conv_ai', 'l'], ['conv_by_page', 'l'], ['traffic_channels', 'l'], ['conv_list', 'xl'],
  ['traffic_trend', 'l'], ['ai_vs_channels', 'l'], ['ai_visits', 'l'], ['ai_assistants', 'l'], ['ai_keyevents', 'l'], ['ai_pages', 'l'], ['ai_journeys', 'xl'],
  ['gai_impr', 'l'], ['aio', 'l'], ['gai_pages', 'm'], ['gai_organic', 'm'], ['bing_cites', 'm'], ['bing_queries', 'l'], ['llm_share', 'l'], ['llm_checks', 'xl'],
  ['gsc_kpis', 'xl'], ['gsc_trend', 'l'], ['gsc_queries', 'l'], ['gsc_almost', 'l'], ['gsc_lowctr', 'l'], ['gsc_pages', 'l'], ['gsc_devices', 's'], ['gsc_countries', 's'],
  ['kw_kpis', 'xl'], ['kw_cards', 'xl'], ['kw_movers', 'l'], ['kw_dist', 'l'], ['kw_table', 'xl'], ['gbp_grids', 'xl']
];
const SIZE_COLS = {s: 3, m: 4, l: 6, xl: 12};
const SIZES = [['s', 'Quarter'], ['m', 'Third'], ['l', 'Half'], ['xl', 'Full width']];
const colsOf = it => Math.max(2, Math.min(12, Number(it.cols) || SIZE_COLS[it.size] || 6));
const newItem = (type, size, cfg) => ({id: uid(), type, size: size || (W[type] && W[type].size) || 'l', cfg: cfg || {}});
/* A widget's own layout fields, as saved and as copied to the client report. */
const layoutOf = it => { const o = {id: it.id, type: it.type, size: it.size}; if (it.cols) o.cols = it.cols; if (it.h) o.h = it.h; return o; };

/* Accent colours offered in Branding. */
const ACCENTS = ['#e87722', '#2a78d6', '#0f7a58', '#6250d6', '#e34948', '#0b8fa3', '#1b222a'];
/* Report header: logos, then the title. brand = {logo, agency, accent, banner, logoH}; logos resolved by the caller. */
function brandHtml(o){
  const b = o.brand || {}, imgs = [];
  if (o.clientLogo) imgs.push('<img src="' + esc(o.clientLogo) + '" alt="' + esc(o.clientName || 'Client') + ' logo" referrerpolicy="no-referrer" onerror="this.remove()">');
  if (o.agencyLogo && b.agency !== false) imgs.push((imgs.length ? '<span class="rp-x2"></span>' : '') + '<img src="' + esc(o.agencyLogo) + '" alt="EDGE Marketing &amp; Design" onerror="this.remove()">');
  return imgs.length ? '<div class="rp-brand" style="--logoh:' + (Number(b.logoH) || 44) + 'px">' + imgs.join('') + '</div>' : '';
}

/* ==========================================================================
   BOARD
   opts: {mode: 'team'|'client'|'public', title, sub, items, period, ctx, editable,
          onItems(items), onPeriod(p), pushed: Set(team ids in client), onPush(item),
          actionsHtml, topHtml, onAddFromTeam(), teamItems,
          periods: [keys shown in the switcher], showDates, lockNote,
          brand, clientLogo, agencyLogo, clientName, onBrand}
   ========================================================================== */
function renderBoard(root, o){
  styles();
  const ctx = o.ctx;
  ctx.R = rangeOf(o.period);
  ctx._m = {};
  ctx.drill = o.mode === 'team';
  ctx.internal = o.mode !== 'public';
  ctx.editable = !!o.editable;
  let editing = !!o.startEditing;
  const items = o.items;
  const brand = o.brand || {};
  const shown = PERIODS.filter(p => !o.periods || o.periods.indexOf(p[0]) > -1);
  const seg = shown.length > 1
    ? '<div class="aiv-seg" data-period>' + shown.map(p => '<button type="button" data-p="' + p[0] + '"' + (p[0] === String(o.period) ? ' class="on"' : '') + '>' + p[2] + '</button>').join('') + '</div>'
    : (o.lockNote ? '<span class="rp-lock" title="Reporting period">' + glyph('cal', 14) + esc(ctx.R.label) + '</span>' : '');
  const dates = o.showDates === false ? '' : esc(ctx.R.text);
  const sub = [dates, o.sub || ''].filter(Boolean).join(' · ');

  root.innerHTML = '<div class="aiv rp' + (editing ? ' editing' : '') + '"' + (brand.accent && /^#[0-9a-f]{3,8}$/i.test(brand.accent) ? ' style="--a-brand:' + esc(brand.accent) + ';--a-deep:' + esc(brand.accent) + ';--a-wash:color-mix(in srgb,' + esc(brand.accent) + ' 10%,#fff)"' : '') + '>' +
    '<div class="rp-head' + (brand.banner ? ' rp-banner' : '') + '"><div>' + brandHtml(o) + '<h2 class="rp-title">' + esc(o.title || '') + '</h2>' + (sub ? '<div class="rp-sub">' + sub + '</div>' : '') + '</div>' +
    '<div class="rp-bar">' + seg +
      (o.editable ? '<button class="aiv-btn" type="button" data-edit>' + (editing ? 'Done' : 'Customize') + '</button><button class="aiv-btn rp-edit-only" type="button" data-add>+ Add widget</button>' +
        (o.onBrand ? '<button class="aiv-btn rp-edit-only" type="button" data-brand style="display:inline-flex;align-items:center;gap:6px">' + glyph('brush', 14) + 'Branding</button>' : '') : '') +
      (o.actionsHtml || '') + '</div></div>' + '<div data-panel></div>' + (o.topHtml || '') +
    '<div class="rp-grid" data-grid></div></div>';
  const rp = root.querySelector('.rp'), grid = root.querySelector('[data-grid]');

  root.querySelectorAll('[data-period] button').forEach(b => b.addEventListener('click', () => o.onPeriod && o.onPeriod(b.dataset.p)));
  const eb = root.querySelector('[data-edit]');
  if (eb) eb.addEventListener('click', () => { editing = !editing; rp.classList.toggle('editing', editing); eb.textContent = editing ? 'Done' : 'Customize'; o.onEditing && o.onEditing(editing); if (!editing) root.querySelector('[data-panel]').innerHTML = ''; });
  const ab = root.querySelector('[data-add]');
  if (ab) ab.addEventListener('click', () => openCatalog(o, () => { drawAll(); }));
  const bb = root.querySelector('[data-brand]');
  if (bb) bb.addEventListener('click', () => brandPanel(root.querySelector('[data-panel]'), o));

  ctx.scrollTo = type => { const el = grid.querySelector('[data-type="' + type + '"]'); if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'}); };

  const commit = () => { o.onItems && o.onItems(items); };
  let dragId = null;

  function drawAll(){
    grid.innerHTML = '';
    if (!items.length){
      grid.innerHTML = '<div class="rp-empty">' + (o.emptyHtml || '<h3>No widgets yet</h3>Click “Customize”, then “Add widget”.') + '</div>';
      const eh = grid.querySelector('[data-empty-add]'); if (eh) eh.addEventListener('click', () => openCatalog(o, () => drawAll()));
      return;
    }
    items.forEach(it => grid.appendChild(drawWidget(it)));
  }

  /* Width in grid columns and an optional fixed height, both set by dragging. */
  function applySize(el, it){
    const c = colsOf(it);
    el.style.setProperty('--c', c);
    el.classList.toggle('nar', c < 6);
    el.style.height = it.h ? it.h + 'px' : '';
    el.classList.toggle('fixh', !!it.h);
  }

  function drawWidget(it){
    const def = W[it.type];
    const el = document.createElement('section');
    const m = metaOf(it.type);
    el.className = 'rp-w ' + (it.size || 'l') + (def && def.plain && !(it.cfg && it.cfg.title) ? ' plain' : '');
    el.style.setProperty('--tint', m.tint);
    el.dataset.id = it.id; el.dataset.type = it.type;
    applySize(el, it);
    if (!def){ el.innerHTML = '<div class="rp-err">This widget type is no longer available.</div>'; return el; }
    const title = (it.cfg && it.cfg.title) || def.t;
    const pushed = o.pushed && o.pushed.has(it.id);
    const canPush = o.mode === 'team' && !def.internal;
    const sizeKey = it.cols && SIZE_COLS[it.size] !== it.cols ? '' : (it.size || 'l');
    el.innerHTML = '<div class="rp-wh"><div class="rp-wt">' + (def.plain && !(it.cfg && it.cfg.title) ? '' : wIcon(it.type)) + '<div style="min-width:0"><h3><span class="rp-drag" title="Drag to move" aria-hidden="true">⠿</span>' + esc(title) + '</h3>' +
      (o.mode === 'team' && def.d && !def.plain ? '<p>' + esc(def.d) + '</p>' : '') + (def.plain ? '' : srcChip(it.type)) + '</div></div><div class="rp-acts">' +
      (canPush ? '<button type="button" class="rp-ib' + (pushed ? ' on' : '') + '" data-push title="' + (pushed ? 'Already in the client report: click to remove it there' : 'Add a copy to the client report') + '">' + (pushed ? '✓ In client report' : '→ Client report') + '</button>' : '') +
      (o.editable ? '<span class="rp-ib rp-edit-only"><select data-size aria-label="Width">' + (sizeKey ? '' : '<option value="" selected>' + colsOf(it) + ' of 12</option>') +
          SIZES.map(s => '<option value="' + s[0] + '"' + (s[0] === sizeKey ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></span>' +
        (it.h ? '<button type="button" class="rp-ib rp-edit-only" data-autoh title="Let the height follow the content again">Auto height</button>' : '') +
        '<button type="button" class="rp-ib rp-edit-only" data-up title="Move earlier">↑</button><button type="button" class="rp-ib rp-edit-only" data-down title="Move later">↓</button>' +
        '<button type="button" class="rp-ib rp-edit-only" data-cfg title="Rename' + (def.form ? ' or edit content' : '') + '">Edit</button>' +
        '<button type="button" class="rp-ib rp-edit-only" data-del title="Remove from this report">×</button>' : '') +
      '</div></div><div data-body><div class="rp-load"><span class="aiv-spin"></span></div></div>' +
      (o.editable ? '<div class="rp-rz e" data-rz="e" title="Drag to change the width"></div><div class="rp-rz s" data-rz="s" title="Drag to change the height (double-click: automatic)"></div>' +
        '<div class="rp-rz se" data-rz="se" title="Drag to resize (double-click: automatic height)">' + glyph('resize', 12) + '</div>' : '');
    const body = el.querySelector('[data-body]');

    /* data */
    const needs = def.needs || [];
    Promise.all(needs.map(n => ctx.get(n).then(v => [n, v], e => [n, null, e]))).then(res => {
      if (!body.isConnected) return;
      const D = {}, errs = [];
      res.forEach(r => { D[r[0]] = r[1]; if (r[2]) errs.push(r[2]); });
      if (needs.length && !def.soft && errs.length){ body.innerHTML = '<div class="rp-err">' + esc(errs[0].message || String(errs[0])) + '</div>'; return; }
      if (needs.length && def.soft && errs.length === needs.length){ body.innerHTML = '<div class="rp-err">' + esc(errs[0].message || String(errs[0])) + '</div>'; return; }
      body.innerHTML = '';
      try{ def.render(body, ctx, it, D); }
      catch(err){ console.warn('widget', it.type, err); body.innerHTML = '<div class="rp-err">This widget couldn’t draw: ' + esc(err.message) + '</div>'; }
      if (it.h) body.querySelectorAll('.aiv-scroll').forEach(x => { x.style.maxHeight = 'none'; });
    });

    /* actions */
    const redraw = () => { const n = drawWidget(it); el.replaceWith(n); return n; };
    const pb = el.querySelector('[data-push]');
    if (pb) pb.addEventListener('click', () => { o.onPush && o.onPush(it); });
    const sz = el.querySelector('[data-size]');
    if (sz) sz.addEventListener('change', () => { if (!sz.value) return; it.size = sz.value; it.cols = SIZE_COLS[sz.value]; commit(); redraw(); });
    const ah = el.querySelector('[data-autoh]');
    if (ah) ah.addEventListener('click', () => { delete it.h; commit(); redraw(); });
    const mv = d => { const i = items.indexOf(it), j = i + d; if (j < 0 || j >= items.length) return; items.splice(i, 1); items.splice(j, 0, it); commit(); drawAll(); };
    const up = el.querySelector('[data-up]'), dn = el.querySelector('[data-down]');
    if (up) up.addEventListener('click', () => mv(-1));
    if (dn) dn.addEventListener('click', () => mv(1));
    const del = el.querySelector('[data-del]');
    if (del) del.addEventListener('click', () => { items.splice(items.indexOf(it), 1); commit(); el.remove(); if (!items.length) drawAll(); });
    const cf = el.querySelector('[data-cfg]');
    if (cf) cf.addEventListener('click', () => {
      const form = document.createElement('div');
      form.className = 'rp-form';
      form.innerHTML = '<label>Widget title</label><input data-c="title" value="' + esc((it.cfg && it.cfg.title) || def.t) + '">' + (def.form ? def.form(it) : '') +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="aiv-btn" type="button" data-x>Cancel</button><button class="aiv-btn go" type="button" data-ok>Save</button></div>';
      body.innerHTML = ''; body.appendChild(form);
      form.querySelector('[data-x]').addEventListener('click', redraw);
      form.querySelector('[data-ok]').addEventListener('click', () => {
        it.cfg = it.cfg || {};
        form.querySelectorAll('[data-c]').forEach(f => { const k = f.dataset.c; let v = f.value.trim(); if (k === 'title' && v === def.t) v = ''; if (v) it.cfg[k] = v; else delete it.cfg[k]; });
        if (it.cfg.url){ let u = it.cfg.url; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; it.cfg.url = safeUrl(u) ? u : ''; }
        commit(); redraw();
      });
    });

    /* resize with the mouse (edit mode): right edge = width, bottom edge = height, corner = both */
    el.querySelectorAll('[data-rz]').forEach(hd => {
      hd.addEventListener('dblclick', e => { e.preventDefault(); if (it.h){ delete it.h; commit(); redraw(); } });
      hd.addEventListener('pointerdown', e => {
        if (!rp.classList.contains('editing') || e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const dir = hd.dataset.rz, r0 = el.getBoundingClientRect();
        const gs = getComputedStyle(grid), gap = parseFloat(gs.columnGap) || 16;
        const colW = (grid.clientWidth + gap) / 12;
        const c0 = colsOf(it), h0 = r0.height;
        let c = c0, hh = it.h || null, moved = false;
        const badge = document.createElement('div'); badge.className = 'rp-rzbadge'; el.appendChild(badge);
        const show = () => { badge.textContent = c + ' of 12 wide' + (hh ? ' · ' + hh + 'px tall' : ' · auto height'); };
        el.classList.add('resizing'); document.body.classList.add('rp-resizing'); show();
        try{ hd.setPointerCapture(e.pointerId); }catch(x){}
        const move = ev => {
          moved = true;
          if (dir !== 's'){ c = Math.max(2, Math.min(12, Math.round((r0.width + (ev.clientX - e.clientX) + gap) / colW))); el.style.setProperty('--c', c); }
          if (dir !== 'e'){ hh = Math.max(140, Math.min(2400, Math.round((h0 + (ev.clientY - e.clientY)) / 10) * 10)); el.style.height = hh + 'px'; el.classList.add('fixh'); }
          show();
        };
        const end = () => {
          hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', end); hd.removeEventListener('pointercancel', end);
          el.classList.remove('resizing'); document.body.classList.remove('rp-resizing'); badge.remove();
          if (!moved) return;
          it.cols = c;
          const near = Object.keys(SIZE_COLS).find(k => SIZE_COLS[k] === c);
          it.size = near || (c <= 3 ? 's' : c <= 4 ? 'm' : c <= 8 ? 'l' : 'xl');
          if (hh) it.h = hh;
          commit(); redraw();
        };
        hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end);
      });
    });

    /* drag and drop (edit mode) */
    const handle = el.querySelector('.rp-drag');
    if (o.editable && handle){
      handle.addEventListener('mousedown', () => { if (rp.classList.contains('editing')) el.draggable = true; });
      el.addEventListener('dragstart', e => { dragId = it.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try{ e.dataTransfer.setData('text/plain', it.id); }catch(x){} });
      el.addEventListener('dragend', () => { el.draggable = false; el.classList.remove('dragging'); grid.querySelectorAll('.dropbefore').forEach(x => x.classList.remove('dropbefore')); dragId = null; });
      el.addEventListener('dragover', e => { if (!dragId || dragId === it.id) return; e.preventDefault(); grid.querySelectorAll('.dropbefore').forEach(x => x.classList.remove('dropbefore')); el.classList.add('dropbefore'); });
      el.addEventListener('drop', e => {
        e.preventDefault();
        const from = items.findIndex(x => x.id === dragId); if (from < 0) return;
        const moved = items.splice(from, 1)[0];
        items.splice(items.indexOf(it), 0, moved);
        commit(); drawAll();
      });
    }
    return el;
  }

  drawAll();
  return {redraw: drawAll};
}

/* Branding: logos at the top, accent colour, header style. Saved through o.onBrand(brand). */
function brandPanel(host, o){
  if (host.innerHTML){ host.innerHTML = ''; return; }
  const b = Object.assign({logo: 'auto', agency: true, accent: '', banner: false, logoH: 44}, o.brand || {});
  const custom = b.logo && b.logo !== 'auto' && b.logo !== 'none' && b.logo !== 'site';
  host.innerHTML = '<div class="rp-panel"><h4>' + glyph('brush', 16) + 'Branding</h4>' +
    '<div class="row"><span class="lbl">Client logo</span>' +
      [['auto', 'From the client record'], ['site', 'Website icon'], ['custom', 'Upload or link'], ['none', 'None']].map(x =>
        '<label class="rp-chipx' + ((x[0] === 'custom' ? custom : b.logo === x[0]) ? ' on' : '') + '"><input type="radio" name="rpLogo" value="' + x[0] + '"' + ((x[0] === 'custom' ? custom : b.logo === x[0]) ? ' checked' : '') + '>' + x[1] + '</label>').join('') + '</div>' +
    '<div class="row" data-custom' + (custom ? '' : ' hidden') + '><input type="url" data-url placeholder="https://…/logo.png" value="' + esc(custom && !/^data:/.test(b.logo) ? b.logo : '') + '" style="flex:1;min-width:220px">' +
      '<label class="aiv-btn" style="cursor:pointer">Upload image<input type="file" accept="image/*" data-file hidden></label>' + (custom && /^data:/.test(b.logo) ? '<span class="aiv-cap">Uploaded image in use</span>' : '') + '</div>' +
    '<div class="row"><span class="lbl">Logo size</span><input type="range" min="28" max="80" step="2" value="' + (Number(b.logoH) || 44) + '" data-h style="width:180px"><span class="aiv-cap" data-hv>' + (Number(b.logoH) || 44) + 'px</span>' +
      '<label class="rp-chipx' + (b.agency !== false ? ' on' : '') + '" style="margin-left:12px"><input type="checkbox" data-agency' + (b.agency !== false ? ' checked' : '') + '>Show the EDGE logo</label></div>' +
    '<div class="row"><span class="lbl">Accent colour</span>' + ACCENTS.map(c => '<button type="button" class="rp-sw' + ((b.accent || '#e87722') === c ? ' on' : '') + '" data-acc="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
      '<input type="color" data-accx value="' + esc(b.accent || '#e87722') + '" title="Any colour" style="width:34px;height:28px;border:0;background:none;padding:0;cursor:pointer"></div>' +
    '<div class="row"><span class="lbl">Header</span><label class="rp-chipx' + (!b.banner ? ' on' : '') + '"><input type="radio" name="rpHead" value="0"' + (!b.banner ? ' checked' : '') + '>Plain</label>' +
      '<label class="rp-chipx' + (b.banner ? ' on' : '') + '"><input type="radio" name="rpHead" value="1"' + (b.banner ? ' checked' : '') + '>Banner in the accent colour</label></div>' +
    '<div class="row" style="justify-content:flex-end"><button class="aiv-btn" type="button" data-close>Close</button></div></div>';
  const P = host.firstChild;
  const save = () => o.onBrand && o.onBrand(Object.assign({}, b));
  P.querySelectorAll('input[name=rpLogo]').forEach(r => r.addEventListener('change', () => {
    if (r.value === 'custom'){ P.querySelector('[data-custom]').hidden = false; P.querySelectorAll('input[name=rpLogo]').forEach(x => x.parentNode.classList.toggle('on', x.checked)); return; }
    b.logo = r.value; save();
  }));
  const url = P.querySelector('[data-url]');
  url.addEventListener('change', () => { let u = url.value.trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; if (!safeUrl(u)) return; b.logo = u; save(); });
  P.querySelector('[data-file]').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    shrinkImage(f, 480, 160).then(d => { b.logo = d; save(); }, err => alert(err.message));
  });
  const hr = P.querySelector('[data-h]');
  hr.addEventListener('input', () => { P.querySelector('[data-hv]').textContent = hr.value + 'px'; const bi = host.parentNode.querySelector('.rp-brand'); if (bi) bi.style.setProperty('--logoh', hr.value + 'px'); });
  hr.addEventListener('change', () => { b.logoH = Number(hr.value); save(); });
  P.querySelector('[data-agency]').addEventListener('change', e => { b.agency = e.target.checked; save(); });
  P.querySelectorAll('[data-acc]').forEach(x => x.addEventListener('click', () => { b.accent = x.dataset.acc === '#e87722' ? '' : x.dataset.acc; save(); }));
  P.querySelector('[data-accx]').addEventListener('change', e => { b.accent = e.target.value; save(); });
  P.querySelectorAll('input[name=rpHead]').forEach(r => r.addEventListener('change', () => { b.banner = r.value === '1'; save(); }));
  P.querySelector('[data-close]').addEventListener('click', () => { host.innerHTML = ''; });
}
/* An uploaded logo, scaled down so it stays small on the client record. */
function shrinkImage(file, maxW, maxH){
  return new Promise((res, rej) => {
    if (!/^image\//.test(file.type)) return rej(new Error('That file isn’t an image.'));
    const rd = new FileReader();
    rd.onerror = () => rej(new Error('Couldn’t read the file.'));
    rd.onload = () => {
      if (file.type === 'image/svg+xml' && rd.result.length < 60000) return res(rd.result);
      const im = new Image();
      im.onerror = () => rej(new Error('Couldn’t open the image.'));
      im.onload = () => {
        const k = Math.min(1, maxW / im.width, maxH / im.height);
        const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/png'));
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

/* Widget picker. Team: the whole library. Client: what the team report has (to copy over) plus text and embeds. */
function openCatalog(o, done){
  const back = document.createElement('div');
  back.className = 'rp-cat-back';
  const inBoard = new Set(o.items.map(i => i.type));
  const row = (k, title, sub, btn) => '<div class="rp-cat-i"><div style="display:flex;gap:10px;align-items:flex-start;min-width:0">' + wIcon(k, 17) + '<div style="min-width:0"><strong>' + title + '</strong><small>' + sub + '</small>' +
    (metaOf(k).src.length ? '<div style="margin-top:5px">' + logoStack(metaOf(k).src, 14) + '</div>' : '') + '</div></div>' + btn + '</div>';
  let html = '<div class="rp-cat aiv" role="dialog" aria-modal="true" aria-label="Add widgets"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h2>Add widgets</h2><div class="aiv-cap">' +
    (o.mode === 'client' ? 'Copy widgets from the team report, or add any client-safe widget, text and embedded pages. Each one can be moved and resized here without changing the team report.' : 'Every widget the tool can draw, grouped by where the data comes from. Widgets can be added more than once (for example two embedded pages).') +
    '</div></div><button class="aiv-x" type="button" aria-label="Close" style="border:0;background:none;font-size:22px;cursor:pointer">×</button></div>';
  if (o.mode === 'client'){
    const team = (o.teamItems || []).filter(t => W[t.type] && !W[t.type].internal);
    html += '<div class="rp-cat-g"><b>From the team report</b><div class="rp-cat-list">' + (team.length ? team.map(t => {
      const has = o.items.some(x => x.from === t.id);
      return row(t.type, esc((t.cfg && t.cfg.title) || W[t.type].t), esc(G[W[t.type].g]), '<button class="rp-ib' + (has ? ' on' : ' go') + '" type="button" data-team="' + esc(t.id) + '"' + (has ? ' disabled' : '') + '>' + (has ? 'Added' : 'Add') + '</button>');
    }).join('') : '<div class="aiv-cap">The team report has no widgets yet.</div>') + '</div></div>';
  }
  Object.keys(G).forEach(g => {
    const ks = Object.keys(W).filter(k => W[k].g === g && !(o.mode === 'client' && W[k].internal));
    if (!ks.length) return;
    html += '<div class="rp-cat-g"><b>' + esc(G[g]) + '</b><div class="rp-cat-list">' + ks.map(k => row(k, esc(W[k].t) + (inBoard.has(k) ? ' <span class="rp-pill">on the report</span>' : ''), esc(W[k].d),
      '<button class="rp-ib go" type="button" data-type="' + k + '">Add</button>')).join('') + '</div></div>';
  });
  html += '</div>';
  back.innerHTML = html;
  document.body.appendChild(back);
  const close = () => { back.remove(); done && done(); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  back.querySelector('.aiv-x').addEventListener('click', close);
  const added = b => { b.textContent = 'Added ✓'; b.classList.remove('go'); b.classList.add('on'); };
  back.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
    const it = newItem(b.dataset.type);
    if (b.dataset.type === 'text' || b.dataset.type === 'embed') it.size = 'xl';
    o.items.push(it); o.onItems && o.onItems(o.items); added(b);
  }));
  back.querySelectorAll('[data-team]').forEach(b => b.addEventListener('click', () => {
    const t = (o.teamItems || []).find(x => x.id === b.dataset.team); if (!t) return;
    o.items.push(Object.assign(layoutOf(t), {id: uid(), cfg: JSON.parse(JSON.stringify(t.cfg || {})), from: t.id}));
    o.onItems && o.onItems(o.items); added(b); b.disabled = true;
  }));
  document.addEventListener('keydown', function esc_(e){ if (e.key === 'Escape'){ document.removeEventListener('keydown', esc_); if (back.isConnected) close(); } });
}

/* Public API: the client report page uses the same board. */
window.EdgeReports = {renderBoard, rangeOf, kwRows, gbpSummary, W, PERIODS, CLIENT_PERIODS_DEFAULT, validPeriod, favUrl};

/* ==========================================================================
   SEO TOOL TABS
   ========================================================================== */
if (typeof state === 'undefined' || !document.getElementById('seoModes')) return;

const TABS = [['rteam', 'Team report', 'Everything tracked for this client, customizable, every number clickable'],
  ['rclient', 'Client report', 'What the client sees: widgets sent from the team report, plus text and embedded pages']];
let activeTab = null, loadedFor = null;
const dataCache = {};   /* per client domain: {feed, g4:{range: promise}, gsc:{range: promise}} */

function client(){ return (state.seoClients || []).find(c => c.id === state.activeSeoClientId) || null; }
/* A client's layouts. Nothing is written to the client record until someone
   changes a layout, so 40+ untouched clients don't each carry a copy of the
   default team report. Default widgets have fixed ids ("d_<type>"), so a
   widget sent to the client report still points at its source afterwards. */
const teamDefault = () => TEAM_DEFAULT.map(d => ({id: 'd_' + d[0], type: d[0], size: d[1]}));
const liveR = {};
function reportsOf(c){
  const stored = c.reports || null;
  const r = liveR[c.id];
  if (r && r.src === stored) return r;
  return liveR[c.id] = {src: stored,
    team: stored && stored.team ? JSON.parse(JSON.stringify(stored.team)) : {period: '30', items: teamDefault()},
    client: stored && stored.client ? JSON.parse(JSON.stringify(stored.client)) : {period: 'lastMonth', items: []}};
}
/* Writes one layout back to the client record (cfg left out when empty). */
function persist(c, which){
  const R = reportsOf(c);
  const clean = b => Object.assign({}, b, {items: b.items.map(i => { const o = layoutOf(i); if (i.cfg && Object.keys(i.cfg).length) o.cfg = i.cfg; if (i.from) o.from = i.from; return o; })});
  const next = Object.assign({}, c.reports || {});
  (which ? [which] : ['team', 'client']).forEach(k => { next[k] = clean(R[k]); });
  c.reports = next; R.src = next;
  try{ if (typeof save === 'function') save(); }catch(e){ console.warn(e); }
}

function view(id){
  let v = document.getElementById('seoview-' + id);
  if (!v){
    const anchor = document.getElementById('seoview-ai') || document.getElementById('seoview-embed') || document.getElementById('seoview-keywords');
    if (!anchor) return null;
    v = document.createElement('div');
    v.className = 'seo-view'; v.id = 'seoview-' + id;
    anchor.parentNode.insertBefore(v, anchor.nextSibling);
  }
  return v;
}
function placeButtons(){
  const nav = document.getElementById('seoModes');
  if (!nav) return;
  let after = nav.querySelector('[data-seoview="ai"]') || nav.querySelector('[data-seoview="keywords"]');
  if (!after) return;
  TABS.forEach(([id, label, title]) => {
    let b = nav.querySelector('[data-seoview="' + id + '"]');
    if (!b){
      b = document.createElement('button');
      b.type = 'button'; b.className = 'seo-mode'; b.dataset.seoview = id; b.textContent = label; b.title = title;
    }
    if (after.nextSibling !== b) after.after(b);
    b.classList.toggle('on', activeTab === id);
    after = b;
  });
  if (activeTab) nav.querySelectorAll('.seo-mode').forEach(x => { if (x.dataset.seoview !== activeTab) x.classList.remove('on'); });
}
function show(id){
  activeTab = id;
  TABS.forEach(([t]) => { const v = view(t); if (v) v.classList.toggle('on', t === id); });
  if (!id) U.closeDrawer();
  placeButtons();
  if (id) draw();
}
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('#seoModes .seo-mode, .seo-mode[data-seoview]');
  if (!btn || !btn.dataset.seoview) return;
  const id = btn.dataset.seoview;
  show(TABS.some(t => t[0] === id) ? id : null);
});
new MutationObserver(() => {
  placeButtons();
  const c = client();
  if (activeTab && (c ? c.id : null) !== loadedFor){ U.closeDrawer(); draw(); }
}).observe(document.getElementById('seoModes'), {childList: true});
/* The AI Visibility module adds its tab button after this file may have run. */
setTimeout(placeButtons, 0); setTimeout(placeButtons, 1500);

/* ---------- data loaders for one client ---------- */
function ctxFor(c){
  const domain = AIV.normDomain(c.website || '');
  const s = AIV.tracker ? AIV.tracker() : {};
  const dc = dataCache[domain] = dataCache[domain] || {g4: {}, gsc: {}, at: Date.now()};
  if (Date.now() - dc.at > 15 * 60 * 1000){ dataCache[domain] = {g4: {}, gsc: {}, at: Date.now()}; return ctxFor(c); }
  const ctx = {domain};
  const noTracker = () => Promise.reject(new Error('Connect the AI Visibility Tracker first (AI Visibility tab, ⚙).'));
  const noSite = () => Promise.reject(new Error('Add this client’s website on the Dashboard tab first.'));
  ctx.get = name => {
    if (name === 'kw') return Promise.resolve(kwRows(c));
    if (name === 'gbp') return Promise.resolve(gbpSummary(gbpsFor(c)));
    if (domain.indexOf('.') < 0) return noSite();
    if (!s.url || !s.key) return noTracker();
    if (name === 'feed') return dc.feed || (dc.feed = AIV.getFeed(domain).catch(e => { dc.feed = null; throw e; }));
    const R = ctx.R;
    if (name === 'g4'){
      const k = R.prevSince + '|' + R.end;
      return dc.g4[k] || (dc.g4[k] = AIV.apiGet(s.url, {action: 'ga4report', domain, key: s.key, start: R.prevSince, end: R.end}).catch(e => { delete dc.g4[k]; throw e; }));
    }
    if (name === 'gsc'){
      const k = R.since + '|' + R.end;
      return dc.gsc[k] || (dc.gsc[k] = AIV.apiGet(s.url, {action: 'gscQueries', domain, key: s.key, start: R.since, end: R.end}).catch(e => { delete dc.gsc[k]; throw e; }));
    }
    return Promise.reject(new Error('Unknown data source ' + name));
  };
  ctx.loadJourneys = (since, end) => AIV.apiGet(s.url, {action: 'journeys', domain, key: s.key, start: since, end});
  return ctx;
}
/* GBP Tracker profiles for this SEO client: same name, or a profile whose website is this domain. */
function gbpsFor(c){
  const nm = String(c.name || '').trim().toLowerCase(), dom = AIV.normDomain(c.website || '');
  const out = [];
  (state.clients || []).forEach(g => (g.gbps || []).forEach(p => {
    const same = String(g.name || '').trim().toLowerCase() === nm || (dom && AIV.normDomain(p.website || '') === dom);
    if (same) out.push(p);
  }));
  return out;
}

/* ---------- drawing ---------- */
const editingState = {rteam: false, rclient: false};
const panelOpen = {rteam: '', rclient: ''};
/* The client's own logo for a report header, and the agency logo. */
function logosFor(c, board){
  const lg = (board.brand && board.brand.logo) || 'auto';
  const dom = AIV.normDomain(c.website || ''), site = dom.indexOf('.') > -1 ? favUrl(dom, 128) : '';
  const cl = lg === 'auto' ? ((c.logoUrl || '').trim() || site) : lg === 'site' ? site : lg === 'none' ? '' : lg;
  return {clientLogo: cl, agencyLogo: window.EDGE_LOGO || '', clientName: c.name || dom};
}
/* Periods the client may switch between, and the one the report opens on. */
const clientPeriods = R => { const p = (R.client.periods || CLIENT_PERIODS_DEFAULT).filter(validPeriod); return p.length ? p : ['lastMonth']; };
const clientPeriod = R => { const ps = clientPeriods(R); return ps.indexOf(String(R.client.period)) > -1 ? String(R.client.period) : ps[0]; };
function periodNote(R){
  const ps = clientPeriods(R), lbl = k => (PERIODS.find(x => x[0] === k) || [0, k])[1];
  const first = lbl(clientPeriod(R));
  return ps.length > 1
    ? 'The client opens this report on <b>' + esc(first) + '</b> and can switch between: ' + ps.map(k => esc(lbl(k))).join(', ') + '. Change this under <b>Date ranges</b>.'
    : 'The period is locked to <b>' + esc(first) + '</b>: the client can’t change it. Change this under <b>Date ranges</b>.';
}
function datePanel(host, c, R){
  if (host.innerHTML){ host.innerHTML = ''; panelOpen.rclient = ''; return; }
  panelOpen.rclient = 'dates';
  const ps = clientPeriods(R), cur = clientPeriod(R);
  host.innerHTML = '<div class="rp-panel aiv"><h4>' + glyph('lock', 16) + 'Date ranges the client can use</h4>' +
    '<div class="aiv-cap">Only the periods ticked here appear on the shared report. Tick one to lock the report to that period.</div>' +
    '<div class="row"><span class="lbl">Client can switch between</span>' + PERIODS.map(p => '<label class="rp-chipx' + (ps.indexOf(p[0]) > -1 ? ' on' : '') + '"><input type="checkbox" value="' + p[0] + '"' + (ps.indexOf(p[0]) > -1 ? ' checked' : '') + '>' + esc(p[1]) + '</label>').join('') + '</div>' +
    '<div class="row"><span class="lbl">Opens on</span><select data-first>' + ps.map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc((PERIODS.find(x => x[0] === k) || [0, k])[1]) + '</option>').join('') + '</select>' +
      '<label class="rp-chipx' + (R.client.showDates !== false ? ' on' : '') + '" style="margin-left:12px"><input type="checkbox" data-dates' + (R.client.showDates !== false ? ' checked' : '') + '>Show the exact dates under the title</label></div>' +
    '<div class="row" style="justify-content:flex-end"><button class="aiv-btn" type="button" data-close>Close</button></div></div>';
  const P = host.firstChild;
  const done = () => { persist(c, 'client'); autoPublish(c); draw(); };
  P.querySelectorAll('input[type=checkbox][value]').forEach(cb => cb.addEventListener('change', () => {
    const next = Array.from(P.querySelectorAll('input[type=checkbox][value]:checked')).map(x => x.value);
    if (!next.length){ cb.checked = true; toastMsg('Keep at least one period'); return; }
    R.client.periods = PERIODS.map(x => x[0]).filter(k => next.indexOf(k) > -1);
    if (R.client.periods.indexOf(String(R.client.period)) < 0) R.client.period = R.client.periods[0];
    done();
  }));
  P.querySelector('[data-first]').addEventListener('change', e => { R.client.period = e.target.value; done(); });
  P.querySelector('[data-dates]').addEventListener('change', e => { if (e.target.checked) delete R.client.showDates; else R.client.showDates = false; done(); });
  P.querySelector('[data-close]').addEventListener('click', () => { host.innerHTML = ''; panelOpen.rclient = ''; });
}
function draw(){
  const id = activeTab, v = view(id), c = client();
  loadedFor = c ? c.id : null;
  if (!v) return;
  if (!c){ AIV.renderMessage(v, 'No client selected', 'Pick an SEO client on the left.'); return; }
  const R = reportsOf(c);
  const ctx = ctxFor(c);
  if (id === 'rteam'){
    const clientFrom = new Set(R.client.items.map(x => x.from).filter(Boolean));
    renderBoard(v, Object.assign({mode: 'team', title: (c.name || ctx.domain) + ' — Team report', sub: esc(ctx.domain) + ' · internal', items: R.team.items, period: validPeriod(R.team.period) ? R.team.period : '30', ctx,
      editable: true, startEditing: editingState.rteam, onEditing: e => { editingState.rteam = e; },
      pushed: clientFrom, brand: R.team.brand,
      onBrand: b => { R.team.brand = b; persist(c, 'team'); panelOpen.rteam = 'brand'; draw(); },
      onItems: () => persist(c, 'team'),
      onPeriod: p => { R.team.period = p; persist(c, 'team'); draw(); },
      onPush: it => {
        const ex = R.client.items.findIndex(x => x.from === it.id);
        if (ex > -1){ R.client.items.splice(ex, 1); toastMsg('Removed from the client report'); }
        else { R.client.items.push(Object.assign(layoutOf(it), {id: uid(), cfg: JSON.parse(JSON.stringify(it.cfg || {})), from: it.id})); toastMsg('Added to the client report'); }
        persist(c, 'client'); autoPublish(c); draw();
      },
      actionsHtml: '<button class="aiv-btn" type="button" data-reset title="Put back the default set of widgets">Reset layout</button>'}, logosFor(c, R.team)));
    const rs = v.querySelector('[data-reset]');
    if (rs) rs.addEventListener('click', () => {
      if (!confirm('Put the team report back to the default widgets? Your changes to this layout will be lost. The client report is not affected.')) return;
      R.team.items = teamDefault(); persist(c, 'team'); draw();
    });
    if (panelOpen.rteam === 'brand' && editingState.rteam){ const b = v.querySelector('[data-brand]'); if (b) b.click(); }
    panelOpen.rteam = '';
  } else {
    const pub = R.client.publishedAt;
    renderBoard(v, Object.assign({mode: 'client', title: R.client.title || ((c.name || ctx.domain) + ' — Report'), sub: pub ? 'Shared · updates automatically' : 'Not shared yet', items: R.client.items, period: clientPeriod(R), ctx,
      editable: true, startEditing: editingState.rclient, onEditing: e => { editingState.rclient = e; },
      teamItems: R.team.items, periods: clientPeriods(R), showDates: R.client.showDates !== false, lockNote: true, brand: R.client.brand,
      onBrand: b => { R.client.brand = b; persist(c, 'client'); autoPublish(c); panelOpen.rclient = 'brand'; draw(); },
      emptyHtml: '<h3>This client report is empty</h3><div>Open the <b>Team report</b> and click <b>→ Client report</b> on any widget to send it here,<br>or add widgets, text and embedded pages here.</div>' +
        '<div style="margin-top:14px"><button class="aiv-btn go" type="button" data-empty-add>+ Add widgets</button></div>',
      onItems: () => { persist(c, 'client'); autoPublish(c); },
      onPeriod: p => { if (clientPeriods(R).indexOf(p) < 0) return; R.client.period = p; persist(c, 'client'); autoPublish(c); draw(); },
      actionsHtml: '<button class="aiv-btn" type="button" data-dates style="display:inline-flex;align-items:center;gap:6px">' + glyph('cal', 14) + 'Date ranges</button>' +
        '<button class="aiv-btn" type="button" data-title>Rename</button><button class="aiv-btn go" type="button" data-share>' + (pub ? 'Share link' : 'Share report') + '</button>',
      topHtml: '<div data-sharebox></div><div data-datebox></div><div class="aiv-note">' + periodNote(R) + ' Widgets here are copies: moving or resizing them doesn’t change the team report.</div>'}, logosFor(c, R.client)));
    v.querySelector('[data-share]').addEventListener('click', () => share(v, c));
    v.querySelector('[data-dates]').addEventListener('click', () => datePanel(v.querySelector('[data-datebox]'), c, R));
    v.querySelector('[data-title]').addEventListener('click', () => {
      const t = prompt('Report title the client sees:', R.client.title || ((c.name || ctx.domain) + ' — Report'));
      if (t == null) return; R.client.title = t.trim(); persist(c, 'client'); autoPublish(c); draw();
    });
    if (panelOpen.rclient === 'dates') { panelOpen.rclient = ''; datePanel(v.querySelector('[data-datebox]'), c, R); }
    else if (panelOpen.rclient === 'brand'){ panelOpen.rclient = ''; if (editingState.rclient){ const b = v.querySelector('[data-brand]'); if (b) b.click(); } }
  }
}
function toastMsg(m){ try{ if (typeof toast === 'function') toast(m); }catch(e){} }

/* ---------- publishing the client report ---------- */
const reportId = c => 'clientreport-' + c.id;
const reportUrl = c => location.origin + location.pathname.replace(/[^\/]*$/, '') + 'client-report.html?r=' + encodeURIComponent(reportId(c));
const embedCode = url => '<iframe src="' + url + '" style="width:100%;height:2200px;border:0" loading="lazy" title="Report"></iframe>';

/* What the public page needs to draw at once: the layout and a copy of the data. Live numbers follow via the token. */
async function buildDoc(c){
  const R = reportsOf(c), ctx = ctxFor(c);
  ctx.R = rangeOf(clientPeriod(R));
  const need = new Set(); R.client.items.forEach(it => ((W[it.type] && W[it.type].needs) || []).forEach(n => need.add(n)));
  const s = AIV.tracker();
  const doc = {type: 'clientreport', clientName: c.name || ctx.domain, domain: ctx.domain, title: R.client.title || ((c.name || ctx.domain) + ' — Report'),
    period: clientPeriod(R), periods: clientPeriods(R), showDates: R.client.showDates !== false,
    layout: JSON.stringify(R.client.items.map(i => Object.assign(layoutOf(i), {cfg: i.cfg || {}}))), updatedAt: Date.now(),
    feedUrl: s.url || ''};
  /* Branding travels with the report; keyword and map grids are stored on their own so they show even when the data copy is too big to keep. */
  const lg = logosFor(c, R.client), br = R.client.brand || {};
  doc.brand = JSON.stringify({agency: br.agency !== false, accent: br.accent || '', banner: !!br.banner, logoH: Number(br.logoH) || 44});
  if (lg.clientLogo && lg.clientLogo.length < 200000) doc.clientLogo = lg.clientLogo;
  if (br.agency !== false && lg.agencyLogo && lg.agencyLogo.length < 200000) doc.agencyLogo = lg.agencyLogo;
  const token = await AIV.tokenFor(ctx.domain).catch(() => null);
  if (token) doc.token = token;
  const snap = {at: Date.now(), period: clientPeriod(R)};
  const get = n => ctx.get(n).then(v => v, () => null);
  if (need.has('feed')) snap.feed = await get('feed');
  if (need.has('g4')) snap.g4 = await get('g4');
  if (need.has('gsc')){ const g = await get('gsc'); if (g){ snap.gsc = Object.assign({}, g, {queries: (g.queries || []).slice().sort((a, b) => b[2] - a[2]).slice(0, 400), pages: (g.pages || []).slice(0, 60)}); } }
  if (need.has('kw')) doc.kw = JSON.stringify(kwRows(c));
  if (need.has('gbp')) doc.gbp = JSON.stringify(gbpSummary(gbpsFor(c)));
  /* Firestore keeps up to 1 MB per document: the data copy gets what the rest leaves. */
  const room = 960000 - ['kw', 'gbp', 'clientLogo', 'agencyLogo', 'layout', 'brand'].reduce((t, k) => t + String(doc[k] || '').length, 0);
  let str = JSON.stringify(snap);
  if (str.length > room && snap.feed){ delete snap.feed.channels; str = JSON.stringify(snap); }
  if (str.length > room && snap.gsc){ snap.gsc.queries = snap.gsc.queries.slice(0, 100); str = JSON.stringify(snap); }
  if (str.length <= room) doc.snap = str;
  return doc;
}
async function publish(c){
  if (typeof fbDb === 'undefined' || !fbDb) throw new Error('Not connected to the cloud.');
  const doc = await buildDoc(c);
  await fbDb.collection('publicViews').doc(reportId(c)).set(doc);
  const R = reportsOf(c); R.client.publishedAt = Date.now(); persist(c, 'client');
}
const pubTimers = {};
function autoPublish(c){
  const R = reportsOf(c);
  if (!R.client.publishedAt) return;
  clearTimeout(pubTimers[c.id]);
  pubTimers[c.id] = setTimeout(() => publish(c).catch(e => console.warn('client report publish', e)), 2500);
}
async function share(v, c){
  const box = v.querySelector('[data-sharebox]');
  box.innerHTML = '<div class="rp-share"><span><span class="aiv-spin"></span>Publishing…</span></div>';
  try{
    await publish(c);
    const url = reportUrl(c);
    box.innerHTML = '<div class="rp-share"><label class="aiv-cap"><b>Report link</b></label><input readonly value="' + esc(url) + '">' +
      '<label class="aiv-cap"><b>Embed code</b> (AgencyAnalytics, a website…)</label><textarea readonly rows="2">' + esc(embedCode(url)) + '</textarea>' +
      '<div class="aiv-actions"><button class="aiv-btn" type="button" data-copy="l">Copy link</button><button class="aiv-btn" type="button" data-copy="e">Copy embed code</button>' +
      '<a class="aiv-btn" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a><span class="aiv-status">Changes you make here update the shared report automatically.</span></div></div>';
    box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.copy === 'l' ? url : embedCode(url);
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { const o = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = o; }, 1400); },
        () => box.querySelector(b.dataset.copy === 'l' ? 'input' : 'textarea').select());
    }));
    const sub = v.querySelector('.rp-sub'); if (sub && !/Shared/.test(sub.textContent)) sub.textContent = sub.textContent.replace('Not shared yet', 'Shared · updates automatically');
  }catch(err){
    box.innerHTML = '<div class="rp-share"><span class="aiv-status err">Couldn’t publish: ' + esc(err.message) + '</span></div>';
  }
}

})();
