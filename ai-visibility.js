/* ==========================================================================
   AI VISIBILITY

   The "AI Visibility" tab for each SEO client (internal, everything clickable)
   and the renderer for the shared client report (ai-report.html, visual only,
   styled to sit inside an AgencyAnalytics report).

   Data comes from the AI Visibility Tracker (Google Sheet + Apps Script web app):
     GA4            visits from ChatGPT, Perplexity, Gemini, Copilot... with landing
                    page and key events; plus Organic Search and Direct for context
     Search Console Generative AI impressions (AI Overviews / AI Mode), daily + pages
     Bing WMT       Copilot citations, pages and grounding queries
     AI Overviews   the real Google results page for each tracked keyword + location:
                    was there an AI Overview, did it cite / name the client

   AI assistants do not pass on what a person typed, so a visit from ChatGPT
   arrives with only its source and landing page. The drill-downs say so rather
   than inventing prompts. Google and Bing do expose queries, and those are shown.

   This file lives outside index.html. It reads the app's shared globals (state,
   save, fbDb) and attaches to the tab strip from outside, so the main app only
   needs the one <script> line that loads it.
   ========================================================================== */
(function(){
'use strict';

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = n => (Number(n) || 0).toLocaleString('en-CA');
const fmtK = n => { n = Number(n) || 0; return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : fmt(n); };
const pctTxt = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const normDomain = v => String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#:]/)[0];
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
const isoDay = d => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return isoDay(t); };
const today = () => isoDay(new Date(Date.now() - 6 * 3600 * 1000));
const prettyDate = d => {
  if (!d) return '';
  const t = new Date(d + 'T12:00:00');
  return isNaN(t) ? d : t.toLocaleDateString('en-CA', {month:'short', day:'numeric', year:'numeric'});
};
const shortDate = d => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-CA', {month:'short', day:'numeric'}); };
const shortUrl = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '') || '/';
/* One key for a page whether it came from GA4 (a path) or Search Console / Bing (a full URL). */
const pageKey = u => {
  let s = String(u || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\/[^\/]+/, '').split(/[?#]/)[0] || '/';
  if (s.length > 1) s = s.replace(/\/+$/, ''); if (s === '(not set)') return 'Landing page not recorded';
  return s || '/';
};

/* Platform colours: a fixed, colour-blind-validated order. Colour follows the
   platform, never its rank, and every mark carries a written label too. */
const PLATFORMS = ['ChatGPT', 'Perplexity', 'Gemini', 'Copilot', 'Claude', 'Meta AI', 'Grok', 'DeepSeek', 'Other AI'];
const PCOL = {ChatGPT:'#2a78d6', Perplexity:'#eb6834', Gemini:'#1baf7a', Copilot:'#eda100', Claude:'#e87ba4',
  'Meta AI':'#008300', Grok:'#6250d6', DeepSeek:'#e34948', 'Other AI':'#8795a1'};
const pcol = p => PCOL[p] || '#8795a1';
const CHCOL = {AI:'#eb6834', 'Organic Search':'#2a78d6', Direct:'#1baf7a'};
const NO_PROMPTS = {
  ChatGPT: 'ChatGPT does not pass on what people typed, so no tool can show the prompts. What it does pass on is which page each visitor landed on, and GA4 records what they did there.',
  Perplexity: 'Perplexity does not pass on what people asked. You can see where its visitors landed and what they did.',
  Gemini: 'The Gemini app does not pass on what people asked. You can see where its visitors landed and what they did. For Google Search itself, see Google AI.',
  Claude: 'Claude does not pass on what people asked. You can see where its visitors landed and what they did.',
  Copilot: 'Copilot visits arrive without the question. Bing Webmaster Tools reports the questions Copilot cited the site for (grounding queries), shown below when imported.'
};

/* ---------- styles ---------- */
function injectStyles(){
  if (document.getElementById('aivStyles')) return;
  const css = `
.aiv,.aiv-drawer{--a-brand:var(--brand,#e87722);--a-deep:var(--brand-deep,#b8570f);--a-wash:var(--brand-wash,#fdf1e6);
  --a-card:var(--card,#fff);--a-card2:var(--card-2,#f7f9fa);--a-line:var(--line,#e4e9ed);--a-line2:var(--line-2,#eef2f5);
  --a-ink:var(--ink,#1b222a);--a-ink2:var(--ink-2,#57646f);--a-ink3:var(--ink-3,#8b98a3);--a-good:var(--good,#0f7a58);
  --a-goodw:var(--good-wash,#e6f5ef);--a-bad:#b5352a;
  font-family:var(--ui,Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif);color:var(--a-ink);font-size:13px;}
.aiv *,.aiv-drawer *{box-sizing:border-box;}
.aiv-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:4px 0 18px;}
.aiv-title{font-family:var(--display,Poppins,Inter,sans-serif);font-size:22px;font-weight:600;letter-spacing:-.015em;margin:0;}
.aiv-sub{color:var(--a-ink2);font-size:12.5px;margin-top:4px;}
.aiv-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.aiv-btn{font:600 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--a-line);background:var(--a-card);color:var(--a-ink);
  border-radius:9px;padding:7px 12px;cursor:pointer;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}
.aiv-btn:hover{border-color:var(--a-brand);color:var(--a-deep);}
.aiv-btn.go{background:var(--a-brand);border-color:var(--a-brand);color:#fff;}
.aiv-btn.go:hover{background:var(--a-deep);color:#fff;}
.aiv-btn[disabled]{opacity:.55;cursor:default;}
.aiv-seg{display:inline-flex;background:var(--a-line2);border-radius:9px;padding:3px;}
.aiv-seg button{border:0;background:none;font:600 12px var(--ui,Inter,sans-serif);color:var(--a-ink2);padding:5px 10px;border-radius:7px;cursor:pointer;}
.aiv-seg button.on{background:var(--a-card);color:var(--a-deep);box-shadow:0 1px 2px rgba(20,28,36,.08);}
.aiv-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;}
.aiv-kpi{background:var(--a-card);border:1px solid var(--a-line);border-radius:16px;padding:16px 18px 12px;text-align:left;cursor:pointer;
  font:inherit;color:inherit;transition:border-color .15s,box-shadow .15s;position:relative;min-width:0;}
.aiv-kpi:hover{border-color:var(--a-brand);box-shadow:0 4px 14px -6px rgba(20,28,36,.18);}
.aiv-kpi.off{cursor:default;}
.aiv-kpi.off:hover{border-color:var(--a-line);box-shadow:none;}
.aiv-kpi-label{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-ink3);font-weight:700;}
.aiv-kpi-row{display:flex;align-items:baseline;gap:8px;margin:6px 0 2px;flex-wrap:wrap;}
.aiv-kpi-val{font-family:var(--display,Poppins,Inter,sans-serif);font-size:28px;font-weight:600;letter-spacing:-.02em;}
.aiv-kpi-note{font-size:11.5px;color:var(--a-ink2);min-height:16px;}
.aiv-kpi svg{display:block;width:100%;height:34px;margin-top:6px;}
.aiv-delta{font-size:11.5px;font-weight:700;border-radius:20px;padding:2px 7px;white-space:nowrap;}
.aiv-delta.up{background:var(--a-goodw);color:var(--a-good);}
.aiv-delta.down{background:#fbeceb;color:var(--a-bad);}
.aiv-delta.flat{background:var(--a-line2);color:var(--a-ink3);}
.aiv-card{background:var(--a-card);border:1px solid var(--a-line);border-radius:16px;padding:18px 20px;min-width:0;margin-bottom:16px;}
.aiv-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
.aiv-card h3{font-family:var(--display,Poppins,Inter,sans-serif);font-size:15px;font-weight:600;letter-spacing:-.01em;margin:0 0 3px;}
.aiv-cap{color:var(--a-ink2);font-size:12px;margin:0;}
.aiv-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;}
.aiv-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.aiv-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--a-line);background:var(--a-card);border-radius:20px;
  padding:4px 10px;font:600 11.5px var(--ui,Inter,sans-serif);color:var(--a-ink2);cursor:pointer;}
.aiv-chip i{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none;}
.aiv-chip.off{opacity:.45;}
.aiv-plats{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
.aiv-plat{border:1px solid var(--a-line);border-radius:14px;padding:14px 14px 10px 18px;background:var(--a-card);cursor:pointer;text-align:left;
  font:inherit;color:inherit;position:relative;overflow:hidden;transition:border-color .15s,box-shadow .15s;}
.aiv-plat:hover{border-color:var(--a-ink3);box-shadow:0 4px 14px -6px rgba(20,28,36,.18);}
.aiv-plat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc);}
.aiv-plat-name{font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:6px;}
.aiv-plat-big{font-family:var(--display,Poppins,Inter,sans-serif);font-size:22px;font-weight:600;margin:4px 0 2px;}
.aiv-plat-sub{font-size:11.5px;color:var(--a-ink2);}
.aiv-plat svg{display:block;width:100%;height:28px;margin-top:6px;}
.aiv-plat-go{font-size:11px;color:var(--a-ink3);font-weight:600;}
.aiv-chart{position:relative;}
.aiv-chart svg{display:block;max-width:100%;overflow:visible;}
.aiv-chart .ax{fill:var(--a-ink3,#8795a1);font-size:11px;font-family:var(--ui,Inter,sans-serif);}
.aiv-chart .gr{stroke:var(--a-line2,#edf1f4);stroke-width:1;}
.aiv-chart .aiv-hit{cursor:crosshair;}
.aiv-tip{position:absolute;pointer-events:none;background:#1b222a;color:#fff;border-radius:8px;padding:8px 10px;font-size:12px;
  box-shadow:0 8px 24px -8px rgba(0,0,0,.4);white-space:nowrap;z-index:5;display:none;}
.aiv-tip b{display:block;font-size:11px;color:#c9d1d8;font-weight:600;margin-bottom:4px;}
.aiv-tip div{display:flex;align-items:center;gap:6px;line-height:1.6;}
.aiv-tip i{width:8px;height:8px;border-radius:50%;display:inline-block;}
.aiv-tip span{margin-left:auto;padding-left:14px;font-variant-numeric:tabular-nums;font-weight:700;}
.aiv-empty{color:var(--a-ink3,#8795a1);font-size:12.5px;padding:18px 0;text-align:center;}
.aiv-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.aiv-table th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--a-ink3);font-weight:700;
  padding:8px 10px;border-bottom:1px solid var(--a-line);white-space:nowrap;cursor:pointer;user-select:none;}
.aiv-table th.sorted{color:var(--a-ink);}
.aiv-table td{padding:8px 10px;border-bottom:1px solid var(--a-line2);vertical-align:middle;}
.aiv-table td.num,.aiv-table th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.aiv-table tbody tr{cursor:pointer;}
.aiv-table tbody tr:hover td{background:var(--a-card2);}
.aiv-table tr:last-child td{border-bottom:0;}
.aiv-table a,.aiv-drawer a{color:var(--a-deep);text-decoration:none;}
.aiv-table a:hover,.aiv-drawer a:hover{text-decoration:underline;}
.aiv-page{word-break:break-all;color:var(--a-ink);}
.aiv-scroll{overflow-x:auto;max-height:440px;overflow-y:auto;}
.aiv-bar{height:6px;background:var(--a-line2,#edf1f4);border-radius:4px;overflow:hidden;min-width:60px;}
.aiv-bar i{display:block;height:100%;border-radius:4px;}
.aiv-pill{display:inline-block;font-size:10.5px;font-weight:700;border-radius:20px;padding:2px 8px;white-space:nowrap;}
.aiv-yes{background:var(--a-goodw);color:var(--a-good);}
.aiv-mid{background:var(--a-wash);color:var(--a-deep);}
.aiv-no{background:var(--a-line2);color:var(--a-ink3);}
.aiv-donut-wrap{display:flex;gap:20px;align-items:center;flex-wrap:wrap;}
.aiv-donut{width:150px;height:150px;flex:none;}
.aiv-donut path{cursor:pointer;transition:opacity .15s;}
.aiv-donut path.dim{opacity:.25;}
.aiv-legend{display:flex;flex-direction:column;gap:6px;flex:1;min-width:180px;}
.aiv-legend button{display:flex;align-items:center;gap:8px;border:0;background:none;font:500 12.5px var(--ui,Inter,sans-serif);color:var(--a-ink);
  cursor:pointer;padding:4px 6px;border-radius:7px;text-align:left;}
.aiv-legend button:hover,.aiv-legend button.sel{background:var(--a-card2);}
.aiv-legend i{width:10px;height:10px;border-radius:3px;flex:none;}
.aiv-legend span{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;}
.aiv-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.aiv-filters input,.aiv-form input{font:500 12.5px var(--ui,Inter,sans-serif);border:1px solid var(--a-line);
  border-radius:8px;padding:6px 9px;background:var(--a-card);color:var(--a-ink);}
.aiv-filters input{flex:1;min-width:160px;}
.aiv-note{font-size:12px;color:var(--a-ink2);background:var(--a-card);border:1px solid var(--a-line);border-left:3px solid var(--a-brand);border-radius:10px;padding:10px 12px;line-height:1.5;margin-bottom:14px;}
.aiv-msg{background:var(--a-card);border:1px solid var(--a-line);border-radius:16px;padding:28px;text-align:center;color:var(--a-ink2);}
.aiv-msg h3{font-family:var(--display,Poppins,Inter,sans-serif);color:var(--a-ink);margin:0 0 8px;font-size:17px;font-weight:600;}
.aiv-msg.err{border-color:#f0c9c4;}
.aiv-form{max-width:520px;margin:0 auto;text-align:left;}
.aiv-form label{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-ink3);font-weight:700;margin:14px 0 6px;}
.aiv-form input{width:100%;}
.aiv-form .aiv-actions{margin-top:16px;}
.aiv-share{background:var(--a-card2);border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;margin-bottom:16px;}
.aiv-share textarea,.aiv-share input{width:100%;font:12px var(--mono,Consolas,monospace);border:1px solid var(--a-line);border-radius:8px;padding:7px 9px;
  background:var(--a-card);color:var(--a-ink);resize:none;margin:4px 0 10px;}
.aiv-share label{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--a-ink3);font-weight:700;}
.aiv-status{font-size:12px;color:var(--a-ink2);}
.aiv-status.err{color:var(--a-bad);}
.aiv-spin{display:inline-block;width:14px;height:14px;border:2px solid var(--a-line);border-top-color:var(--a-brand);border-radius:50%;
  animation:aivspin .8s linear infinite;vertical-align:-2px;margin-right:6px;}
@keyframes aivspin{to{transform:rotate(360deg);}}
.aiv-foot{font-size:11.5px;color:var(--a-ink3);margin:4px 2px 0;}
.aiv-shade{position:fixed;inset:0;background:rgba(20,28,36,.32);z-index:9998;animation:aivfade .15s;}
.aiv-drawer{position:fixed;top:0;right:0;bottom:0;width:min(760px,100vw);background:var(--a-card2);z-index:9999;overflow-y:auto;
  box-shadow:-12px 0 40px -12px rgba(20,28,36,.35);animation:aivslide .2s cubic-bezier(.22,.8,.3,1);}
.aiv-drawer-head{position:sticky;top:0;background:var(--a-card);border-bottom:1px solid var(--a-line);padding:16px 20px;display:flex;align-items:center;gap:12px;z-index:6;}
.aiv-drawer-head h2{font-family:var(--display,Poppins,Inter,sans-serif);font-size:18px;font-weight:600;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.aiv-drawer-head .dot{width:12px;height:12px;border-radius:50%;flex:none;}
.aiv-drawer-body{padding:16px 20px 30px;}
.aiv-drawer .aiv-kpis{grid-template-columns:repeat(auto-fit,minmax(130px,1fr));}
.aiv-drawer .aiv-kpi{cursor:default;padding:12px 14px;}
.aiv-drawer .aiv-kpi:hover{border-color:var(--a-line);box-shadow:none;}
.aiv-drawer .aiv-kpi-val{font-size:22px;}
.aiv-x{border:0;background:var(--a-line2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;color:var(--a-ink2);flex:none;}
.aiv-back{border:0;background:none;color:var(--a-deep);font:600 12.5px var(--ui,Inter,sans-serif);cursor:pointer;padding:0;flex:none;}
@keyframes aivslide{from{transform:translateX(40px);opacity:0;}}
@keyframes aivfade{from{opacity:0;}}
@media (max-width:760px){.aiv-grid2{grid-template-columns:1fr !important;}}

/* ---------- shared report: AgencyAnalytics style ----------
   Sampled from the EDGE AgencyAnalytics reports: Geist, white widgets with a
   hairline #EBEDF0 border and 6px corners, sentence-case widget titles,
   bold #555 numerals, black lines and bars on grey tracks, AA donut colours. */
.aia{--aa-line:#EBEDF0;--aa-line-2:#F2F3F5;--aa-track:#E4E4E7;--aa-ink:#222A30;--aa-ink-2:#55606A;--aa-ink-3:#8A949C;--aa-num:#555555;--aa-black:#171614;
  --a-line2:#F0F0F0;--a-ink3:#6b7280;--a-ink:#222A30;
  font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;color:var(--aa-ink);font-size:13px;-webkit-font-smoothing:antialiased;}
.aia *{box-sizing:border-box;}
.aia .aiv-chart .ax,.aia svg text{font-family:inherit;}
.aia-panel{background:#fff;border:0.8px solid var(--aa-line);border-radius:6px;box-shadow:none;padding:14px 16px 16px;margin-bottom:12px;min-width:0;}
.aia-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.aia-title{font-family:inherit;font-size:20px;font-weight:600;letter-spacing:-.01em;margin:0;color:var(--aa-ink);}
.aia-sub{font-size:12.5px;color:var(--aa-ink-3);margin-top:2px;}
.aia-seg{display:inline-flex;border:1px solid var(--aa-track);border-radius:5px;overflow:hidden;}
.aia-seg button{border:0;border-left:1px solid var(--aa-track);background:#fff;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--aa-ink-2);padding:7px 12px;cursor:pointer;}
.aia-seg button:first-child{border-left:0;}
.aia-seg button.on{background:var(--aa-black);color:#fff;box-shadow:none;}
.aia-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:12px;}
.aia-kpi{background:#fff;border:0.8px solid var(--aa-line);border-radius:6px;box-shadow:none;
  padding:12px 16px 14px;text-align:center;display:flex;flex-direction:column;align-items:center;min-width:0;}
.aia-kpi-label{align-self:flex-start;font-size:14px;font-weight:500;letter-spacing:.01em;text-transform:none;color:var(--aa-ink);}
.aia-kpi-val{font-family:inherit;font-size:52px;line-height:1;font-weight:700;color:var(--aa-num);margin:22px 0 10px;letter-spacing:-.01em;}
.aia-kpi-delta{font-size:12.5px;font-weight:600;color:var(--aa-ink-3);}
.aia-kpi-delta.up{color:#2E8540;}
.aia-kpi-delta.down{color:#C0392B;}
.aia-kpi svg{display:block;width:100%;height:30px;margin-top:10px;}
.aia-panel-title{font-family:inherit;font-size:14px;font-weight:500;letter-spacing:.01em;text-transform:none;color:var(--aa-ink);margin:0;}
.aia-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
.aia-toggles{display:flex;gap:14px;flex-wrap:wrap;align-items:center;}
.aia-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--aa-ink-2);cursor:pointer;user-select:none;}
.aia-toggle input{position:absolute;opacity:0;pointer-events:none;}
.aia-toggle i{width:14px;height:14px;border-radius:3px;border:2px solid var(--c);display:inline-block;position:relative;}
.aia-toggle input:checked + i{background:var(--c);}
.aia-toggle input:checked + i::after{content:'';position:absolute;left:3px;top:0;width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg);}
.aia-toggle input:focus-visible + i{outline:2px solid var(--aa-ink);outline-offset:2px;}
.aia-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;}
.aia-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--aa-track);background:#fff;border-radius:5px;
  padding:5px 10px;font-family:inherit;font-size:12px;font-weight:500;color:var(--aa-ink-2);cursor:pointer;}
.aia-chip i{width:8px;height:8px;border-radius:50%;}
.aia-chip.sel{background:var(--aa-black);border-color:var(--aa-black);color:#fff;}
.aia-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;}
.aia-grid2 > .aia-panel{margin-bottom:0;}
.aia-row{margin-bottom:12px;}
.aia-ring{display:flex;align-items:center;gap:22px;flex-wrap:wrap;justify-content:center;}
.aia-ring svg{width:170px;height:170px;flex:none;}
.aia-ring-legend{display:flex;flex-direction:column;gap:7px;min-width:170px;}
.aia-ring-legend div{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--aa-ink-2);}
.aia-ring-legend i{width:9px;height:9px;border-radius:50%;flex:none;}
.aia-ring-legend span{margin-left:auto;font-weight:600;color:var(--aa-ink);padding-left:12px;}
.aia .aiv-bar{height:12px !important;background:var(--aa-track);border-radius:999px;}
.aia .aiv-bar i{border-radius:999px 0 0 999px;min-width:6px;}
.aia-empty{color:var(--aa-ink-3);font-size:13px;text-align:center;padding:30px 0;}
.aia-foot{text-align:center;font-size:11.5px;color:var(--aa-ink-3);margin-top:6px;}
@media (max-width:760px){.aia-grid2{grid-template-columns:1fr;}.aia-kpi-val{font-size:40px;}}
`;
  const st = document.createElement('style');
  st.id = 'aivStyles';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ==========================================================================
   CHARTS (plain SVG, no library)
   ========================================================================== */

/* Monotone cubic path: smooth, but never overshoots below zero or above a peak. */
function smoothPath(pts){
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return 'M' + pts[0][0] + ',' + pts[0][1];
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++){ dx[i] = pts[i+1][0] - pts[i][0]; dy[i] = pts[i+1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = (m[i-1] * m[i] <= 0) ? 0 : (m[i-1] + m[i]) / 2;
  t[n-1] = m[n-2];
  for (let i = 0; i < n - 1; i++){
    if (m[i] === 0){ t[i] = 0; t[i+1] = 0; continue; }
    const a = t[i] / m[i], b = t[i+1] / m[i], h = a * a + b * b;
    if (h > 9){ const s = 3 / Math.sqrt(h); t[i] = s * a * m[i]; t[i+1] = s * b * m[i]; }
  }
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++){
    const x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i+1][0], y1 = pts[i+1][1], h = dx[i] / 3;
    d += 'C' + (x0 + h).toFixed(1) + ',' + (y0 + t[i] * h).toFixed(1) + ' ' + (x1 - h).toFixed(1) + ',' + (y1 - t[i+1] * h).toFixed(1) + ' ' + x1.toFixed(1) + ',' + y1.toFixed(1);
  }
  return d;
}

function niceMax(v){
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/* Line chart with crosshair tooltip. series: [{name, color, values:[n], area?, dash?}], labels: [iso date]. */
function lineChart(host, cfg){
  const draw = () => {
    const W = Math.max(280, host.clientWidth || 640), H = cfg.height || 220;
    const padL = 40, padR = 12, padT = 10, padB = 26;
    const labels = cfg.labels, n = labels.length;
    const series = cfg.series.filter(s => s.values && s.values.length);
    host.innerHTML = '';
    if (!n || !series.length || !series.some(s => s.values.some(v => v))){
      host.innerHTML = '<div class="aiv-empty">' + esc(cfg.empty || 'Nothing recorded in this period yet.') + '</div>';
      return;
    }
    const max = niceMax(Math.max(...series.map(s => Math.max(...s.values.map(v => v || 0)))));
    const x = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
    const y = v => padT + (H - padT - padB) * (1 - v / max);
    let svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.label || 'chart') + '">';
    for (let g = 0; g <= 4; g++){
      const v = max * g / 4, yy = y(v);
      svg += '<line class="gr" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>';
      svg += '<text class="ax" x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(fmtK(Math.round(v * 10) / 10)) + '</text>';
    }
    const ticks = Math.min(6, n);
    for (let k = 0; k < ticks; k++){
      const i = Math.round(k * (n - 1) / Math.max(1, ticks - 1));
      svg += '<text class="ax" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle') + '">' + esc(shortDate(labels[i])) + '</text>';
    }
    series.forEach(s => {
      const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
      if (!pts.length) return;
      const path = smoothPath(pts);
      if (s.area){
        const gid = 'g' + Math.random().toString(36).slice(2, 8);
        svg += '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient></defs>';
        svg += '<path d="' + path + 'L' + pts[pts.length - 1][0] + ',' + y(0) + 'L' + pts[0][0] + ',' + y(0) + 'Z" fill="url(#' + gid + ')"/>';
      }
      svg += '<path d="' + path + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    });
    svg += '<line class="aiv-cross" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" stroke="#8795a1" stroke-width="1" style="display:none"/>';
    series.forEach((s, si) => { svg += '<circle class="aiv-dot" data-s="' + si + '" r="4" fill="' + s.color + '" stroke="#fff" stroke-width="2" style="display:none"/>'; });
    svg += '<rect x="' + padL + '" y="0" width="' + (W - padL - padR) + '" height="' + H + '" fill="transparent" class="aiv-hit"/></svg>';
    host.innerHTML = svg + '<div class="aiv-tip"></div>';
    const svgEl = host.querySelector('svg'), tip = host.querySelector('.aiv-tip'), cross = host.querySelector('.aiv-cross');
    const dots = [...host.querySelectorAll('.aiv-dot')];
    const hit = host.querySelector('.aiv-hit');
    const at = cx => { const r = svgEl.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round((cx - r.left - padL) / Math.max(1, (W - padL - padR)) * (n - 1)))); };
    const show = ev => {
      const i = at(ev.touches ? ev.touches[0].clientX : ev.clientX);
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
      dots.forEach((d, si) => { const v = series[si].values[i]; d.setAttribute('cx', x(i)); d.setAttribute('cy', y(v || 0)); d.style.display = v == null ? 'none' : ''; });
      tip.innerHTML = '<b>' + esc(cfg.weekly ? 'Week of ' + prettyDate(labels[i]) : prettyDate(labels[i])) + '</b>' +
        series.map(s => '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + '<span>' + (s.values[i] == null ? 'not reported yet' : fmt(s.values[i])) + '</span></div>').join('') +
        (cfg.onClick ? '<div style="color:#c9d1d8;font-size:10.5px;margin-top:2px">Click for detail</div>' : '');
      tip.style.display = 'block';
      const tw = tip.offsetWidth;
      let left = x(i) + 12; if (left + tw > W) left = x(i) - tw - 12;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = padT + 'px';
    };
    const hide = () => { tip.style.display = 'none'; cross.style.display = 'none'; dots.forEach(d => d.style.display = 'none'); };
    hit.addEventListener('mousemove', show); hit.addEventListener('touchstart', show, {passive: true});
    hit.addEventListener('mouseleave', hide);
    if (cfg.onClick) hit.addEventListener('click', ev => { const i = at(ev.clientX); cfg.onClick(labels[i], i); });
  };
  draw();
  if (window.ResizeObserver){
    let w = host.clientWidth, tmr = null;
    const ro = new ResizeObserver(() => { if (!host.isConnected){ ro.disconnect(); return; } if (Math.abs(host.clientWidth - w) < 8) return; w = host.clientWidth; clearTimeout(tmr); tmr = setTimeout(draw, 80); });
    ro.observe(host);
  }
}

function sparkline(values, color){
  if (!values || !values.length || !values.some(v => v)) return '<svg viewBox="0 0 100 30" preserveAspectRatio="none"></svg>';
  const max = Math.max(...values.map(v => v || 0)) || 1, n = values.length;
  const pts = values.map((v, i) => v == null ? null : [n === 1 ? 50 : i * 100 / (n - 1), 28 - (v / max) * 25]).filter(Boolean);
  const p = smoothPath(pts);
  return '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + p + 'L' + pts[pts.length - 1][0] + ',30L' + pts[0][0] + ',30Z" fill="' + color + '" opacity=".12"/>' +
    '<path d="' + p + '" fill="none" stroke="' + color + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
}

/* Donut. segs: [{key, label, n, color}]. */
function donut(segs, opts){
  const total = segs.reduce((t, s) => t + s.n, 0);
  const R = 70, r = 46, cx = 75, cy = 75;
  let a0 = -Math.PI / 2, out = '';
  const arc = (a, b) => {
    const large = b - a > Math.PI ? 1 : 0;
    const p = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x1, y1] = p(R, a), [x2, y2] = p(R, b), [x3, y3] = p(r, b), [x4, y4] = p(r, a);
    return 'M' + x1 + ',' + y1 + 'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + 'L' + x3 + ',' + y3 + 'A' + r + ',' + r + ' 0 ' + large + ' 0 ' + x4 + ',' + y4 + 'Z';
  };
  const live = segs.filter(s => s.n).length;
  segs.forEach(s => {
    if (!s.n) return;
    let a1 = a0 + (s.n / total) * Math.PI * 2;
    if (s.n === total) a1 = a0 + Math.PI * 2 - 0.0001;
    const gap = live > 1 ? 0.025 : 0;
    out += '<path data-k="' + esc(s.key) + '" d="' + arc(a0 + gap / 2, a1 - gap / 2) + '" fill="' + s.color + '"><title>' + esc(s.label) + ': ' + fmt(s.n) + '</title></path>';
    a0 = a1;
  });
  if (!total) out = '<circle cx="75" cy="75" r="58" fill="none" stroke="#edf1f4" stroke-width="24"/>';
  const center = opts && opts.center != null ? opts.center : fmt(total);
  return '<svg class="' + ((opts && opts.cls) || 'aiv-donut') + '" viewBox="0 0 150 150" role="img" aria-label="' + esc((opts && opts.sub) || 'breakdown') + '">' + out +
    '<text x="75" y="76" text-anchor="middle" style="font:600 22px var(--display,Poppins,Inter,sans-serif);fill:var(--aa-num,var(--a-ink,#1b222a))">' + esc(center) + '</text>' +
    '<text x="75" y="94" text-anchor="middle" style="font:600 9.5px var(--ui,Inter,sans-serif);letter-spacing:.08em;fill:var(--a-ink3,#8795a1)">' + esc(((opts && opts.sub) || '').toUpperCase()) + '</text></svg>';
}

/* ==========================================================================
   DATA MODEL: turns the tracker feed into what both views draw
   ========================================================================== */
function model(feed, period){ if (period === 'lastMonth'){ const t0 = new Date(); period = {since: isoDay(new Date(Date.UTC(t0.getFullYear(), t0.getMonth() - 1, 1, 12))), end: isoDay(new Date(Date.UTC(t0.getFullYear(), t0.getMonth(), 0, 12)))}; } const RANGE = (period && typeof period === 'object') ? period : null; if (RANGE) period = Math.round((Date.parse(RANGE.end + 'T12:00:00Z') - Date.parse(RANGE.since + 'T12:00:00Z')) / 86400000) + 1;
  const end = RANGE ? RANGE.end : addDays(today(), -1);
  const since = RANGE ? RANGE.since : addDays(end, -(period - 1));
  const prevEnd = addDays(since, -1), prevSince = addDays(prevEnd, -(period - 1));
  const inCur = d => d >= since && d <= end, inPrev = d => d >= prevSince && d <= prevEnd;
  const weekly = period > 35;
  const bucket = d => { if (!weekly) return d; const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return isoDay(t); };
  /* GA4 AI rows: [date, platform, source, page, sessions, engaged, key events] */
  let rows = (feed.ga4 && feed.ga4.rows) || null;
  if (!rows) rows = ((feed.ga4 && feed.ga4.daily) || []).map(r => [r.d, r.p, r.p, '', r.s, 0, r.k]);

  /* Charts start where tracking starts: before that nothing was recorded, which is not the same as zero.
     Weekly charts stop at the last complete week so an unfinished week doesn't read as a drop. */
  const firstOf = list => list.reduce((m, d) => (d && (!m || d < m)) ? d : m, '');
  const dataStart = firstOf(rows.map(r => r[0]).concat(((feed.channels && feed.channels.daily) || []).map(r => r.d)));
  const chartStart = dataStart && dataStart > since ? dataStart : since;
  const labels = [];
  let first = bucket(chartStart);
  if (weekly && first < chartStart && addDays(first, 7) <= end) first = addDays(first, 7);   /* skip a part-week at the start too */
  for (let d = first; d <= end; d = addDays(d, weekly ? 7 : 1)) labels.push(d);
  if (weekly && labels.length > 1 && addDays(labels[labels.length - 1], 6) > end) labels.pop();
  const idx = {}; labels.forEach((d, i) => { idx[d] = i; });
  const series = () => labels.map(() => 0);
  const slot = d => idx[bucket(d)];
  const cur = rows.filter(r => inCur(r[0])), prev = rows.filter(r => inPrev(r[0]));
  const sum = (rs, i) => rs.reduce((t, r) => t + (Number(r[i]) || 0), 0);

  const plat = {};
  const touch = p => plat[p] = plat[p] || {name: p, s: 0, e: 0, k: 0, ps: 0, pk: 0, series: series(), keySeries: series(), sources: {}};
  cur.forEach(r => {
    const o = touch(r[1]); o.s += r[4]; o.e += r[5]; o.k += r[6];
    const i = slot(r[0]); if (i != null){ o.series[i] += r[4]; o.keySeries[i] += r[6]; }
    o.sources[r[2]] = (o.sources[r[2]] || 0) + r[4];
  });
  prev.forEach(r => { const o = touch(r[1]); o.ps += r[4]; o.pk += r[6]; });
  const order = n => { const i = PLATFORMS.indexOf(n); return i < 0 ? 99 : i; };
  const platList = Object.values(plat).filter(o => o.s || o.ps).sort((a, b) => order(a.name) - order(b.name));

  const aiSeries = series(), aiKeySeries = series();
  cur.forEach(r => { const i = slot(r[0]); if (i != null){ aiSeries[i] += r[4]; aiKeySeries[i] += r[6]; } });

  /* Organic / Direct */
  const ch = {'Organic Search': {series: series(), s: 0, ps: 0}, Direct: {series: series(), s: 0, ps: 0}};
  const chDaily = (feed.channels && feed.channels.daily) || [];
  chDaily.forEach(r => {
    const o = ch[r.ch]; if (!o) return;
    if (inCur(r.d)){ o.s += r.s; const i = slot(r.d); if (i != null) o.series[i] += r.s; }
    else if (inPrev(r.d)) o.ps += r.s;
  });

  /* Google AI impressions (Search Console) */
  const up = feed.updated || {};
  const gSeries = series(); let gImp = 0, gPrev = 0;
  ((feed.google && feed.google.daily) || []).forEach(r => {
    if (inCur(r.d)){ gImp += r.n; const i = slot(r.d); if (i != null) gSeries[i] += r.n; }
    else if (inPrev(r.d)) gPrev += r.n;
  });
  const cutAfter = (arr, last) => { if (!last) return; labels.forEach((l, i) => { if (l > last) arr[i] = null; }); };
  const cutBefore = (arr, first) => { if (!first) return; labels.forEach((l, i) => { if (l < first) arr[i] = null; }); };
  cutAfter(gSeries, up.google && bucket(up.google));
  cutBefore(gSeries, bucket(firstOf(((feed.google && feed.google.daily) || []).map(r => r.d))));
  /* Copilot / Bing */
  const bSeries = series(); let bCit = 0, bPrev = 0;
  ((feed.bing && feed.bing.daily) || []).forEach(r => {
    if (inCur(r.d)){ bCit += r.n; const i = slot(r.d); if (i != null) bSeries[i] += r.n; }
    else if (inPrev(r.d)) bPrev += r.n;
  });

  cutAfter(bSeries, up.bing && bucket(up.bing));
  /* AI Overview checks: latest run for tiles and lists, every run for history */
  const aioAll = (feed.aio && feed.aio.checks) || [];
  const aioRun = aioAll.reduce((m, c) => c.d > m ? c.d : m, '');
  const seen = {};
  const aio = aioAll.filter(c => c.d === aioRun).filter(c => { const k = c.k + '|' + c.loc; if (seen[k]) return false; seen[k] = 1; return true; });
  const aioState = c => c.cited ? 'cited' : c.named ? 'named' : c.shown ? 'miss' : 'none';

  /* One page list joining GA4, Search Console, Bing and AI Overview citations */
  const pages = {};
  const pg = u => { const k = pageKey(u); return pages[k] = pages[k] || {key: k, u: u, s: 0, e: 0, k: 0, g: 0, b: 0, plats: {}, aio: 0}; };
  cur.forEach(r => { const o = pg(r[3]); o.s += r[4]; o.e += r[5]; o.k += r[6]; o.plats[r[1]] = (o.plats[r[1]] || 0) + r[4]; });
  ((feed.google && feed.google.pages) || []).forEach(r => { const o = pg(r.u); o.g += r.n; if (safeUrl(r.u)) o.u = r.u; });
  ((feed.bing && feed.bing.pages) || []).forEach(r => { const o = pg(r.u); o.b += r.n; if (safeUrl(r.u)) o.u = r.u; });
  aio.forEach(c => (c.urls || []).forEach(u => { const o = pg(u); o.aio++; if (safeUrl(u)) o.u = u; }));

  /* Key events by name: [date, platform, landing page, event name, count]. Older
     trackers don't send this list; `known` tells the views to say so. */
  const evAll = (feed.ga4 && feed.ga4.events) || null;
  const evCur = evAll ? evAll.filter(r => inCur(r[0]) && (Number(r[4]) || 0) > 0) : [];

  return {
    period, since, end, labels, weekly, cur, slot,
    keyEv: {known: !!evAll, rows: evCur},
    ai: {s: sum(cur, 4), e: sum(cur, 5), k: sum(cur, 6), ps: sum(prev, 4), pk: sum(prev, 6), series: aiSeries, keySeries: aiKeySeries,
      hasPrev: rows.some(r => r[0] < since)},
    plats: platList, channels: ch, hasChannels: chDaily.length > 0,
    google: {imported: !!up.google, n: gImp, prev: gPrev, series: gSeries, latest: up.google, pages: (feed.google && feed.google.pages) || []},
    bing: {imported: !!up.bing, n: bCit, prev: bPrev, series: bSeries, latest: up.bing, queries: (feed.bing && feed.bing.queries) || []},
    aio, aioAll, aioRun, aioState,
    pages: Object.values(pages).filter(p => p.s || p.g || p.b || p.aio)
  };
}

/* ---------- key events ----------
   GA4 names key events by their event name (generate_lead, form_submit…). The
   common ones get a plain-English label; anything custom is tidied up
   ("book_call_click" → "Book call click"). The internal views also show the
   raw name, so the team can match it to GA4. */
const KEY_EVENT_LABELS = {
  generate_lead: 'Lead submitted', form_submit: 'Form submitted', form_start: 'Form started',
  submit_lead_form: 'Lead form submitted', contact: 'Contact', contact_form: 'Contact form',
  phone_call: 'Phone call', phone_click: 'Phone number clicked', click_to_call: 'Phone number clicked', call_click: 'Phone number clicked',
  email_click: 'Email link clicked', mailto_click: 'Email link clicked', book_appointment: 'Appointment booked', schedule: 'Appointment booked',
  purchase: 'Purchase', begin_checkout: 'Checkout started', add_to_cart: 'Added to cart', sign_up: 'Sign-up', login: 'Login',
  file_download: 'File downloaded', qualify_lead: 'Lead qualified', close_convert_lead: 'Lead converted', working_lead: 'Lead in progress',
  get_directions: 'Directions requested', directions_click: 'Directions requested', whatsapp_click: 'WhatsApp clicked', chat_start: 'Chat started'
};
const keLabel = n => {
  const k = String(n || '').trim();
  if (KEY_EVENT_LABELS[k.toLowerCase()]) return KEY_EVENT_LABELS[k.toLowerCase()];
  const s = k.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Key event';
};
/* Groups event rows by name: [{name, label, n, plats: {name: n}, pages: {key: n}}], biggest first. */
function keyEventsOf(rows){
  const m = {};
  rows.forEach(r => {
    const n = Number(r[4]) || 0; if (!n) return;
    const o = m[r[3]] = m[r[3]] || {name: r[3], label: keLabel(r[3]), n: 0, plats: {}, pages: {}};
    o.n += n;
    o.plats[r[1]] = (o.plats[r[1]] || 0) + n;
    const pk = pageKey(r[2]); o.pages[pk] = (o.pages[pk] || 0) + n;
  });
  return Object.values(m).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}
const topOf = (obj, max) => Object.keys(obj).sort((a, b) => obj[b] - obj[a]).slice(0, max || 3);

function delta(cur, prev, hasPrev){
  if (!hasPrev || (!prev && !cur)) return {cls: 'flat', txt: ''};
  if (!prev) return {cls: 'up', txt: 'new'};
  const p = Math.round((cur - prev) / prev * 100);
  return {cls: p > 0 ? 'up' : p < 0 ? 'down' : 'flat', txt: (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '%'};
}
const periodName = p => p === 365 ? 'last 12 months' : 'last ' + p + ' days';
const linkTo = (domain, u) => {
  const s = safeUrl(u) || ('https://' + domain + (String(u || '/').charAt(0) === '/' ? '' : '/') + String(u || ''));
  return '<a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' + esc(shortUrl(s)) + ' ↗</a>';
};
const dotName = (name, color) => '<span style="display:inline-flex;align-items:center;gap:7px"><i style="width:9px;height:9px;border-radius:50%;background:' + color + ';display:inline-block"></i>' + esc(name) + '</span>';
const AIO_LBL = {cited: ['Cited', 'aiv-yes'], named: ['Named', 'aiv-yes'], miss: ['Not mentioned', 'aiv-mid'], none: ['No Overview', 'aiv-no']};

/* ==========================================================================
   DRAWER (internal drill-downs)
   ========================================================================== */
let drawerStack = [];
function openDrawer(title, color, build, isBack){
  document.querySelectorAll('.aiv-shade,.aiv-drawer').forEach(e => e.remove());
  if (!isBack) drawerStack.push({title, color, build});
  injectStyles();
  const shade = document.createElement('div'); shade.className = 'aiv-shade';
  const dr = document.createElement('div'); dr.className = 'aiv-drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', title);
  const back = drawerStack.length > 1 ? '<button class="aiv-back" type="button" data-back>← Back</button>' : '';
  dr.innerHTML = '<div class="aiv-drawer-head">' + back + (color ? '<span class="dot" style="background:' + color + '"></span>' : '') +
    '<h2>' + esc(title) + '</h2><button class="aiv-x" type="button" aria-label="Close">×</button></div><div class="aiv-drawer-body"></div>';
  document.body.appendChild(shade); document.body.appendChild(dr);
  shade.addEventListener('click', () => closeDrawer());
  dr.querySelector('.aiv-x').addEventListener('click', () => closeDrawer());
  const b = dr.querySelector('[data-back]');
  if (b) b.addEventListener('click', () => { drawerStack.pop(); const p = drawerStack[drawerStack.length - 1]; openDrawer(p.title, p.color, p.build, true); });
  build(dr.querySelector('.aiv-drawer-body'));
  dr.querySelector('.aiv-x').focus();
}
function closeDrawer(){
  document.querySelectorAll('.aiv-shade,.aiv-drawer').forEach(e => e.remove());
  drawerStack = [];
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.aiv-drawer')) closeDrawer(); });

/* Sortable, clickable table. cols: [{key, label, num, fmt(row), sort(row)}] */
function table(host, rows, cols, opts){
  opts = opts || {};
  let sortKey = opts.sort || (cols.find(c => c.num) || cols[0]).key, dir = opts.asc ? 1 : -1;
  const draw = () => {
    const col = cols.find(c => c.key === sortKey);
    const val = r => col.sort ? col.sort(r) : r[sortKey];
    const sorted = rows.slice().sort((a, b) => { const va = val(a), vb = val(b); return (va > vb ? 1 : va < vb ? -1 : 0) * dir; });
    if (!sorted.length){ host.innerHTML = '<div class="aiv-empty">' + esc(opts.empty || 'Nothing recorded yet.') + '</div>'; return; }
    host.innerHTML = '<div class="aiv-scroll"' + (opts.maxH ? ' style="max-height:' + opts.maxH + 'px"' : '') + '><table class="aiv-table"><thead><tr>' +
      cols.map(c => '<th data-k="' + c.key + '" class="' + (c.num ? 'num ' : '') + (c.key === sortKey ? 'sorted' : '') + '">' + esc(c.label) + (c.key === sortKey ? (dir < 0 ? ' ↓' : ' ↑') : '') + '</th>').join('') +
      '</tr></thead><tbody>' + sorted.slice(0, opts.limit || 300).map(r => '<tr data-i="' + rows.indexOf(r) + '"' + (opts.onRow ? ' tabindex="0"' : '') + '>' +
        cols.map(c => '<td' + (c.num ? ' class="num"' : '') + '>' + (c.fmt ? c.fmt(r) : esc(r[c.key])) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    host.querySelectorAll('th').forEach(th => th.addEventListener('click', () => { if (sortKey === th.dataset.k) dir = -dir; else { sortKey = th.dataset.k; dir = -1; } draw(); }));
    if (opts.onRow) host.querySelectorAll('tbody tr').forEach(tr => {
      const go = () => opts.onRow(rows[Number(tr.dataset.i)]);
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  };
  draw();
}
const barCell = (n, max, color) => '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><span>' + fmt(n) + '</span><div class="aiv-bar" style="width:70px"><i style="width:' + (max ? n / max * 100 : 0).toFixed(1) + '%;background:' + color + '"></i></div></div>';

/* ==========================================================================
   INTERNAL VIEW
   ========================================================================== */
function render(root, feed, opts){
  opts = opts || {};
  injectStyles();
  const period = opts.period || 30;
  const M = model(feed, period);
  const domain = feed.domain;

  const kpi = (id, label, val, d, note, spark, color, off) =>
    '<button type="button" class="aiv-kpi' + (off ? ' off' : '') + '" data-kpi="' + id + '"' + (off ? ' tabindex="-1" aria-disabled="true"' : '') + '>' +
      '<div class="aiv-kpi-label">' + esc(label) + '</div>' +
      '<div class="aiv-kpi-row"><span class="aiv-kpi-val">' + val + '</span>' + (d && d.txt ? '<span class="aiv-delta ' + d.cls + '">' + esc(d.txt) + '</span>' : '') + '</div>' +
      '<div class="aiv-kpi-note">' + note + '</div>' + (spark ? sparkline(spark, color) : '') + '</button>';

  const aioCited = M.aio.filter(c => c.cited).length, aioShown = M.aio.filter(c => c.shown).length;
  const kpis =
    kpi('visits', 'AI visits', fmt(M.ai.s), delta(M.ai.s, M.ai.ps, M.ai.hasPrev), 'Visitors sent by AI assistants', M.ai.series, '#eb6834') +
    kpi('keys', 'Key events from AI', fmt(M.ai.k), delta(M.ai.k, M.ai.pk, M.ai.hasPrev), (() => {
      const top = keyEventsOf(M.keyEv.rows);
      if (top.length) return esc(top[0].label) + (top[0].n > 1 ? ' ×' + top[0].n : '') + (top.length > 1 ? ' + ' + (top.length - 1) + ' more type' + (top.length > 2 ? 's' : '') : '');
      return M.ai.s ? 'From ' + fmt(M.ai.s) + ' AI visits' : 'Conversions by AI visitors';
    })(), M.ai.keySeries, '#2a78d6') +
    (M.google.imported
      ? kpi('google', 'Google AI impressions', fmt(M.google.n), delta(M.google.n, M.google.prev, M.google.prev > 0), 'AI Overviews &amp; AI Mode · to ' + esc(shortDate(M.google.latest)), M.google.series, '#1baf7a')
      : kpi('google', 'Google AI impressions', '—', null, 'Not imported yet. Needs Search Console access.', null, '', true)) +
    (M.aio.length
      ? kpi('aio', 'AI Overview citations', aioCited + '<small style="font-size:15px;color:var(--a-ink3)"> / ' + M.aio.length + '</small>', null,
          'Tracked searches citing the site · ' + aioShown + ' showed an Overview', null, '', false)
      : kpi('aio', 'AI Overview citations', '—', null, 'First check runs on the next weekly update', null, '', true)) +
    (M.bing.imported ? kpi('bing', 'Copilot citations', fmt(M.bing.n), delta(M.bing.n, M.bing.prev, M.bing.prev > 0), 'Bing Webmaster Tools · to ' + esc(shortDate(M.bing.latest)), M.bing.series, '#eda100') : '');

  const unit = t => ' <span style="font:600 12px var(--ui,Inter,sans-serif);color:var(--a-ink3)">' + t + '</span>';
  const platCards = M.plats.map(p => {
    const d = delta(p.s, p.ps, M.ai.hasPrev);
    return '<button type="button" class="aiv-plat" data-plat="' + esc(p.name) + '" style="--pc:' + pcol(p.name) + '">' +
      '<div class="aiv-plat-name">' + esc(p.name) + '<span class="aiv-plat-go">Details ›</span></div>' +
      '<div class="aiv-plat-big">' + fmt(p.s) + unit('visits') + (d.txt ? ' <span class="aiv-delta ' + d.cls + '" style="font-family:var(--ui,Inter,sans-serif)">' + esc(d.txt) + '</span>' : '') + '</div>' +
      '<div class="aiv-plat-sub">' + fmt(p.k) + ' key events · ' + pctTxt(p.e, p.s) + ' engaged</div>' + sparkline(p.series, pcol(p.name)) + '</button>';
  }).join('') +
    (M.google.imported || M.aio.length ? '<button type="button" class="aiv-plat" data-plat="__google" style="--pc:#1baf7a"><div class="aiv-plat-name">Google AI Search<span class="aiv-plat-go">Details ›</span></div>' +
      '<div class="aiv-plat-big">' + (M.google.imported ? fmt(M.google.n) + unit('impressions') : '—') + '</div>' +
      '<div class="aiv-plat-sub">' + (M.aio.length ? aioCited + ' of ' + M.aio.length + ' tracked searches cite the site' : 'AI Overviews &amp; AI Mode') + '</div>' + sparkline(M.google.series, '#1baf7a') + '</button>' : '') +
    (M.bing.imported ? '<button type="button" class="aiv-plat" data-plat="__bing" style="--pc:#eda100"><div class="aiv-plat-name">Copilot citations<span class="aiv-plat-go">Details ›</span></div>' +
      '<div class="aiv-plat-big">' + fmt(M.bing.n) + unit('citations') + '</div><div class="aiv-plat-sub">' + M.bing.queries.length + ' questions reported by Bing</div>' + sparkline(M.bing.series, '#eda100') + '</button>' : '');

  root.innerHTML =
    '<div class="aiv">' +
      '<div class="aiv-head"><div><h2 class="aiv-title">' + esc((feed.name || domain) + ' — AI visibility') + '</h2>' +
        '<div class="aiv-sub">' + esc(domain) + ' · ' + esc(prettyDate(M.since)) + ' – ' + esc(prettyDate(M.end)) + ' · click anything for detail</div></div>' +
        '<div class="aiv-actions"><div class="aiv-seg" data-period>' + [30, 90, 365].map(p => '<button type="button" data-p="' + p + '"' + (p === period ? ' class="on"' : '') + '>' + (p === 365 ? '12 months' : p + ' days') + '</button>').join('') + '</div>' +
        (opts.actionsHtml || '') + '</div></div>' +
      (opts.topHtml || '') +
      '<div class="aiv-kpis">' + kpis + '</div>' +
      '<section class="aiv-card"><div class="aiv-card-head"><div><h3>AI visits over time</h3><p class="aiv-cap">' + (M.weekly ? 'Weekly' : 'Daily') + ' AI visits. Click an assistant to add its own line, Organic or Direct to compare, or the chart to open that ' + (M.weekly ? 'week' : 'day') + '.</p></div>' +
        '<div class="aiv-chips" data-chips><button type="button" class="aiv-chip" data-all><i style="background:' + CHCOL.AI + '"></i>All AI</button>' +
          M.plats.map(p => '<button type="button" class="aiv-chip off" data-p="' + esc(p.name) + '"><i style="background:' + pcol(p.name) + '"></i>' + esc(p.name) + '</button>').join('') +
        (M.hasChannels ? '<span style="width:1px;height:18px;background:var(--a-line);margin:0 4px"></span>' +
          ['Organic Search', 'Direct'].map(c => '<button type="button" class="aiv-chip off" data-ch="' + c + '" title="Compare with ' + c + ' visits"><i style="background:' + CHCOL[c] + '"></i>' + c + '</button>').join('') : '') +
        '</div></div><div class="aiv-chart" data-main></div></section>' +
      '<section class="aiv-card"><div class="aiv-card-head"><div><h3>By source</h3><p class="aiv-cap">Click a card for its visits, landing pages, key events and what can be known about the questions behind them.</p></div></div>' +
        (platCards ? '<div class="aiv-plats">' + platCards + '</div>' : '<div class="aiv-empty">No AI visits in this period yet.</div>') + '</section>' +
      '<section class="aiv-card" data-aio-card><div class="aiv-card-head"><div><h3>Google AI Overviews for tracked keywords</h3><p class="aiv-cap">' +
        (M.aioRun ? 'The real Google results page for each tracked keyword and location, checked ' + esc(prettyDate(M.aioRun)) + '. Click a slice to filter, a row for detail.' : 'Checked weekly from each tracked keyword and location.') + '</p></div></div>' +
        '<div data-aio></div></section>' +
      '<section class="aiv-card"><div class="aiv-card-head"><div><h3>Pages AI uses</h3><p class="aiv-cap">Every page that got AI visits, Google AI impressions, Copilot citations or an AI Overview citation. Sort by any column; click a page for detail.</p></div></div>' +
        '<div class="aiv-filters"><input type="search" data-pf placeholder="Filter pages"></div><div data-pages></div>' +
        '<p class="aiv-foot">* Google AI impressions per page come from the newest Search Console export and cover everything since Google started recording (May 18, 2026).</p></section>' +
    '</div>';

  root.querySelectorAll('[data-period] button').forEach(b => b.addEventListener('click', () => { const k = b.dataset.p; if (k === 'custom'){ root.querySelectorAll('[data-period] button').forEach(x => x.classList.toggle('on', x === b)); const cu = root.querySelector('[data-custom]'); if (cu) cu.style.display = 'flex'; return; } if (opts.onPeriod) opts.onPeriod(k === 'lastMonth' ? 'lastMonth' : Number(k)); })); const applyBtn = root.querySelector('[data-apply]'); if (applyBtn) applyBtn.addEventListener('click', () => { const f = root.querySelector('[data-from]').value, t = root.querySelector('[data-to]').value; if (f && t && f <= t && opts.onPeriod) opts.onPeriod({since: f, end: t}); });

  root.querySelectorAll('[data-kpi]').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('off')) return;
    const k = b.dataset.kpi;
    if (k === 'visits' || k === 'keys') openAllAi(M, domain, k);
    if (k === 'google') openGoogle(M, domain);
    if (k === 'aio') root.querySelector('[data-aio-card]').scrollIntoView({behavior: 'smooth', block: 'start'});
    if (k === 'bing') openBing(M, domain);
  }));

  const shownP = {}, shownCh = {};
  let showAll = true;
  const drawMain = () => {
    const s = showAll ? [{name: 'All AI', color: CHCOL.AI, values: M.ai.series, area: true}] : [];
    M.plats.filter(p => shownP[p.name]).forEach(p => s.push({name: p.name, color: pcol(p.name), values: p.series}));
    ['Organic Search', 'Direct'].forEach(c => { if (shownCh[c]) s.push({name: c, color: CHCOL[c], values: M.channels[c].series, dash: true}); });
    lineChart(root.querySelector('[data-main]'), {labels: M.labels, series: s, weekly: M.weekly, height: 250, label: 'AI visits over time',
      empty: 'No AI visits in this period yet.', onClick: d => openDay(M, domain, d)});
  };
  root.querySelectorAll('[data-chips] [data-p]').forEach(b => b.addEventListener('click', () => { shownP[b.dataset.p] = !shownP[b.dataset.p]; b.classList.toggle('off', !shownP[b.dataset.p]); drawMain(); }));
  const allBtn = root.querySelector('[data-chips] [data-all]');
  if (allBtn) allBtn.addEventListener('click', () => { showAll = !showAll; allBtn.classList.toggle('off', !showAll); drawMain(); });
  root.querySelectorAll('[data-chips] [data-ch]').forEach(b => b.addEventListener('click', () => { shownCh[b.dataset.ch] = !shownCh[b.dataset.ch]; b.classList.toggle('off', !shownCh[b.dataset.ch]); drawMain(); }));
  drawMain();

  root.querySelectorAll('[data-plat]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.plat === '__google') openGoogle(M, domain);
    else if (b.dataset.plat === '__bing') openBing(M, domain);
    else openPlatform(M, domain, b.dataset.plat);
  }));

  drawAio(root.querySelector('[data-aio]'), M, domain, true);

  const pf = root.querySelector('[data-pf]');
  const drawPages = () => {
    const q = (pf.value || '').toLowerCase();
    const rows = M.pages.filter(p => !q || p.key.indexOf(q) > -1);
    const maxS = Math.max(1, ...rows.map(r => r.s)), maxG = Math.max(1, ...rows.map(r => r.g));
    table(root.querySelector('[data-pages]'), rows, [
      {key: 'key', label: 'Page', fmt: r => '<span class="aiv-page">' + esc(r.key) + '</span>', sort: r => r.key},
      {key: 's', label: 'AI visits', num: true, fmt: r => barCell(r.s, maxS, '#eb6834')},
      {key: 'k', label: 'Key events', num: true, fmt: r => fmt(r.k)},
      {key: 'g', label: 'Google AI impr.*', num: true, fmt: r => M.google.imported ? barCell(r.g, maxG, '#1baf7a') : '—'},
      {key: 'aio', label: 'AI Overview cites', num: true, fmt: r => fmt(r.aio)}
    ].concat(M.bing.imported ? [{key: 'b', label: 'Copilot cites*', num: true, fmt: r => fmt(r.b)}] : []),
    {sort: M.pages.some(p => p.s) ? 's' : 'g', empty: 'No pages recorded yet.', onRow: r => openPage(M, domain, r)});
  };
  pf.addEventListener('input', drawPages);
  drawPages();
}

function drawAio(host, M, domain, wide){
  if (!M.aio.length){ host.innerHTML = '<div class="aiv-empty">No AI Overview checks yet for this client.</div>'; return; }
  const segs = [
    {key: 'cited', label: 'Cited the site as a source', color: '#1baf7a'},
    {key: 'named', label: 'Named the business only', color: '#2a78d6'},
    {key: 'miss', label: 'AI Overview without the site', color: '#eb6834'},
    {key: 'none', label: 'No AI Overview shown', color: '#c9d1d8'}
  ].map(s => Object.assign(s, {n: M.aio.filter(c => M.aioState(c) === s.key).length}));
  let pick = null;
  host.innerHTML = '<div class="aiv-grid2" style="grid-template-columns:' + (wide ? 'minmax(0,340px) minmax(0,1fr)' : '1fr') + '"><div class="aiv-donut-wrap" data-d></div>' +
    '<div><div class="aiv-filters"><input type="search" data-q placeholder="Filter keywords or locations"></div><div data-t></div></div></div>';
  const dHost = host.querySelector('[data-d]'), q = host.querySelector('[data-q]');
  const drawDonut = () => {
    dHost.innerHTML = donut(segs, {center: segs[0].n + segs[1].n + ' / ' + M.aio.length, sub: 'mentioned'}) + '<div class="aiv-legend">' +
      segs.map(s => '<button type="button" data-k="' + s.key + '"' + (pick === s.key ? ' class="sel"' : '') + '><i style="background:' + s.color + '"></i>' + esc(s.label) + '<span>' + s.n + '</span></button>').join('') + '</div>';
    dHost.querySelectorAll('path').forEach(p => p.classList.toggle('dim', !!pick && p.dataset.k !== pick));
    const toggle = k => { pick = pick === k ? null : k; drawDonut(); drawRows(); };
    dHost.querySelectorAll('path').forEach(p => p.addEventListener('click', () => toggle(p.dataset.k)));
    dHost.querySelectorAll('.aiv-legend button').forEach(b => b.addEventListener('click', () => toggle(b.dataset.k)));
  };
  const drawRows = () => {
    const f = (q.value || '').toLowerCase();
    const rows = M.aio.filter(c => (!pick || M.aioState(c) === pick) && (!f || (c.k + ' ' + c.loc).toLowerCase().indexOf(f) > -1));
    table(host.querySelector('[data-t]'), rows, [
      {key: 'k', label: 'Keyword', fmt: r => esc(r.k), sort: r => r.k},
      {key: 'loc', label: 'Location', fmt: r => esc(r.loc || '—'), sort: r => r.loc},
      {key: 'st', label: 'Result', fmt: r => { const s = AIO_LBL[M.aioState(r)]; return '<span class="aiv-pill ' + s[1] + '">' + s[0] + '</span>'; },
        sort: r => ['none', 'miss', 'named', 'cited'].indexOf(M.aioState(r))},
      {key: 'u', label: 'Page cited', fmt: r => (r.urls || [])[0] ? '<span class="aiv-page">' + esc(pageKey(r.urls[0])) + '</span>' : '<span style="color:var(--a-ink3)">—</span>', sort: r => (r.urls || []).length}
    ], {sort: 'st', maxH: 360, empty: 'No searches match.', onRow: r => openKeyword(M, domain, r)});
  };
  q.addEventListener('input', drawRows);
  drawDonut(); drawRows();
}

/* ---------- drill-downs ---------- */
function statsRow(items){
  return '<div class="aiv-kpis">' + items.map(i => '<div class="aiv-kpi"><div class="aiv-kpi-label">' + esc(i[0]) + '</div><div class="aiv-kpi-row"><span class="aiv-kpi-val">' + i[1] + '</span></div>' +
    '<div class="aiv-kpi-note">' + (i[2] || '') + '</div></div>').join('') + '</div>';
}
function pagesOf(rows){
  const m = {};
  rows.forEach(r => { const k = pageKey(r[3]); const o = m[k] = m[k] || {key: k, u: r[3], s: 0, e: 0, k: 0}; o.s += r[4]; o.e += r[5]; o.k += r[6]; });
  return Object.values(m);
}
function pageTable(host, M, domain, rows, color){
  const max = Math.max(1, ...rows.map(r => r.s));
  table(host, rows, [
    {key: 'key', label: 'Landing page', fmt: r => '<span class="aiv-page">' + esc(r.key) + '</span>', sort: r => r.key},
    {key: 's', label: 'Visits', num: true, fmt: r => barCell(r.s, max, color)},
    {key: 'e', label: 'Engaged', num: true, fmt: r => fmt(r.e)},
    {key: 'k', label: 'Key events', num: true, fmt: r => fmt(r.k)}
  ], {sort: 's', empty: 'No visits in this period.', onRow: r => { const full = M.pages.find(p => p.key === r.key); if (full) openPage(M, domain, full); }});
}
/* "Which key events" card for the drill-downs. rows = M.keyEv.rows, already
   narrowed to the assistant / page / day the drawer is about. */
const keyEventCardHtml = (cap) => '<div class="aiv-card"><h3>Which key events</h3><p class="aiv-cap" style="margin-bottom:8px">' + cap + '</p><div data-ke></div></div>';
function keyEventTable(host, M, domain, rows, opts){
  opts = opts || {};
  if (!host) return;
  if (!M.keyEv.known){
    host.innerHTML = '<div class="aiv-empty">The tracker isn’t sending key event names yet, only the count. Once it does (tracker/key-events.gs in the repo), each one shows here by name.</div>';
    return;
  }
  const list = keyEventsOf(rows);
  const max = Math.max(1, ...list.map(e => e.n));
  const cols = [
    {key: 'label', label: 'Key event', fmt: r => '<b style="font-weight:600">' + esc(r.label) + '</b>' + (r.label !== r.name ? ' <span class="aiv-page" style="color:var(--a-ink3);font-size:11px">' + esc(r.name) + '</span>' : ''), sort: r => r.label},
    {key: 'n', label: 'Count', num: true, fmt: r => barCell(r.n, max, '#2a78d6')}
  ];
  if (!opts.noPlat) cols.push({key: 'pl', label: 'From', fmt: r => topOf(r.plats).map(p => dotName(p + ' ' + r.plats[p], pcol(p))).join(' &nbsp;'), sort: r => Object.keys(r.plats).length});
  if (!opts.noPage) cols.push({key: 'pg', label: 'Landing page', fmt: r => topOf(r.pages, 2).map(k => '<span class="aiv-page">' + esc(k) + '</span>' + (Object.keys(r.pages).length > 1 ? ' (' + r.pages[k] + ')' : '')).join('<br>') +
    (Object.keys(r.pages).length > 2 ? '<br><span style="color:var(--a-ink3)">+' + (Object.keys(r.pages).length - 2) + ' more</span>' : ''), sort: r => Object.keys(r.pages).length});
  table(host, list, cols, {sort: 'n', empty: 'No key events in this period.'});
}

function seriesFor(M, rows, col){
  const s = M.labels.map(() => 0);
  rows.forEach(r => { const i = M.slot(r[0]); if (i != null) s[i] += r[col]; });
  return s;
}

function openAllAi(M, domain, focus){
  openDrawer('All AI visits · ' + periodName(M.period), '#eb6834', body => {
    body.innerHTML = statsRow([['Visits', fmt(M.ai.s)], ['Engaged', fmt(M.ai.e), pctTxt(M.ai.e, M.ai.s) + ' engagement rate'], ['Key events', fmt(M.ai.k), 'From ' + fmt(M.ai.s) + ' visits']]) +
      '<div class="aiv-card"><h3>Visits and key events</h3><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' +
      keyEventCardHtml('What AI visitors did that counts as a key event in GA4, which assistant sent them and where they landed.') +
      '<div class="aiv-card"><h3>By assistant</h3><p class="aiv-cap" style="margin-bottom:10px">Click one for its detail.</p><div data-p></div></div>' +
      '<div class="aiv-card"><h3>Landing pages</h3><div data-pg style="margin-top:8px"></div></div>';
    lineChart(body.querySelector('[data-c]'), {labels: M.labels, weekly: M.weekly, height: 200,
      series: [{name: 'AI visits', color: '#eb6834', values: M.ai.series, area: focus !== 'keys'}, {name: 'Key events', color: '#2a78d6', values: M.ai.keySeries, area: focus === 'keys'}]});
    const max = Math.max(1, ...M.plats.map(p => p.s));
    table(body.querySelector('[data-p]'), M.plats, [
      {key: 'name', label: 'Assistant', fmt: r => dotName(r.name, pcol(r.name)), sort: r => r.name},
      {key: 's', label: 'Visits', num: true, fmt: r => barCell(r.s, max, pcol(r.name))},
      {key: 'e', label: 'Engaged', num: true, fmt: r => fmt(r.e)},
      {key: 'k', label: 'Key events', num: true, fmt: r => fmt(r.k)}
    ], {sort: focus === 'keys' ? 'k' : 's', onRow: r => openPlatform(M, domain, r.name)});
    keyEventTable(body.querySelector('[data-ke]'), M, domain, M.keyEv.rows);
    pageTable(body.querySelector('[data-pg]'), M, domain, pagesOf(M.cur), '#eb6834');
    const keCard = focus === 'keys' && body.querySelector('[data-ke]').closest('.aiv-card');
    if (keCard && keCard.scrollIntoView) keCard.scrollIntoView({block: 'start'});
  });
}

function openPlatform(M, domain, name){
  const p = M.plats.find(x => x.name === name);
  if (!p) return;
  const rows = M.cur.filter(r => r[1] === name);
  openDrawer(name + ' · ' + periodName(M.period), pcol(name), body => {
    const srcs = Object.keys(p.sources).sort((a, b) => p.sources[b] - p.sources[a]);
    const d = delta(p.s, p.ps, M.ai.hasPrev);
    body.innerHTML =
      '<div class="aiv-note"><b>What was typed?</b> ' + esc(NO_PROMPTS[name] || (name + ' does not pass on what people asked. You can see where its visitors landed and what they did.')) + '</div>' +
      statsRow([['Visits', fmt(p.s), d.txt ? esc(d.txt) + ' vs previous period' : ''], ['Engaged', fmt(p.e), pctTxt(p.e, p.s) + ' engagement rate'], ['Key events', fmt(p.k), 'From ' + fmt(p.s) + ' visits']]) +
      '<div class="aiv-card"><h3>Visits and key events</h3><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' +
      (p.k || !M.keyEv.known ? keyEventCardHtml('The key events ' + esc(name) + ' visitors triggered, and the page they landed on.') : '') +
      '<div class="aiv-card"><h3>Where ' + esc(name) + ' sent people</h3><p class="aiv-cap" style="margin-bottom:8px">Landing pages and what those visitors did. Click a page for its full picture.</p><div data-pg></div></div>' +
      (name === 'Copilot' && M.bing.imported ? '<div class="aiv-card"><h3>Questions Copilot cited the site for</h3><div data-q style="margin-top:8px"></div></div>' : '') +
      '<div class="aiv-card"><h3>Referrer recorded by GA4</h3><p class="aiv-cap">' + srcs.map(s => esc(s) + ' (' + fmt(p.sources[s]) + ')').join(' · ') + '</p></div>';
    lineChart(body.querySelector('[data-c]'), {labels: M.labels, weekly: M.weekly, height: 200,
      series: [{name: 'Visits', color: pcol(name), values: p.series, area: true}, {name: 'Key events', color: '#26313c', values: p.keySeries, dash: true}]});
    keyEventTable(body.querySelector('[data-ke]'), M, domain, M.keyEv.rows.filter(r => r[1] === name), {noPlat: true});
    pageTable(body.querySelector('[data-pg]'), M, domain, pagesOf(rows), pcol(name));
    const qh = body.querySelector('[data-q]');
    if (qh) bingQueries(qh, M);
  });
}

function bingQueries(host, M){
  table(host, M.bing.queries.map(q => ({q: q.q, n: q.n, share: q.share})), [
    {key: 'q', label: 'Question', fmt: r => esc(r.q), sort: r => r.q},
    {key: 'n', label: 'Citations', num: true, fmt: r => fmt(r.n)},
    {key: 'share', label: 'Share', num: true, fmt: r => r.share == null ? '—' : Math.round(r.share * 100) + '%', sort: r => r.share || 0}
  ], {sort: 'n', empty: 'Bing hasn’t reported any questions yet.'});
}

function openGoogle(M, domain){
  openDrawer('Google AI Search', '#1baf7a', body => {
    const cited = M.aio.filter(c => c.cited).length, named = M.aio.filter(c => c.named).length, shown = M.aio.filter(c => c.shown).length;
    body.innerHTML =
      '<div class="aiv-note"><b>What was searched?</b> Search Console counts how often Google showed the site in AI Overviews and AI Mode, but not which searches triggered it. The tracked-keyword checks below are real searches, showing what Google’s AI answered for each one' + (M.aioRun ? ' on ' + esc(prettyDate(M.aioRun)) : '') + '.</div>' +
      statsRow([['AI impressions', M.google.imported ? fmt(M.google.n) : '—', esc(periodName(M.period))],
        ['Tracked searches cited', M.aio.length ? cited + ' / ' + M.aio.length : '—', M.aio.length ? named + ' named the business' : ''],
        ['Showed an AI Overview', M.aio.length ? shown + ' / ' + M.aio.length : '—', '']]) +
      (M.google.imported ? '<div class="aiv-card"><h3>Google AI impressions</h3><p class="aiv-cap">Search Console, Generative AI report. Google records this from May 18, 2026.</p><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' +
        '<div class="aiv-card"><h3>Pages Google’s AI showed</h3><p class="aiv-cap" style="margin-bottom:8px">Impressions since May 18, 2026, from the newest export.</p><div data-pg></div></div>' : '') +
      '<div class="aiv-card"><h3>Tracked searches</h3><div data-a style="margin-top:8px"></div></div>';
    if (M.google.imported){
      lineChart(body.querySelector('[data-c]'), {labels: M.labels, weekly: M.weekly, height: 200, series: [{name: 'AI impressions', color: '#1baf7a', values: M.google.series, area: true}]});
      const rows = M.google.pages.map(r => ({key: pageKey(r.u), u: r.u, n: r.n}));
      const max = Math.max(1, ...rows.map(r => r.n));
      table(body.querySelector('[data-pg]'), rows, [
        {key: 'key', label: 'Page', fmt: r => '<span class="aiv-page">' + esc(r.key) + '</span>', sort: r => r.key},
        {key: 'n', label: 'Impressions', num: true, fmt: r => barCell(r.n, max, '#1baf7a')}
      ], {sort: 'n', onRow: r => { const full = M.pages.find(p => p.key === r.key); if (full) openPage(M, domain, full); }});
    }
    drawAio(body.querySelector('[data-a]'), M, domain, false);
  });
}

function openBing(M, domain){
  openDrawer('Copilot / Bing AI', '#eda100', body => {
    body.innerHTML = statsRow([['Citations', fmt(M.bing.n), esc(periodName(M.period))]]) +
      '<div class="aiv-card"><h3>Citations over time</h3><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' +
      '<div class="aiv-card"><h3>Questions Copilot cited the site for</h3><div data-q style="margin-top:8px"></div></div>';
    lineChart(body.querySelector('[data-c]'), {labels: M.labels, weekly: M.weekly, height: 200, series: [{name: 'Citations', color: '#eda100', values: M.bing.series, area: true}]});
    bingQueries(body.querySelector('[data-q]'), M);
  });
}

function openKeyword(M, domain, c){
  openDrawer('“' + c.k + '”' + (c.loc ? ' · ' + c.loc : ''), '#1baf7a', body => {
    const hist = M.aioAll.filter(x => x.k === c.k && x.loc === c.loc).sort((a, b) => a.d < b.d ? 1 : -1);
    const st = {cited: 'Google’s AI Overview cited the site as a source.', named: 'Google’s AI Overview named the business, but didn’t link to the site.',
      miss: 'Google showed an AI Overview, but it didn’t mention the business or cite the site.', none: 'Google didn’t show an AI Overview for this search.'}[M.aioState(c)];
    body.innerHTML = '<div class="aiv-note"><b>' + esc(prettyDate(c.d)) + ':</b> ' + esc(st) + '</div>' +
      ((c.urls || []).length ? '<div class="aiv-card"><h3>Page cited</h3>' + c.urls.map(u => '<p class="aiv-cap" style="margin-top:6px">' + linkTo(domain, u) + '</p>').join('') + '</div>' : '') +
      ((c.comp || []).length ? '<div class="aiv-card"><h3>Other sites the AI Overview cited</h3><div class="aiv-chips" style="margin-top:10px">' +
        c.comp.map(h => '<a class="aiv-chip" href="https://' + esc(h) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none">' + esc(h) + ' ↗</a>').join('') + '</div></div>' : '') +
      '<div class="aiv-card"><h3>History</h3><div data-h style="margin-top:8px"></div></div>' +
      '<p class="aiv-foot"><a href="https://www.google.com/search?q=' + encodeURIComponent(c.k) + '" target="_blank" rel="noopener noreferrer">Search this on Google ↗</a> Your own results depend on your location and history.</p>';
    table(body.querySelector('[data-h]'), hist, [
      {key: 'd', label: 'Checked', fmt: r => esc(prettyDate(r.d))},
      {key: 'st', label: 'Result', fmt: r => { const s = AIO_LBL[M.aioState(r)]; return '<span class="aiv-pill ' + s[1] + '">' + s[0] + '</span>'; }, sort: r => r.d}
    ], {sort: 'd'});
  });
}

function openPage(M, domain, p){
  openDrawer(p.key, '#eb6834', body => {
    const rows = M.cur.filter(r => pageKey(r[3]) === p.key);
    const plats = Object.keys(p.plats).sort((a, b) => p.plats[b] - p.plats[a]);
    const kws = M.aio.filter(c => (c.urls || []).some(u => pageKey(u) === p.key));
    body.innerHTML = '<p class="aiv-cap" style="margin-bottom:12px">' + linkTo(domain, safeUrl(p.u) ? p.u : p.key) + '</p>' +
      statsRow([['AI visits', fmt(p.s), esc(periodName(M.period))], ['Key events', fmt(p.k), ''], ['Google AI impr.', M.google.imported ? fmt(p.g) : '—', M.google.imported ? 'since May 18' : 'not imported'], ['AI Overview cites', fmt(p.aio), 'tracked searches']]) +
      (p.s ? '<div class="aiv-card"><h3>AI visits to this page</h3><div class="aiv-chart" data-c style="margin-top:10px"></div></div>' : '') +
      (p.k ? keyEventCardHtml('Key events by AI visitors who landed on this page.') : '') +
      (plats.length ? '<div class="aiv-card"><h3>Which assistants sent them</h3><div style="margin-top:10px">' + plats.map(n =>
        '<div style="display:grid;grid-template-columns:110px 1fr 50px;gap:10px;align-items:center;margin:6px 0;font-size:12.5px"><span>' + esc(n) + '</span><div class="aiv-bar"><i style="width:' + (p.plats[n] / p.s * 100).toFixed(1) + '%;background:' + pcol(n) + '"></i></div><span style="text-align:right;font-weight:700">' + fmt(p.plats[n]) + '</span></div>').join('') + '</div></div>' : '') +
      (kws.length ? '<div class="aiv-card"><h3>Tracked searches where Google’s AI cited this page</h3><div data-k style="margin-top:8px"></div></div>' : '');
    if (p.s) lineChart(body.querySelector('[data-c]'), {labels: M.labels, weekly: M.weekly, height: 180,
      series: [{name: 'AI visits', color: '#eb6834', values: seriesFor(M, rows, 4), area: true}, {name: 'Key events', color: '#26313c', values: seriesFor(M, rows, 6), dash: true}]});
    keyEventTable(body.querySelector('[data-ke]'), M, domain, M.keyEv.rows.filter(r => pageKey(r[2]) === p.key), {noPage: true});
    if (kws.length) table(body.querySelector('[data-k]'), kws, [
      {key: 'k', label: 'Keyword', fmt: r => esc(r.k), sort: r => r.k}, {key: 'loc', label: 'Location', fmt: r => esc(r.loc || '—'), sort: r => r.loc}
    ], {sort: 'k', asc: true, onRow: r => openKeyword(M, domain, r)});
  });
}

function openDay(M, domain, d){
  const end = M.weekly ? addDays(d, 6) : d;
  const rows = M.cur.filter(r => r[0] >= d && r[0] <= end);
  openDrawer((M.weekly ? 'Week of ' : '') + prettyDate(d), '#eb6834', body => {
    const s = rows.reduce((t, r) => t + r[4], 0), k = rows.reduce((t, r) => t + r[6], 0);
    body.innerHTML = statsRow([['AI visits', fmt(s)], ['Key events', fmt(k)]]) + '<div class="aiv-card"><h3>Visits</h3><div data-t style="margin-top:8px"></div></div>' +
      (k ? keyEventCardHtml('Key events on this ' + (M.weekly ? 'week' : 'day') + '.') : '');
    keyEventTable(body.querySelector('[data-ke]'), M, domain, M.keyEv.rows.filter(r => r[0] >= d && r[0] <= end));
    table(body.querySelector('[data-t]'), rows.map(r => ({d: r[0], p: r[1], key: pageKey(r[3]), s: r[4], k: r[6]})), [
      {key: 'd', label: 'Date', fmt: r => esc(shortDate(r.d))},
      {key: 'p', label: 'Assistant', fmt: r => dotName(r.p, pcol(r.p))},
      {key: 'key', label: 'Landing page', fmt: r => '<span class="aiv-page">' + esc(r.key) + '</span>'},
      {key: 's', label: 'Visits', num: true}, {key: 'k', label: 'Key events', num: true}
    ], {sort: 's', empty: 'No AI visits recorded on this ' + (M.weekly ? 'week' : 'day') + '.', onRow: r => openPlatform(M, domain, r.p)});
  });
}

/* ==========================================================================
   SHARED REPORT (visual only, AgencyAnalytics skin)
   ========================================================================== */
function renderReport(root, feed, opts){
  opts = opts || {};
  injectStyles();
  /* AgencyAnalytics colours for the published report only (the tool keeps its own) */
  const ACH = {AI: '#171614', 'Organic Search': '#5CBAE6', Direct: '#B6D957', 'Google AI Impressions': '#FAC364'};
  const AAP = {ChatGPT: '#5CBAE6', Gemini: '#B6D957', Copilot: '#FAC364', Perplexity: '#8CD3FF', Claude: '#D97757'};
  const AAX = ['#E39FC6', '#9DA8B3', '#7FC8A9', '#C3A6E6'];
  const acol = n => AAP[n] || AAX[Math.abs([...String(n)].reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 0)) % AAX.length];
  const period = opts.period || 30;
  const M = model(feed, period);
  const st = opts.state || (opts.state = {ch: {AI: true, 'Organic Search': false, Direct: false}, plat: ''});

  const kpi = (label, val, d, spark, color) => '<div class="aia-kpi"><div class="aia-kpi-label">' + esc(label) + '</div><div class="aia-kpi-val">' + val + '</div>' +
    '<div class="aia-kpi-delta ' + (d && d.cls || '') + '">' + (d && d.txt ? esc(d.txt) + ' vs previous period' : '&nbsp;') + '</div>' + (spark ? sparkline(spark, color) : '') + '</div>';
  const mentioned = M.aio.filter(c => c.cited || c.named).length;
  const kpis = kpi('AI Visits', fmt(M.ai.s), delta(M.ai.s, M.ai.ps, M.ai.hasPrev), M.ai.series, '#171614') +
    kpi('Conversions from AI', fmt(M.ai.k), delta(M.ai.k, M.ai.pk, M.ai.hasPrev), M.ai.keySeries, '#5CBAE6') +
    (M.google.imported ? kpi('Google AI Impressions', fmtK(M.google.n), delta(M.google.n, M.google.prev, M.google.prev > 0), M.google.series, '#B6D957') : '') +
    (M.aio.length && opts.showAio ? kpi('AI Overview Mentions', pctTxt(mentioned, M.aio.length) + '<div style="font-size:12px;font-weight:500;color:#8593a0;margin-top:4px">' + fmt(mentioned) + ' of ' + fmt(M.aio.length) + ' tracked searches</div>', null, null) : '');

  const keyList = keyEventsOf(M.keyEv.rows), keyTotal = keyList.reduce((t, e) => t + e.n, 0);
  const SEGKEY = (opts.period && typeof opts.period === 'object') ? 'custom' : String(opts.period || 30); const chans = ['AI'].concat(M.hasChannels ? ['Organic Search', 'Direct'] : []).concat(M.google.imported ? ['Google AI Impressions'] : []);
  root.innerHTML = '<div class="aia">' +
    '<div class="aia-panel aia-head"><div><h1 class="aia-title">' + esc(opts.title || ((feed.name || feed.domain) + ' — AI Visibility')) + '</h1>' +
      '<div class="aia-sub">' + esc(prettyDate(M.since)) + ' – ' + esc(prettyDate(M.end)) + '</div></div>' +
      '<div class="aia-periods"><div class="aia-seg" data-period>' + [['lastMonth', 'Last Month'], ['30', '30 Days'], ['90', '90 Days'], ['365', '12 Months'], ['custom', 'Custom']].map(([k, l]) => '<button type="button" data-p="' + k + '"' + (k === SEGKEY ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</div><div data-custom style="display:' + (SEGKEY === 'custom' ? 'flex' : 'none') + ';gap:6px;align-items:center;justify-content:flex-end;margin-top:8px;font-size:12px;color:#5b6670"><input type="date" data-from value="' + M.since + '" style="border:1px solid #d7dde3;border-radius:6px;padding:4px 6px;font:inherit;color:#1f2a33"><span>to</span><input type="date" data-to value="' + M.end + '" style="border:1px solid #d7dde3;border-radius:6px;padding:4px 6px;font:inherit;color:#1f2a33"><button type="button" data-apply style="border:0;background:#171614;color:#fff;border-radius:5px;padding:5px 12px;font:inherit;font-weight:600;cursor:pointer">Apply</button></div></div></div>' +
    '<div class="aia-kpis">' + kpis + '</div>' +
    '<div class="aia-panel aia-row"><div class="aia-panel-head"><h2 class="aia-panel-title">Website Visits</h2><div class="aia-toggles" data-tg>' +
      chans.map(c => '<label class="aia-toggle" style="--c:' + ACH[c] + '"><input type="checkbox" data-c="' + c + '"' + (st.ch[c] ? ' checked' : '') + '><i></i>' + (c === 'AI' ? 'AI Assistants' : c) + '</label>').join('') +
    '</div></div>' +
    (M.plats.length > 1 ? '<div class="aia-chips" data-pf><button type="button" class="aia-chip' + (!st.plat ? ' sel' : '') + '" data-p="">All AI</button>' +
      M.plats.map(p => '<button type="button" class="aia-chip' + (st.plat === p.name ? ' sel' : '') + '" data-p="' + esc(p.name) + '"><i style="background:' + acol(p.name) + '"></i>' + esc(p.name) + '</button>').join('') + '</div>' : '') +
    '<div class="aiv-chart" data-main></div></div>' +
    '<div class="aia-grid2 aia-row">' +
      '<div class="aia-panel"><div class="aia-panel-head"><h2 class="aia-panel-title">AI Visits by Assistant</h2></div><div data-donut></div></div>' +
      (M.google.imported && opts.showGoogleCard ? '<div class="aia-panel"><div class="aia-panel-head"><h2 class="aia-panel-title">Google AI Impressions</h2></div><div class="aiv-chart" data-g></div></div>'
        : '<div class="aia-panel"><div class="aia-panel-head"><h2 class="aia-panel-title">Top Pages from AI</h2></div><div data-pg></div></div>') +
    '</div>' +
    /* Only when key events were recorded in this period; no empty widget otherwise. */
    (keyList.length ? '<div class="aia-panel aia-row"><div class="aia-panel-head"><h2 class="aia-panel-title">Conversions from AI by Type</h2>' +
      '<span style="font-size:12px;color:#8593a0">' + fmt(keyTotal) + ' key event' + (keyTotal === 1 ? '' : 's') + ' from AI visitors</span></div><div data-ke></div></div>' : '') +
    (M.aio.length && opts.showAio ? '<div class="aia-grid2 aia-row"><div class="aia-panel"><div class="aia-panel-head"><h2 class="aia-panel-title">Google AI Overviews · Tracked Searches</h2></div><div data-aio></div></div>' +
      (M.google.imported ? '<div class="aia-panel"><div class="aia-panel-head"><h2 class="aia-panel-title">Top Pages from AI</h2></div><div data-pg2></div></div>' : '<div></div>') + '</div>'
      : (M.google.imported && opts.showGoogleCard ? '<div class="aia-panel aia-row"><div class="aia-panel-head"><h2 class="aia-panel-title">Top Pages from AI</h2></div><div data-pg2></div></div>' : '')) +
    '<div class="aia-foot">' + esc(opts.foot || '') + '</div></div>';

  root.querySelectorAll('[data-period] button').forEach(b => b.addEventListener('click', () => { const k = b.dataset.p; if (k === 'custom'){ root.querySelectorAll('[data-period] button').forEach(x => x.classList.toggle('on', x === b)); const cu = root.querySelector('[data-custom]'); if (cu) cu.style.display = 'flex'; return; } if (opts.onPeriod) opts.onPeriod(k === 'lastMonth' ? 'lastMonth' : Number(k)); })); const applyBtn = root.querySelector('[data-apply]'); if (applyBtn) applyBtn.addEventListener('click', () => { const f = root.querySelector('[data-from]').value, t = root.querySelector('[data-to]').value; if (f && t && f <= t && opts.onPeriod) opts.onPeriod({since: f, end: t}); });

  const drawMain = () => {
    const s = [];
    if (st.ch.AI){
      const p = st.plat && M.plats.find(x => x.name === st.plat);
      s.push({name: p ? p.name : 'AI Assistants', color: p ? acol(p.name) : ACH.AI, values: p ? p.series : M.ai.series, area: !!p});
    }
    ['Organic Search', 'Direct'].forEach(c => { if (st.ch[c] && M.hasChannels) s.push({name: c, color: ACH[c], values: M.channels[c].series}); }); if (st.ch['Google AI Impressions'] && M.google.imported) s.push({name: 'Google AI impressions', color: ACH['Google AI Impressions'], values: M.google.series});
    lineChart(root.querySelector('[data-main]'), {labels: M.labels, weekly: M.weekly, height: 290, series: s, label: 'Website visits', empty: 'Tick a source to show it.'});
  };
  root.querySelectorAll('[data-tg] input').forEach(i => i.addEventListener('change', () => { st.ch[i.dataset.c] = i.checked; drawMain(); }));
  root.querySelectorAll('[data-pf] button').forEach(b => b.addEventListener('click', () => {
    st.plat = b.dataset.p; root.querySelectorAll('[data-pf] button').forEach(x => x.classList.toggle('sel', x === b)); st.ch.AI = true;
    const cb = root.querySelector('[data-tg] input[data-c="AI"]'); if (cb) cb.checked = true; drawMain();
  }));
  drawMain();

  const dn = root.querySelector('[data-donut]');
  if (M.plats.some(p => p.s)){
    const segs = M.plats.filter(p => p.s).map(p => ({key: p.name, label: p.name, n: p.s, color: acol(p.name)}));
    dn.innerHTML = '<div class="aia-ring">' + donut(segs, {cls: 'aia-donut', sub: 'AI visits'}) + '<div class="aia-ring-legend">' +
      segs.map(s => '<div><i style="background:' + s.color + '"></i>' + esc(s.label) + '<span>' + fmt(s.n) + '</span></div>').join('') + '</div></div>';
  } else dn.innerHTML = '<div class="aia-empty">No AI visits in this period.</div>';

  if (M.google.imported && opts.showGoogleCard) lineChart(root.querySelector('[data-g]'), {labels: M.labels, weekly: M.weekly, height: 200, series: [{name: 'AI impressions', color: '#171614', values: M.google.series}]});

  const pagesBars = host => {
    if (!host) return;
    const top = pagesOf(M.cur).sort((a, b) => b.s - a.s).slice(0, 6);
    const max = Math.max(1, ...top.map(t => t.s));
    host.innerHTML = top.length ? top.map(t => '<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:5px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.key) + '</span><b style="color:#222A30;font-weight:600">' + fmt(t.s) + '</b></div>' +
      '<div class="aiv-bar" style="height:8px"><i style="width:' + (t.s / max * 100).toFixed(1) + '%;background:#171614"></i></div></div>').join('') : '<div class="aia-empty">No AI visits in this period.</div>';
  };
  pagesBars(root.querySelector('[data-pg]'));
  pagesBars(root.querySelector('[data-pg2]'));

  const ke = root.querySelector('[data-ke]');
  if (ke){
    const max = Math.max(1, ...keyList.map(e => e.n));
    ke.innerHTML = keyList.slice(0, 8).map(e => {
      const via = topOf(e.plats).map(p => '<span style="display:inline-flex;align-items:center;gap:5px;margin-right:10px"><i style="width:8px;height:8px;border-radius:50%;background:' + acol(p) + ';display:inline-block"></i>' + esc(p) + '</span>').join('');
      return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:5px"><span>' + esc(e.label) +
        '</span><b style="color:#222A30;font-weight:600">' + fmt(e.n) + '</b></div>' +
        '<div class="aiv-bar" style="height:8px"><i style="width:' + (e.n / max * 100).toFixed(1) + '%;background:#171614"></i></div>' +
        '<div style="font-size:11.5px;color:#8593a0;margin-top:5px">' + via + '</div></div>';
    }).join('');
  }

  const ah = root.querySelector('[data-aio]');
  if (ah){
    const segs = [
      {key: 'cited', label: 'Cited as a source', color: '#B6D957'}, {key: 'named', label: 'Named in the answer', color: '#5CBAE6'},
      {key: 'miss', label: 'Not mentioned', color: '#FAC364'}, {key: 'none', label: 'No AI Overview', color: '#E4E4E7'}
    ].map(s => Object.assign(s, {n: M.aio.filter(c => M.aioState(c) === s.key).length}));
    ah.innerHTML = '<div class="aia-ring">' + donut(segs, {cls: 'aia-donut', center: mentioned + ' / ' + M.aio.length, sub: 'mentioned'}) + '<div class="aia-ring-legend">' +
      segs.map(s => '<div><i style="background:' + s.color + '"></i>' + esc(s.label) + '<span>' + s.n + '</span></div>').join('') + '</div></div>';
  }
}

function renderMessage(root, title, body, isErr){
  injectStyles();
  root.innerHTML = '<div class="aiv"><div class="aiv-msg' + (isErr ? ' err' : '') + '"><h3>' + esc(title) + '</h3><div>' + body + '</div></div></div>';
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

/* ---------- feed cache ----------
   The tracker is an Apps Script web app: 5 s warm, 30–40 s cold. The numbers
   only change when the tracker imports (daily at most), so the last feed is
   kept in this browser and drawn at once, then swapped for the fresh one when
   it arrives. Per browser only; the shared report also gets a copy stored on
   its Firestore doc (see publishSnap). */
const CACHE_V = 1, CACHE_PREFIX = 'aivFeed:';
function cacheGet(id){
  try{
    const o = JSON.parse(localStorage.getItem(CACHE_PREFIX + id) || 'null');
    return o && o.v === CACHE_V && o.feed ? o : null;
  }catch(e){ return null; }
}
function cachePut(id, feed){
  const val = JSON.stringify({v: CACHE_V, at: Date.now(), feed});
  try{ localStorage.setItem(CACHE_PREFIX + id, val); return; }catch(e){}
  /* Storage full: drop the other cached feeds (oldest first) and try once more. */
  try{
    const keys = [];
    for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_PREFIX + id) keys.push(k); }
    keys.map(k => { let at = 0; try{ at = JSON.parse(localStorage.getItem(k)).at || 0; }catch(e){} return [k, at]; })
      .sort((a, b) => a[1] - b[1]).forEach(([k]) => localStorage.removeItem(k));
    localStorage.setItem(CACHE_PREFIX + id, val);
  }catch(e){}
}
/* Same data, ignoring the request timestamp, so an unchanged feed doesn't redraw. */
const feedSig = f => { try{ const c = Object.assign({}, f); delete c.generatedAt; return JSON.stringify(c); }catch(e){ return String(Math.random()); } };

window.AIVis = {render, renderReport, renderMessage, apiGet, normDomain, cacheGet, cachePut, feedSig};

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
let tokens = {};
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
  if (!on) closeDrawer();
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
  const c = activeClient();
  if (active){
    if ((c ? c.id : null) !== loadedFor){ closeDrawer(); load(false); }
  } else prefetch(c);
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
    try{ localStorage.removeItem('aivRegSig'); }catch(e){}
    load(true);
  });
  const cancel = v.querySelector('#aivCancel');
  if (cancel) cancel.addEventListener('click', () => load(false));
}

/* Send the tool's client list so new clients appear in the tracker, with their
   keywords and locations for the AI Overview checks. Only when it changed. */
async function register(s){
  const list = (state.seoClients || []).filter(c => normDomain(c.website).indexOf('.') > -1).map(c => ({
    id: c.id, name: c.name || '', website: c.website, status: c.status || '',
    keywords: (c.keywords || []).slice(0, 60).map(k => ({text: k.text || '', location: ((k.locations || [])[0] || {}).label || '',
      locations: (k.locations || []).slice(0, 5).map(l => ({label: l.label || '', lat: l.lat == null ? null : l.lat, lng: l.lng == null ? null : l.lng}))}))
  }));
  const sig = JSON.stringify(list.map(c => [c.id, c.name, normDomain(c.website), c.status, c.keywords.map(k => k.text + '@' + k.locations.length).join(',')]));
  let stored = null;
  try{ stored = localStorage.getItem('aivRegSig'); }catch(e){}
  if (sig === registeredSig || sig === stored){ registeredSig = sig; return; }
  const res = await apiPost(s.url, {key: s.key, action: 'register', clients: list, url: s.url});
  registeredSig = sig;
  try{ localStorage.setItem('aivRegSig', sig); }catch(e){}
  (res.clients || []).forEach(c => { tokens[c.domain] = c.token; });
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
  /* Draw the last copy straight away (memory, then this browser's cache), then refresh. */
  const cached = memFeed[domain] || cacheGet(domain);
  let shownSig = null;
  if (cached){
    shownSig = feedSig(cached.feed);
    draw(v, c, cached.feed, {stale: true, at: cached.at});
  } else {
    renderMessage(v, 'Loading AI visibility', '<span class="aiv-spin"></span>Reading ' + esc(domain) + ' from the tracker…' +
      '<div style="margin-top:8px;font-size:12px;color:var(--a-ink3)">The first load for a client can take up to 40 seconds. After that it opens instantly.</div>');
  }
  /* The client-list sync runs alongside the feed, so a slow sync never holds the page. */
  register(s).catch(() => { registeredSig = null; });
  try{
    const feed = await fetchFeed(s, domain, force);
    if (loadedFor !== forId || !active) return;
    const fresh = memFeed[domain];
    if (feedSig(feed) !== shownSig) draw(v, c, feed, {at: fresh.at});
    else setFreshness(v, {at: fresh.at});
    publishSnap(c, feed);
  }catch(err){
    if (loadedFor !== forId) return;
    /* With a cached copy on screen, a failed refresh is a note, not an error page. */
    if (cached){ setFreshness(v, {stale: true, at: cached.at, err: err.message}); return; }
    if (/key/.test(err.message)){ renderConnect(v, err.message); return; }
    if (/unknown client/.test(err.message)){
      renderMessage(v, 'Not in the tracker yet', esc(domain) + ' hasn’t reached the tracker yet. It is added automatically; try again in a moment.' +
        '<div class="aiv-actions" style="justify-content:center;margin-top:14px"><button class="aiv-btn" type="button" data-aiv-retry>Try again</button></div>');
      registeredSig = null; try{ localStorage.removeItem('aivRegSig'); }catch(e){}
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

/* One request per client at a time: the tab, a prefetch and a retry share it. */
const memFeed = {}, inFlight = {};
function fetchFeed(s, domain, force){
  if (inFlight[domain] && !force) return inFlight[domain];
  const p = apiGet(s.url, {action: 'feed', domain, key: s.key, _: force ? Date.now() : ''})
    .then(feed => { const o = {at: Date.now(), feed}; memFeed[domain] = o; cachePut(domain, feed); return feed; })
    .finally(() => { if (inFlight[domain] === p) delete inFlight[domain]; });
  inFlight[domain] = p;
  return p;
}
/* Opening a client warms its feed, so the AI Visibility tab is usually ready
   by the time someone clicks it. At most once every 10 minutes per client. */
function prefetch(c){
  const s = settings();
  if (!c || !s.url || !s.key) return;
  const domain = normDomain(c.website);
  if (domain.indexOf('.') < 0 || inFlight[domain]) return;
  const have = memFeed[domain] || cacheGet(domain);
  if (have && Date.now() - have.at < 10 * 60 * 1000) return;
  fetchFeed(s, domain, false).then(feed => publishSnap(c, feed)).catch(() => {});
}
/* Keeps a copy of the feed on the shared report's Firestore doc, so the public
   page draws in a fraction of a second and then checks the tracker for newer
   numbers. update() only touches reports that were already shared, and the
   copy is skipped when nothing changed. Stored as a string: Firestore can't
   hold the nested arrays the GA4 rows use. */
const snapSig = {};
function publishSnap(c, feed){
  try{
    if (typeof fbDb === 'undefined' || !fbDb || !c) return;
    const sig = feedSig(feed);
    if (snapSig[c.id] === sig) return;
    const snap = JSON.stringify(feed);
    if (snap.length > 900000) return;   /* Firestore's 1 MB document limit */
    snapSig[c.id] = sig;
    fbDb.collection('publicViews').doc(reportId(c)).update({snap, snapAt: Date.now()}).catch(() => { delete snapSig[c.id]; });
  }catch(e){}
}
const ago = at => {
  const m = Math.round((Date.now() - at) / 60000);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
};
function setFreshness(v, f){
  const el = v.querySelector('[data-aiv-fresh]');
  if (!el) return;
  el.className = 'aiv-status' + (f.err ? ' err' : '');
  el.innerHTML = f.err ? 'Couldn’t refresh (' + esc(f.err) + '). Showing data from ' + esc(ago(f.at)) + '.'
    : f.stale ? '<span class="aiv-spin"></span>Checking for newer data…'
    : 'Up to date';
  el.title = f.at ? 'Loaded ' + new Date(f.at).toLocaleString('en-CA') : '';
}

function reportId(c){ return 'aireport-' + c.id; }
function reportUrl(c){
  const base = location.origin + location.pathname.replace(/[^\/]*$/, '');
  return base + 'ai-report.html?r=' + encodeURIComponent(reportId(c));
}
function embedCode(url){
  return '<iframe src="' + url + '" style="width:100%;height:1500px;border:0" loading="lazy" title="AI visibility"></iframe>';
}

function draw(v, c, feed, info){
  info = info || {};
  const domain = feed.domain;
  const tracking = feed.tracking || {};
  const actions =
    '<span class="aiv-status" data-aiv-fresh></span>' +
    (tracking.ga4 ? '<button class="aiv-btn" type="button" data-aiv-refresh title="Pull the latest GA4 data for this client now">Refresh GA4</button>' : '') +
    '<button class="aiv-btn go" type="button" data-aiv-share>Share report</button>' +
    '<button class="aiv-btn" type="button" data-aiv-conn title="Tracker connection" aria-label="Tracker connection">⚙</button>';
  const top = '<div data-aiv-sharebox></div>' + (!tracking.ga4
    ? '<div class="aiv-note">GA4 isn’t matched for ' + esc(domain) + ' yet. The tracker looks for a GA4 web stream with this website each week; you can also type the property number into the Clients tab of the tracker sheet.</div>'
    : '');

  render(v, feed, {
    period, actionsHtml: actions, topHtml: top,
    onPeriod: p => { period = p; closeDrawer(); draw(v, c, feed, info); }
  });
  setFreshness(v, info);

  const s = settings();
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
    const doc = {
      type: 'aireport', clientName: c.name || domain, domain,
      title: (c.name || domain) + ' — AI Visibility',
      feedUrl: s.url, token: tokens[domain], updatedAt: Date.now()
    };
    /* Ship the current numbers with the link so the report opens instantly. */
    const have = memFeed[domain] || cacheGet(domain);
    if (have){ const snap = JSON.stringify(have.feed); if (snap.length <= 900000){ doc.snap = snap; doc.snapAt = have.at; snapSig[c.id] = feedSig(have.feed); } }
    await fbDb.collection('publicViews').doc(reportId(c)).set(doc);
    const url = reportUrl(c);
    box.innerHTML = '<div class="aiv-share"><label>Report link</label><input readonly value="' + esc(url) + '">' +
      '<label>Embed code</label><textarea readonly rows="2">' + esc(embedCode(url)) + '</textarea>' +
      '<div class="aiv-actions"><button class="aiv-btn" type="button" data-copy="link">Copy link</button><button class="aiv-btn" type="button" data-copy="embed">Copy embed code</button>' +
      '<a class="aiv-btn" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a>' +
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
