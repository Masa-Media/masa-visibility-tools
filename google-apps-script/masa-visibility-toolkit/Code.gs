/**
 * Masa Visibility Toolkit — Google Sheets custom functions for on-page SEO,
 * GEO / AI-visibility and structured-data checks, straight from a spreadsheet.
 *
 * By Masa Media Digital LTD — https://masamedia.co.il
 * License: MIT
 *
 * Usage in a cell:
 *   =MASA_TITLE("https://example.com")
 *   =MASA_STATUS(A2)
 *   =MASA_AI_ACCESS(A2, "GPTBot")
 */

/** @constant */
var MASA_UA = 'MasaVisibilityToolkit/0.1 (+https://masamedia.co.il)';

/**
 * Adds a small helper menu when a spreadsheet is opened.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Masa Visibility')
    .addItem('About', 'masaAbout_')
    .addToUi();
}

function masaAbout_() {
  SpreadsheetApp.getUi().alert(
    'Masa Visibility Toolkit',
    'On-page SEO and AI-visibility functions for Sheets, by Masa Media Digital LTD.\n\n' +
      'Try: =MASA_TITLE(url), =MASA_DESCRIPTION(url), =MASA_CANONICAL(url), =MASA_H1(url),\n' +
      '=MASA_STATUS(url), =MASA_INDEXABLE(url), =MASA_SCHEMA_TYPES(url), =MASA_AI_ACCESS(url, "GPTBot").\n\n' +
      'https://masamedia.co.il',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ---- fetch helpers (cached per URL for a minute) -----------------------

function masaFetch_(url) {
  if (!url) return { status: 0, body: '' };
  url = String(url).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var cache = CacheService.getScriptCache();
  var key = 'body:' + url;
  var cached = cache.get(key);
  if (cached) {
    var i = cached.indexOf('|');
    return { status: Number(cached.slice(0, i)), body: cached.slice(i + 1) };
  }
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': MASA_UA },
  });
  var status = res.getResponseCode();
  var body = res.getContentText();
  try {
    cache.put(key, status + '|' + body.slice(0, 90000), 60);
  } catch (e) {
    /* body too big to cache; ignore */
  }
  return { status: status, body: body };
}

function masaRobots_(url) {
  url = String(url).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var origin = url.match(/^https?:\/\/[^/]+/i);
  if (!origin) return '';
  var cache = CacheService.getScriptCache();
  var key = 'robots:' + origin[0];
  var cached = cache.get(key);
  if (cached !== null) return cached;
  var res = UrlFetchApp.fetch(origin[0] + '/robots.txt', {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': MASA_UA },
  });
  var body = res.getResponseCode() >= 200 && res.getResponseCode() < 300 ? res.getContentText() : '';
  try {
    cache.put(key, body.slice(0, 90000), 120);
  } catch (e) {}
  return body;
}

// ---- parsing helpers ---------------------------------------------------

function masaAttrs_(tag) {
  var attrs = {};
  var re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
  var m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
  }
  return attrs;
}

function masaMeta_(body, key, val) {
  var re = /<meta\b[^>]*>/gi;
  var m;
  while ((m = re.exec(body)) !== null) {
    var a = masaAttrs_(m[0]);
    if (a[key] && a[key].toLowerCase() === val) return a.content || '';
  }
  return '';
}

function masaDecode_(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- custom functions --------------------------------------------------

/**
 * HTTP status code returned by the URL.
 * @param {string} url The page URL.
 * @return {number} The HTTP status (e.g. 200, 404).
 * @customfunction
 */
function MASA_STATUS(url) {
  return masaFetch_(url).status;
}

/**
 * The page <title>.
 * @param {string} url The page URL.
 * @return {string} The title text.
 * @customfunction
 */
function MASA_TITLE(url) {
  var m = masaFetch_(url).body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? masaDecode_(m[1]) : '';
}

/**
 * The meta description.
 * @param {string} url The page URL.
 * @return {string} The description content.
 * @customfunction
 */
function MASA_DESCRIPTION(url) {
  return masaDecode_(masaMeta_(masaFetch_(url).body, 'name', 'description'));
}

/**
 * The canonical URL declared on the page.
 * @param {string} url The page URL.
 * @return {string} The canonical href, or "".
 * @customfunction
 */
function MASA_CANONICAL(url) {
  var re = /<link\b[^>]*>/gi;
  var body = masaFetch_(url).body;
  var m;
  while ((m = re.exec(body)) !== null) {
    var a = masaAttrs_(m[0]);
    if (a.rel && a.rel.toLowerCase().split(/\s+/).indexOf('canonical') !== -1) return a.href || '';
  }
  return '';
}

/**
 * The first H1 on the page.
 * @param {string} url The page URL.
 * @return {string} The H1 text.
 * @customfunction
 */
function MASA_H1(url) {
  var m = masaFetch_(url).body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? masaDecode_(m[1].replace(/<[^>]+>/g, ' ')) : '';
}

/**
 * Whether the page is indexable (no "noindex" in meta robots).
 * @param {string} url The page URL.
 * @return {boolean} TRUE if indexable.
 * @customfunction
 */
function MASA_INDEXABLE(url) {
  var robots = masaMeta_(masaFetch_(url).body, 'name', 'robots').toLowerCase();
  return robots.indexOf('noindex') === -1;
}

/**
 * Comma-separated JSON-LD schema types found on the page.
 * @param {string} url The page URL.
 * @return {string} e.g. "Organization, WebSite".
 * @customfunction
 */
function MASA_SCHEMA_TYPES(url) {
  var body = masaFetch_(url).body;
  var re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var types = {};
  var m;
  while ((m = re.exec(body)) !== null) {
    try {
      masaCollectTypes_(JSON.parse(m[1]), types);
    } catch (e) {
      /* invalid block, skip */
    }
  }
  return Object.keys(types).join(', ');
}

function masaCollectTypes_(node, out) {
  if (node && node.constructor === Array) {
    for (var i = 0; i < node.length; i++) masaCollectTypes_(node[i], out);
  } else if (node && typeof node === 'object') {
    var t = node['@type'];
    if (typeof t === 'string') out[t] = true;
    else if (t && t.constructor === Array) for (var j = 0; j < t.length; j++) out[t[j]] = true;
    if (node['@graph']) masaCollectTypes_(node['@graph'], out);
  }
}

/**
 * Whether an AI crawler is allowed by robots.txt: "allowed", "blocked",
 * "partial" or "unspecified".
 * @param {string} url The page URL.
 * @param {string} agent The crawler token, e.g. "GPTBot", "ClaudeBot", "Google-Extended".
 * @return {string} The access level.
 * @customfunction
 */
function MASA_AI_ACCESS(url, agent) {
  if (!agent) return 'unspecified';
  var groups = masaParseRobots_(masaRobots_(url));
  var named = masaFindGroup_(groups, String(agent).toLowerCase());
  var wildcard = masaFindGroup_(groups, '*');
  return masaAccess_(named || wildcard);
}

function masaParseRobots_(body) {
  var groups = [];
  var current = null;
  var lastAgent = false;
  var lines = String(body).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/#.*$/, '').trim();
    if (!line) continue;
    var idx = line.indexOf(':');
    if (idx === -1) continue;
    var field = line.slice(0, idx).trim().toLowerCase();
    var value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastAgent = true;
      continue;
    }
    lastAgent = false;
    if (!current) continue;
    if (field === 'disallow') current.disallow.push(value);
    else if (field === 'allow') current.allow.push(value);
  }
  return groups;
}

function masaFindGroup_(groups, agent) {
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].agents.indexOf(agent) !== -1) return groups[i];
  }
  return null;
}

function masaAccess_(group) {
  if (!group) return 'unspecified';
  var rootDisallow = group.disallow.indexOf('/') !== -1;
  var allowsRoot = group.allow.indexOf('/') !== -1;
  if (rootDisallow && !allowsRoot) return 'blocked';
  for (var i = 0; i < group.disallow.length; i++) {
    if (group.disallow[i] && group.disallow[i] !== '') return 'partial';
  }
  return 'allowed';
}
