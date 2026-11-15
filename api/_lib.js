/* Shared helpers for the API functions (files starting with "_" are not endpoints on Vercel).
   Orders are kept in Upstash Redis (free tier), added from Vercel → Storage → Upstash for Redis.
   That integration sets KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN). */
// works with any "Custom Prefix" chosen in Vercel (e.g. STORAGE_KV_REST_API_URL)
const env = suffixes => { for (const s of suffixes) { if (process.env[s]) return process.env[s]; const k = Object.keys(process.env).find(n => n.endsWith('_' + s)); if (k) return process.env[k]; } return ''; };
const RURL = () => env(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const RTOK = () => env(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
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

module.exports = { hasDb, pipe, K, readBody, send };
