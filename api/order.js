/* Saves a website order for the owner's tracker (called by the site when the customer taps
   "Send order on WhatsApp"). Public endpoint, so everything is validated, trimmed and rate-limited.
   If no database is connected it answers 503 and the site just carries on with WhatsApp. */
const crypto = require('crypto');
const { hasDb, pipe, K, readBody, send } = require('./_lib');

const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const num = (v, max = 100000) => { const x = +v; return Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x * 100) / 100 : 0; };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  if (!hasDb()) return send(res, 503, { error: 'Order tracking is not set up' });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: 'Bad request' }); }

  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map(i => ({ id: str(i.id, 40), name: str(i.name, 40), qty: Math.max(1, Math.min(99, parseInt(i.qty, 10) || 1)), price: num(i.price, 1000) })).filter(i => i.name);
  const o = {
    no: str(b.no, 16) || 'AK-' + Math.floor(1000 + Math.random() * 9000),
    name: str(b.name, 60), phone: str(b.phone, 30), address: str(b.address, 200), notes: str(b.notes, 300),
    items, cups: items.reduce((s, i) => s + i.qty, 0),
    full: num(b.full), save: num(b.save), promo: b.promo ? { code: str(b.promo.code, 20), off: num(b.promo.off, 100), disc: num(b.promo.disc) } : null,
    fee: b.fee == null ? null : num(b.fee, 1000), total: num(b.total), test: !!b.test,
  };
  if (!o.items.length || !o.name || o.phone.replace(/\D/g, '').length < 7) return send(res, 400, { error: 'Incomplete order' });

  // light spam protection: at most 15 orders per hour from the same connection
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
  const ipKey = K.rate(crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16));
  try {
    const [count] = await pipe([['INCR', ipKey]]);
    if (count === 1) await pipe([['EXPIRE', ipKey, 3600]]);
    if (count > 15 && !b.test) return send(res, 429, { error: 'Too many orders' });
    // the same order retried from a phone is only saved once
    const cid = String(b.cid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    if (cid) { const [fresh] = await pipe([['SET', 'ak:cid:' + cid, '1', 'NX', 'EX', 172800]]); if (!fresh) return send(res, 200, { ok: true, duplicate: true }); }
    const at = Date.now(), id = at.toString(36) + crypto.randomBytes(3).toString('hex');
    await pipe([['SET', K.order(id), JSON.stringify({ id, at, status: 'new', ...o })], ['ZADD', K.list, at, id]]);
    return send(res, 200, { ok: true, id });
  } catch (e) {
    return send(res, 502, { error: 'Could not save the order: ' + String(e.message || e).slice(0, 200) });
  }
};
