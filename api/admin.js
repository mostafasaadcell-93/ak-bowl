/* AK Bowl owner panel: server side (a Vercel Function, free tier).
   The owner signs in with a normal password. The GitHub key never leaves the server.

   Set these in Vercel → Project → Settings → Environment Variables, then redeploy:
     ADMIN_PASSWORD  the owner's password (e.g. a 10+ character phrase)
     GITHUB_TOKEN    fine-grained GitHub token: only the ak-bowl repo, "Contents: Read and write"
     GITHUB_REPO     optional, default "mostafasaadcell-93/ak-bowl"
     GITHUB_BRANCH   optional, default "main"

   Actions (POST JSON): login {password} → {session} · load {session} → {dataText}
                        publish {session, data, files:[{path, content(base64)}], message} → {ok}
                        orders {session} → {configured, orders[]} · setStatus {session, id, status} · deleteOrder {session, id}
   Orders need the free Upstash Redis database (Vercel → Storage), see api/_lib.js. */
const crypto = require('crypto');
const db = require('./_lib');
const STATUSES = ['new', 'confirmed', 'delivered', 'cancelled'];

const REPO = process.env.GITHUB_REPO || 'mostafasaadcell-93/ak-bowl';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DAYS = 30;

const secret = () => crypto.createHash('sha256').update('akbowl|' + process.env.ADMIN_PASSWORD + '|' + process.env.GITHUB_TOKEN).digest();
const sign = exp => crypto.createHmac('sha256', secret()).update(String(exp)).digest('base64url');
const makeSession = () => { const exp = Date.now() + DAYS * 864e5; return exp + '.' + sign(exp); };
function validSession(s) {
  if (typeof s !== 'string' || !s.includes('.')) return false;
  const [exp, sig] = s.split('.'), good = sign(exp);
  return +exp > Date.now() && sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function samePassword(a) {
  const x = crypto.createHash('sha256').update(String(a || '')).digest(), y = crypto.createHash('sha256').update(String(process.env.ADMIN_PASSWORD)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function gh(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'akbowl-owner-panel', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) {} const err = new Error(`GitHub ${r.status}: ${m}`); err.status = r.status; throw err; }
  return r.json();
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) return send(res, 503, { error: 'The owner panel is not set up yet (missing ADMIN_PASSWORD or GITHUB_TOKEN in Vercel).' });
  let body; try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
  try {
    if (body.action === 'login') {
      if (!samePassword(body.password)) { await wait(900); return send(res, 401, { error: 'Wrong password.' }); }
      return send(res, 200, { session: makeSession(), days: DAYS });
    }
    if (!validSession(body.session)) return send(res, 401, { error: 'Please sign in again.' });

    if (body.action === 'load') {
      const f = await gh(`/repos/${REPO}/contents/data.js?ref=${encodeURIComponent(BRANCH)}`);
      return send(res, 200, { dataText: Buffer.from(f.content, 'base64').toString('utf8') });
    }

    if (body.action === 'publish') {
      const data = String(body.data || '');
      if (!/\/\*AK-CONFIG-START\*\/[\s\S]+\/\*AK-CONFIG-END\*\//.test(data)) return send(res, 400, { error: 'Settings file looks broken, nothing was published.' });
      const files = Array.isArray(body.files) ? body.files : [];
      if (files.some(f => !/^assets\/photos\/[a-z0-9-]+\.(webp|jpg)$/.test(f.path))) return send(res, 400, { error: 'Unexpected file name.' });
      const R = `/repos/${REPO}`;
      const ref = await gh(`${R}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
      const head = await gh(`${R}/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const f of files) {
        const b = await gh(`${R}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: f.content, encoding: 'base64' }) });
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
      }
      const db = await gh(`${R}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: Buffer.from(data, 'utf8').toString('base64'), encoding: 'base64' }) });
      tree.push({ path: 'data.js', mode: '100644', type: 'blob', sha: db.sha });
      const t = await gh(`${R}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      let who; try { const u = await gh('/user'); who = { name: u.login, email: `${u.id}+${u.login}@users.noreply.github.com` }; } catch (e) {}
      const msg = 'Owner panel: ' + String(body.message || 'update').slice(0, 200);
      const c = await gh(`${R}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: t.sha, parents: [ref.object.sha], ...(who ? { author: who, committer: who } : {}) }) });
      await gh(`${R}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
      return send(res, 200, { ok: true, commit: c.sha.slice(0, 7) });
    }
    if (body.action === 'orders') {
      if (!db.hasDb()) return send(res, 200, { configured: false, orders: [], found: db.dbHint() });
      const [ids] = await db.pipe([['ZREVRANGE', db.K.list, 0, 499]]);
      if (!ids.length) return send(res, 200, { configured: true, orders: [] });
      const [raw] = await db.pipe([['MGET', ...ids.map(db.K.order)]]);
      return send(res, 200, { configured: true, orders: raw.filter(Boolean).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean) });
    }
    if (body.action === 'setStatus' || body.action === 'deleteOrder') {
      if (!db.hasDb()) return send(res, 503, { error: 'Order tracking is not set up.' });
      const id = String(body.id || '').replace(/[^a-z0-9]/g, '');
      if (body.action === 'deleteOrder') { await db.pipe([['DEL', db.K.order(id)], ['ZREM', db.K.list, id]]); return send(res, 200, { ok: true }); }
      if (!STATUSES.includes(body.status)) return send(res, 400, { error: 'Unknown status' });
      const [s] = await db.pipe([['GET', db.K.order(id)]]);
      if (!s) return send(res, 404, { error: 'Order not found' });
      const o = JSON.parse(s); o.status = body.status; o.statusAt = Date.now();
      await db.pipe([['SET', db.K.order(id), JSON.stringify(o)]]);
      return send(res, 200, { ok: true, order: o });
    }
    return send(res, 400, { error: 'Unknown action' });
  } catch (e) {
    if (['orders', 'setStatus', 'deleteOrder'].includes(body.action)) return send(res, 502, { error: 'Couldn\'t reach the orders database. Try again in a minute.' });
    const auth = e.status === 401 || e.status === 403 || e.status === 404;
    return send(res, 502, { error: auth ? 'The website\'s GitHub key is not working (expired or missing permission). Ask your web developer to renew it.' : 'Couldn\'t reach GitHub. Try again in a minute.' });
  }
};
