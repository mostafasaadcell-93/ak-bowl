/* Shared helpers for the API functions (files starting with "_" are not endpoints on Vercel).
   Orders are kept in Upstash Redis (free tier), added from Vercel → Storage → Upstash for Redis.
   That integration sets KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN). */
const RURL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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
