/* ==========================================================================
   GA4 CONVERSIONS AND TRAFFIC, ALL CHANNELS (for the Team and Client reports)

   GET ?action=ga4report&domain=x&key=ADMIN|t=TOKEN&start=YYYY-MM-DD&end=YYYY-MM-DD
   {
     range: {start, end},
     conv:    [[date, channel, source, eventName, landingPage, count]]   key events only
     traffic: [[date, channel, sessions, engagedSessions, users, keyEvents]]
   }
   channel is GA4's default channel group, except visits from AI assistants,
   which are labelled "AI: <assistant>" so they can be told apart from
   Referral / Direct. Aggregated numbers only, so a client token may read it.
   Cached 30 minutes per client and range.
   ========================================================================== */

function ga4ReportFor_(domain, start, end) {
  const c = clients_().filter(function (x) { return x.domain === domain; })[0];
  if (!c) return { error: 'unknown client' };
  if (!c.ga4) return { error: 'GA4 is not matched for this client yet' };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  end = iso.test(end || '') ? end : 'yesterday';
  start = iso.test(start || '') ? start : '30daysAgo';
  const ck = 'g4r:' + domain + ':' + start + ':' + end;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  const prop = 'properties/' + c.ga4;
  const ai = new RegExp(AI_SOURCE_REGEX, 'i');
  const chOf = function (channel, source) { return ai.test(source) ? 'AI: ' + platformFor_(source) : channel; };
  const day = function (d) { return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8); };
  const page = function (fn, base) {
    const out = [];
    var offset = 0;
    while (true) {
      const req = Object.assign({}, base, { limit: 25000, offset: offset });
      const res = AnalyticsData.Properties.runReport(req, prop);
      (res.rows || []).forEach(function (r) { fn(r.dimensionValues.map(function (v) { return v.value; }), r.metricValues.map(function (v) { return Number(v.value) || 0; }), out); });
      offset += (res.rows || []).length;
      if (!(res.rows || []).length || offset >= (res.rowCount || 0) || offset >= 100000) break;
    }
    return out;
  };

  const conv = page(function (d, m, out) {
    if (m[0] > 0) out.push([day(d[0]), chOf(d[1], d[2]), d[2], d[3], d[4] || '(not set)', Math.round(m[0])]);
  }, {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }, { name: 'eventName' }, { name: 'landingPage' }],
    metrics: [{ name: 'keyEvents' }],
    metricFilter: { filter: { fieldName: 'keyEvents', numericFilter: { operation: 'GREATER_THAN', value: { int64Value: '0' } } } }
  });

  /* Traffic by channel: summed per day after relabelling AI sources. */
  const tmap = {};
  page(function (d, m) {
    const k = day(d[0]) + '|' + chOf(d[1], d[2]);
    const o = tmap[k] = tmap[k] || [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) o[i] += m[i];
  }, {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }]
  });
  const traffic = Object.keys(tmap).map(function (k) {
    const p = k.split('|'), o = tmap[k];
    return [p[0], p[1], Math.round(o[0]), Math.round(o[1]), Math.round(o[2]), Math.round(o[3])];
  }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });

  const out = { domain: domain, range: { start: start, end: end }, conv: conv, traffic: traffic, generatedAt: new Date().toISOString() };
  try { const s = JSON.stringify(out); if (s.length < 95000) cache.put(ck, s, 1800); } catch (e) {}
  return out;
}

function testGa4Report() {
  const r = ga4ReportFor_('edgemarketing.ca', '', '');
  if (r.error) { console.log(r.error); return; }
  const by = {};
  r.conv.forEach(function (x) { by[x[1]] = (by[x[1]] || 0) + x[5]; });
  console.log(r.conv.length + ' conversion rows, ' + r.traffic.length + ' traffic rows. Key events by channel: ' + JSON.stringify(by) +
    ' | size ' + JSON.stringify(r).length);
}
