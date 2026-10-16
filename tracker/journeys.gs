/* ==========================================================================
   AI VISITOR JOURNEYS
   Follows individual AI visitors page by page, using the anonymous IDs Tag
   Manager adds to GA4 on every client site:
     edge_vid  one per browser (the visitor)
     edge_sid  one per visit (30 minutes of inactivity starts a new one)
     edge_src  where the visit came from: utm_source or the referring site

   GET ?action=journeys&domain=x&key=ADMIN&start=YYYY-MM-DD&end=YYYY-MM-DD
   Internal only: the admin key is required, client report tokens are refused.

   Two GA4 queries per call:
     1. which visitor IDs came from an AI assistant (edge_src, or GA4's own
        session source for visits before edge_src existed)
     2. everything those visitors did in the range, including later visits
        that came from elsewhere (Google, direct...), so a ChatGPT visitor who
        comes back a week later and calls is still one journey.
   Results are cached for 15 minutes per client and range.
   ========================================================================== */

const JRN_MAX_VISITORS_ = 300;
/* Events that say nothing about the path. */
const JRN_SKIP_EVENTS_ = ['session_start', 'first_visit', 'user_engagement', 'scroll', 'form_start'];

function journeysFor_(domain, start, end) {
  const c = clients_().filter(function (x) { return x.domain === domain; })[0];
  if (!c) return { error: 'unknown client' };
  if (!c.ga4) return { error: 'GA4 is not matched for this client yet' };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  end = iso.test(end || '') ? end : 'today';
  start = iso.test(start || '') ? start : '30daysAgo';
  const ck = 'jrn:' + domain + ':' + start + ':' + end;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  const prop = 'properties/' + c.ga4;
  const notSet = function (f) {
    return { notExpression: { filter: { fieldName: f, inListFilter: { values: ['(not set)', ''] } } } };
  };
  const out = { domain: domain, start: start, end: end, visitors: [], notes: [] };

  /* 1. AI visitors */
  var q1;
  try {
    q1 = AnalyticsData.Properties.runReport({
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'customEvent:edge_vid' }, { name: 'customEvent:edge_src' }, { name: 'sessionSource' }, { name: 'dateHourMinute' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { andGroup: { expressions: [notSet('customEvent:edge_vid'), { orGroup: { expressions: [
        { filter: { fieldName: 'customEvent:edge_src', stringFilter: { matchType: 'PARTIAL_REGEXP', value: AI_SOURCE_REGEX, caseSensitive: false } } },
        { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'PARTIAL_REGEXP', value: AI_SOURCE_REGEX, caseSensitive: false } } }
      ] } }] } },
      orderBys: [{ dimension: { dimensionName: 'dateHourMinute' }, desc: true }],
      limit: 20000,
      returnPropertyQuota: false
    }, prop);
  } catch (e) {
    /* edge_src may not be registered yet on a property: fall back to session source alone. */
    try {
      q1 = AnalyticsData.Properties.runReport({
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'customEvent:edge_vid' }, { name: 'sessionSource' }, { name: 'dateHourMinute' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: { andGroup: { expressions: [notSet('customEvent:edge_vid'),
          { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'PARTIAL_REGEXP', value: AI_SOURCE_REGEX, caseSensitive: false } } }] } },
        orderBys: [{ dimension: { dimensionName: 'dateHourMinute' }, desc: true }],
        limit: 20000
      }, prop);
      (q1.rows || []).forEach(function (r) { r.dimensionValues.splice(1, 0, { value: '' }); });
      out.notes.push('Visit source (edge_src) is not available on this GA4 property yet.');
    } catch (e2) {
      return { error: /edge_vid/.test(e2.message) ? 'The visitor ID dimension is not registered on this GA4 property yet.' : e2.message };
    }
  }
  if (q1.metadata && q1.metadata.subjectToThresholding) out.thresholded = true;

  const aiOf = {};   // vid -> {platform, src}
  const order = [];
  (q1.rows || []).forEach(function (r) {
    const d = r.dimensionValues.map(function (v) { return v.value; });
    const vid = d[0];
    if (aiOf[vid]) return;
    const raw = new RegExp(AI_SOURCE_REGEX, 'i').test(d[1]) ? d[1] : d[2];
    aiOf[vid] = { platform: platformFor_(raw), src: raw };
    order.push(vid);
  });
  if (order.length > JRN_MAX_VISITORS_) out.notes.push('Showing the ' + JRN_MAX_VISITORS_ + ' most recent AI visitors of ' + order.length + '.');
  const vids = order.slice(0, JRN_MAX_VISITORS_);
  if (!vids.length) return store_(cache, ck, out);

  /* 2. their full paths */
  const steps = {};
  for (var i = 0; i < vids.length; i += 100) {
    const chunk = vids.slice(i, i + 100);
    var q2;
    const run = function (withSrc) {
      const dims = [{ name: 'customEvent:edge_vid' }, { name: 'customEvent:edge_sid' }, { name: 'dateHourMinute' },
        { name: 'pagePath' }, { name: 'eventName' }, { name: 'sessionSource' }];
      if (withSrc) dims.push({ name: 'customEvent:edge_src' });
      return AnalyticsData.Properties.runReport({
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: dims,
        metrics: [{ name: 'eventCount' }, { name: 'keyEvents' }],
        dimensionFilter: { andGroup: { expressions: [
          { filter: { fieldName: 'customEvent:edge_vid', inListFilter: { values: chunk } } },
          { notExpression: { filter: { fieldName: 'eventName', inListFilter: { values: JRN_SKIP_EVENTS_ } } } }
        ] } },
        limit: 50000
      }, prop);
    };
    try { q2 = run(true); } catch (e) { q2 = run(false); }
    if (q2.metadata && q2.metadata.subjectToThresholding) out.thresholded = true;
    (q2.rows || []).forEach(function (r) {
      const d = r.dimensionValues.map(function (v) { return v.value; });
      const m = r.metricValues.map(function (v) { return Number(v.value) || 0; });
      (steps[d[0]] = steps[d[0]] || []).push({
        sid: d[1] === '(not set)' ? '' : d[1],
        t: d[2].slice(0, 4) + '-' + d[2].slice(4, 6) + '-' + d[2].slice(6, 8) + ' ' + d[2].slice(8, 10) + ':' + d[2].slice(10, 12),
        page: d[3], ev: d[4], ss: d[5], src: d[6] && d[6] !== '(not set)' ? d[6] : '', n: m[0], k: m[1]
      });
    });
  }

  /* Visitor -> visits -> steps. A page step is page_view or edge_page (sites that load GA4
     themselves send both for one page load; keep one). */
  vids.forEach(function (vid) {
    const list = steps[vid] || [];
    if (!list.length) return;
    const visits = {};
    list.forEach(function (s) {
      const key = s.sid || ('t' + s.t.slice(0, 13));
      const v = visits[key] = visits[key] || { sid: s.sid, src: '', ss: '', steps: [] };
      if (s.src && !v.src) v.src = s.src;
      if (s.ss && s.ss !== '(not set)' && !v.ss) v.ss = s.ss;
      v.steps.push(s);
    });
    const vs = Object.keys(visits).map(function (k) {
      const v = visits[k];
      v.steps.sort(function (a, b) {
        if (a.t !== b.t) return a.t < b.t ? -1 : 1;
        const pa = isPage_(a.ev) ? 0 : 1, pb = isPage_(b.ev) ? 0 : 1;
        return pa - pb;
      });
      const seq = [];
      v.steps.forEach(function (s) {
        const page = isPage_(s.ev);
        const prev = seq[seq.length - 1];
        if (page && prev && prev[2] === 'page' && prev[1] === s.page && prev[0] === s.t) return;   // same load sent twice
        if (page) { for (var r = 0; r < Math.max(1, s.n); r++) seq.push([s.t, s.page, 'page', 0]); }
        else seq.push([s.t, s.page, s.ev, s.k > 0 ? 1 : 0, s.n]);
      });
      const raw = v.src || v.ss || '';
      return { sid: v.sid, start: seq.length ? seq[0][0] : '', src: raw, platform: new RegExp(AI_SOURCE_REGEX, 'i').test(raw) ? platformFor_(raw) : '',
        steps: seq.slice(0, 200) };
    }).filter(function (v) { return v.steps.length; })
      .sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    if (!vs.length) return;
    out.visitors.push({ vid: vid, platform: aiOf[vid].platform, src: aiOf[vid].src, visits: vs });
  });
  out.visitors.sort(function (a, b) {
    const la = a.visits[a.visits.length - 1].start, lb = b.visits[b.visits.length - 1].start;
    return la < lb ? 1 : -1;
  });
  out.generatedAt = new Date().toISOString();
  return store_(cache, ck, out);
}

function isPage_(ev) { return ev === 'page_view' || ev === 'edge_page'; }

function store_(cache, ck, out) {
  try { const s = JSON.stringify(out); if (s.length < 95000) cache.put(ck, s, 900); } catch (e) {}
  return out;
}

/* Run from the editor to check one client: logs a short summary. */
function testJourneys() {
  const r = journeysFor_('advanceconstructiondemo.ca', '', '');
  console.log(r.error || (r.visitors.length + ' AI visitors' + (r.thresholded ? ' (thresholded)' : '') + '\n' +
    r.visitors.slice(0, 5).map(function (v) {
      return v.platform + ' ' + v.vid + ': ' + v.visits.map(function (x) {
        return x.start + ' [' + (x.src || '?') + '] ' + x.steps.map(function (s) { return s[2] === 'page' ? s[1] : '→ ' + s[2]; }).join(' › ');
      }).join(' || ');
    }).join('\n')));
}
