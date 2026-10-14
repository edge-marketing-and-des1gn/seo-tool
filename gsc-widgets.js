/* ==========================================================================
   SEARCH QUERIES WIDGETS
   For a client tab that shows the Search Console queries dashboard, adds a
   "Choose widgets" button to the tab's toolbar. Tick the widgets you want,
   watch the dashboard update as you go, then Publish: the choice is saved in
   the AI Visibility Tracker, so the same link everywhere (this tool and the
   AgencyAnalytics report) shows only those widgets from then on.
   ========================================================================== */
(function(){
  const GROUPS = [
    ['Header', [['header', 'Title and date picker']]],
    ['Headline numbers', [['kpi_clicks', 'Clicks'], ['kpi_impressions', 'Impressions'], ['kpi_ctr', 'CTR'], ['kpi_position', 'Average Position']]],
    ['Charts', [['privacy', 'Note about private searches'], ['trend', 'Clicks / impressions by day'], ['top_queries', 'Top Queries'], ['branded', 'Branded vs Non-Branded'], ['devices', 'Devices'], ['countries', 'Top Countries']]],
    ['Tables', [['almost_top', 'Almost on Top'], ['low_ctr', 'Seen Often, Rarely Clicked'], ['landing_pages', 'Top Landing Pages'], ['all_queries', 'All Search Queries']]],
  ];
  const ALL = GROUPS.flatMap(g => g[1].map(w => w[0]));

  const acts = document.querySelector('.seo-embed-acts');
  const urlEl = document.getElementById('seoEmbedUrl');
  const frame = document.getElementById('seoEmbedFrame');
  if (!acts || !urlEl || !frame) return;

  const css = document.createElement('style');
  css.textContent =
    '.gw-modal{max-width:520px !important;}' +
    '.gw-modal h3{margin:0 0 4px;font-size:17px;}' +
    '.gw-sub{font-size:12.5px;color:var(--ink-3);margin-bottom:14px;}' +
    '.gw-group{margin-bottom:12px;}' +
    '.gw-group b{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px;}' +
    '.gw-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;}' +
    '.gw-grid label{display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;padding:4px 0;}' +
    '.gw-grid input{width:16px;height:16px;accent-color:var(--brand,#e87722);}' +
    '.gw-quick{display:flex;gap:10px;font-size:12.5px;margin-bottom:12px;}' +
    '.gw-quick button{border:0;background:none;padding:0;color:var(--brand-deep,#b8570f);font:inherit;font-weight:600;cursor:pointer;}' +
    '.gw-status{font-size:12.5px;min-height:18px;margin:6px 0 10px;color:var(--ink-3);}' +
    '.gw-status.err{color:var(--alert,#c0392b);}' +
    '.gw-foot{display:flex;justify-content:flex-end;gap:8px;}' +
    '@media (max-width:520px){.gw-grid{grid-template-columns:1fr;}}';
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.className = 'btn btn-sm'; btn.type = 'button'; btn.textContent = 'Choose widgets'; btn.style.display = 'none';
  acts.insertBefore(btn, acts.firstChild);

  /* The toolbar always shows the open tab's full link, so read it from there. */
  const current = () => { const u = (urlEl.textContent || '').trim(); return u ? { url: u } : null; };
  const isQueriesDash = d => !!(d && /search-queries/.test(d.url) && /[#&]feed=/.test(d.url));
  const sync = () => { btn.style.display = isQueriesDash(current()) ? '' : 'none'; };
  new MutationObserver(sync).observe(urlEl, { childList: true, characterData: true, subtree: true });
  sync();

  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = '<div class="modal gw-modal" role="dialog" aria-modal="true" aria-labelledby="gwTitle">' +
    '<h3 id="gwTitle">Choose widgets</h3><div class="gw-sub" id="gwSub"></div>' +
    '<div class="gw-quick"><button type="button" data-q="all">Select all</button><button type="button" data-q="none">Clear all</button></div>' +
    '<div id="gwGroups">' + GROUPS.map(g => '<div class="gw-group"><b>' + g[0] + '</b><div class="gw-grid">' +
      g[1].map(w => '<label><input type="checkbox" value="' + w[0] + '"> ' + w[1] + '</label>').join('') + '</div></div>').join('') + '</div>' +
    '<div class="gw-status" id="gwStatus"></div>' +
    '<div class="gw-foot"><button class="btn" type="button" id="gwCancel">Cancel</button><button class="btn btn-go" type="button" id="gwPublish">Publish</button></div></div>';
  document.body.appendChild(back);
  const boxes = () => [...back.querySelectorAll('#gwGroups input')];
  const chosen = () => boxes().filter(b => b.checked).map(b => b.value);
  const status = (msg, err) => { const s = back.querySelector('#gwStatus'); s.textContent = msg || ''; s.classList.toggle('err', !!err); };

  let ctx = null, published = null;
  const send = (widgets, isPublished) => { try { frame.contentWindow.postMessage({ type: 'gsc-layout', widgets: widgets, published: !!isPublished }, '*'); } catch (e) {} };

  function tracker(){
    const s = (typeof state !== 'undefined' && state.settings && state.settings.aiTracker) || {};
    if (!s.url || !s.key) throw new Error('Connect the AI Visibility Tracker first (AI Visibility tab).');
    return s;
  }

  btn.addEventListener('click', async () => {
    const d = current(); if (!isQueriesDash(d)) return;
    const hp = new URLSearchParams(d.url.split('#')[1] || '');
    ctx = { domain: hp.get('domain') || '', name: hp.get('name') || hp.get('domain') || 'this client' };
    back.querySelector('#gwSub').textContent = 'For ' + ctx.name + '. Changes show in the preview right away; Publish updates the AgencyAnalytics report too.';
    boxes().forEach(b => { b.checked = true; b.disabled = true; });
    status('Loading the published choice…');
    back.classList.add('on');
    try {
      const s = tracker();
      const r = await AIVis.apiGet(s.url, { action: 'gscLayout', domain: ctx.domain, key: s.key });
      published = r.layout && Array.isArray(r.layout.widgets) ? r.layout.widgets : null;
      const on = new Set(published || ALL);
      boxes().forEach(b => { b.checked = on.has(b.value); b.disabled = false; });
      status(published ? 'Last published ' + new Date(r.layout.updatedAt).toLocaleString() : 'Showing every widget (nothing published yet).');
    } catch (e) {
      boxes().forEach(b => { b.disabled = false; });
      status(e.message, true);
    }
  });

  back.addEventListener('change', e => { if (e.target.matches('#gwGroups input')) send(chosen(), false); });
  back.querySelector('.gw-quick').addEventListener('click', e => {
    const q = e.target.dataset && e.target.dataset.q; if (!q) return;
    boxes().forEach(b => { b.checked = q === 'all'; }); send(chosen(), false);
  });

  function close(revert){
    back.classList.remove('on');
    if (revert) send(published, true);
  }
  back.querySelector('#gwCancel').addEventListener('click', () => close(true));
  back.addEventListener('click', e => { if (e.target === back) close(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && back.classList.contains('on')) close(true); });

  back.querySelector('#gwPublish').addEventListener('click', async () => {
    const widgets = chosen();
    if (!widgets.length){ status('Pick at least one widget.', true); return; }
    const pub = back.querySelector('#gwPublish');
    pub.disabled = true; status('Publishing…');
    try {
      const s = tracker();
      const res = await fetch(s.url, { method: 'POST', redirect: 'follow', body: JSON.stringify({ key: s.key, action: 'setGscLayout', domain: ctx.domain, widgets: widgets }) });
      const j = await res.json();
      if (!j || j.error) throw new Error(j && j.error === 'unauthorized' ? 'The tracker did not accept the key.' : (j && j.error) || 'No answer from the tracker.');
      published = widgets;
      send(published, true);
      close(false);
      if (typeof toast === 'function') toast('Widgets published — the report shows ' + widgets.length + ' of ' + ALL.length);
    } catch (e) {
      status(e.message, true);
    } finally { pub.disabled = false; }
  });
})();
