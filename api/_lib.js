/* Shared helpers for the API functions (files starting with "_" are not endpoints on Vercel).
   Orders are kept in Upstash Redis (free tier), added from Vercel → Storage → Upstash for Redis.
   That integration sets KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN). */
// Finds the Upstash settings whatever Vercel named them (any "Custom Prefix", KV_/UPSTASH_ names,
// or only a redis:// connection string, from which the REST address + token are derived).
function creds() {
  const E = process.env, keys = Object.keys(E);
  const pick = re => keys.find(k => re.test(k) && E[k]);
  let url = E[pick(/(^|_)KV_REST_API_URL$/) || pick(/(^|_)UPSTASH_REDIS_REST_URL$/) || pick(/REST_API_URL$|REST_URL$/)] || '';
  let tok = E[pick(/(^|_)KV_REST_API_TOKEN$/) || pick(/(^|_)UPSTASH_REDIS_REST_TOKEN$/) || pick(/^(?!.*READ_ONLY).*REST_API_TOKEN$|^(?!.*READ_ONLY).*REST_TOKEN$/)] || '';
  if (!url) { const k = keys.find(n => /^https:\/\/[^\s]+\.upstash\.io\/?$/.test(E[n] || '')); if (k) url = E[k]; }
  if (!url || !tok) {
    const k = keys.find(n => /^rediss?:\/\/[^:]*:[^@]+@[^:\/]+\.upstash\.io/.test(E[n] || ''));
    if (k) { const m = E[k].match(/^rediss?:\/\/[^:]*:([^@]+)@([^:\/]+)/); if (!url) url = 'https://' + m[2]; if (!tok) tok = decodeURIComponent(m[1]); }
  }
  return { url, tok };
}
const RURL = () => creds().url;
const RTOK = () => creds().tok;
// names only (never values) of settings that look database-related, for the setup screen
const dbHint = () => Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH|STORAGE/i.test(k)).sort();
const hasDb = () => !!(RURL() && RTOK());

/* run several Redis commands in one request: pipe([['GET','k'], ['SET','k','v']]) → [results] */
async function pipe(cmds) {
  const r = await fetch(RURL().replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + RTOK(), 'Content-Type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('Database error ' + r.status);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

const K = { list: 'ak:orders', order: id => 'ak:order:' + id, rate: ip => 'ak:rl:' + ip };

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };

module.exports = { hasDb, pipe, K, readBody, send, dbHint };
