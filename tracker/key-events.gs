/* ==========================================================================
   AI VISIBILITY TRACKER — two additions
   Paste this file into the tracker's Apps Script project (Extensions → Apps
   Script → + → Script, name it key-events). Needs the "Google Analytics Data
   API" advanced service, which the tracker already uses for GA4.

   1. KEY EVENT NAMES
      The feed sends how many key events AI visitors triggered, but not which
      ones. The SEO tool now reads an extra list, feed.ga4.events:
          [date 'YYYY-MM-DD', platform, landing page, event name, count]
      and shows it in the AI Visibility tab (every drill-down) and on the
      shared report (a "Conversions from AI by Type" panel that only appears
      when there are key events).

      Hook it up in two places:
        a) Where the GA4 import runs for a client, after it saves the AI rows:
             saveKeyEvents_(domain, fetchAiKeyEvents_(propertyId, startDate, endDate), startDate);
           startDate/endDate as 'YYYY-MM-DD' (use the same range the import uses).
        b) Where the feed object is built (action=feed), before it is returned:
             feed.ga4 = feed.ga4 || {};
             feed.ga4.events = readKeyEvents_(domain);

      Platform names must match the ones the feed already uses (ChatGPT,
      Perplexity, Gemini, Copilot, Claude…). If the tracker already has a
      function that turns a GA4 source into a platform, call it in
      aiPlatformOf_() below instead of the rules here, so both lists agree.

   2. FEED CACHE (the slow load)
      Measured from the SEO tool: the feed takes ~38 s on a cold start and ~5 s
      warm, for 46 KB of JSON. The tool now shows its last copy instantly, but
      the tracker itself should answer faster too. Wrap the feed builder:
             const feed = cachedFeed_(domain, () => buildFeed(domain));   // your existing builder
      and clear a client's cache whenever its data changes (end of each
      import, and the "refresh" action):
             clearFeedCache_(domain);
      Optional: a time-driven trigger on warmFeeds_() every few hours keeps the
      cache filled, so even the first open of the day is fast.
   ========================================================================== */

/* ---------- 1. key event names ---------- */

/* GA4 sources that count as AI assistants. Keep in step with the tracker's
   existing AI source filter. */
const AIV_PLATFORM_RULES_ = [
  [/chatgpt\.com|chat\.openai\.com|openai/i, 'ChatGPT'],
  [/perplexity/i, 'Perplexity'],
  [/gemini\.google|bard\.google/i, 'Gemini'],
  [/copilot\.microsoft|copilot\.com|bing\.com\/chat|edgeservices\.bing/i, 'Copilot'],
  [/claude\.ai|anthropic/i, 'Claude'],
  [/meta\.ai/i, 'Meta AI'],
  [/grok\.com|x\.ai/i, 'Grok'],
  [/deepseek/i, 'DeepSeek'],
  [/you\.com|phind|poe\.com|mistral|chat\.mistral|kagi\.com\/assistant/i, 'Other AI']
];
const AIV_SOURCE_REGEX_ = '.*(chatgpt\\.com|chat\\.openai\\.com|openai|perplexity|gemini\\.google|bard\\.google|copilot\\.microsoft|copilot\\.com|edgeservices\\.bing|claude\\.ai|anthropic|meta\\.ai|grok\\.com|x\\.ai|deepseek|you\\.com|phind|poe\\.com|mistral|kagi\\.com).*';

function aiPlatformOf_(source){
  const s = String(source || '');
  for (const [re, name] of AIV_PLATFORM_RULES_) if (re.test(s)) return name;
  return null;
}

/* Key events by name from AI visitors: date × source × landing page × event name.
   Returns rows [date, platform, page, eventName, count]. */
function fetchAiKeyEvents_(propertyId, startDate, endDate){
  const out = [];
  let offset = 0;
  while (true){
    const res = AnalyticsData.Properties.runReport({
      dateRanges: [{startDate: startDate, endDate: endDate}],
      dimensions: [{name: 'date'}, {name: 'sessionSource'}, {name: 'landingPage'}, {name: 'eventName'}],
      metrics: [{name: 'keyEvents'}],
      dimensionFilter: {filter: {fieldName: 'sessionSource',
        stringFilter: {matchType: 'FULL_REGEXP', value: AIV_SOURCE_REGEX_, caseSensitive: false}}},
      metricFilter: {filter: {fieldName: 'keyEvents',
        numericFilter: {operation: 'GREATER_THAN', value: {int64Value: '0'}}}},
      limit: 10000, offset: offset
    }, 'properties/' + String(propertyId).replace(/\D/g, ''));
    const rows = res.rows || [];
    rows.forEach(r => {
      const d = r.dimensionValues.map(v => v.value);
      const platform = aiPlatformOf_(d[1]);
      const n = Math.round(Number(r.metricValues[0].value) || 0);
      if (!platform || !n) return;
      out.push([d[0].slice(0, 4) + '-' + d[0].slice(4, 6) + '-' + d[0].slice(6, 8), platform, d[2] || '(not set)', d[3], n]);
    });
    offset += rows.length;
    if (!rows.length || offset >= (res.rowCount || 0)) break;
  }
  return out;
}

/* Stored in its own sheet tab, one row per date × platform × page × event. */
const AIV_KE_SHEET_ = 'Key events';
function keSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(AIV_KE_SHEET_);
  if (!sh){
    sh = ss.insertSheet(AIV_KE_SHEET_);
    sh.getRange(1, 1, 1, 6).setValues([['domain', 'date', 'platform', 'page', 'event', 'count']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Replaces this client's rows from startDate on (the range the import covered),
   keeping its older history and every other client's rows. */
function saveKeyEvents_(domain, rows, startDate){
  const sh = keSheet_();
  const last = sh.getLastRow();
  const from = startDate || rows.map(r => r[0]).sort()[0] || '9999-12-31';
  let keep = [];
  if (last > 1){
    keep = sh.getRange(2, 1, last - 1, 6).getDisplayValues()
      .filter(r => r[0] !== domain || r[1] < from);
  }
  const all = keep.concat(rows.map(r => [domain].concat(r)));
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  if (all.length){
    sh.getRange(2, 2, all.length, 1).setNumberFormat('@');   /* keep dates as text */
    sh.getRange(2, 1, all.length, 6).setValues(all);
  }
}

function readKeyEvents_(domain){
  const sh = SpreadsheetApp.getActive().getSheetByName(AIV_KE_SHEET_);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getDisplayValues()
    .filter(r => r[0] === domain)
    .map(r => [r[1], r[2], r[3], r[4], Number(r[5]) || 0]);
}

/* ---------- 2. feed cache ---------- */

/* CacheService holds 100 KB per key, so a feed is split into chunks. Six hours
   is the longest Apps Script allows; imports clear it sooner. */
const AIV_CACHE_TTL_ = 6 * 3600, AIV_CHUNK_ = 90000;

function cachedFeed_(domain, build){
  const cache = CacheService.getScriptCache();
  const base = 'aivfeed:' + domain;
  const head = cache.get(base);
  if (head){
    const n = Number(head);
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(base + ':' + i);
    const parts = cache.getAll(keys);
    if (keys.every(k => parts[k] != null)){
      try{ return JSON.parse(keys.map(k => parts[k]).join('')); }catch(e){}
    }
  }
  const feed = build();
  try{
    const json = JSON.stringify(feed);
    const put = {};
    let n = 0;
    for (let i = 0; i < json.length; i += AIV_CHUNK_) put[base + ':' + (n++)] = json.slice(i, i + AIV_CHUNK_);
    if (n <= 40){   /* skip caching anything over ~3.6 MB */
      cache.putAll(put, AIV_CACHE_TTL_);
      cache.put(base, String(n), AIV_CACHE_TTL_);
    }
  }catch(e){}
  return feed;
}

function clearFeedCache_(domain){
  CacheService.getScriptCache().remove('aivfeed:' + domain);
}

/* Optional: run from a time-driven trigger (every 4 hours) to keep every
   client's feed cached. Replace listClientDomains_() and buildFeed() with the
   tracker's own functions. */
function warmFeeds_(){
  listClientDomains_().forEach(domain => {
    try{ clearFeedCache_(domain); cachedFeed_(domain, () => buildFeed(domain)); }catch(e){ console.warn('warm ' + domain + ': ' + e); }
  });
}
