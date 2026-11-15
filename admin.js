/* AK Bowl owner panel.
   Reads the website settings (data.js), lets the owner edit them, and publishes by committing
   data.js (+ any new photos) to the website's GitHub repo in ONE commit. Vercel then redeploys
   the site automatically (about a minute).
   The owner signs in with a normal password. The GitHub key lives only on the server (api/admin.js,
   a Vercel Function), so it never reaches anyone's phone. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + (Number.isInteger(+n) ? +n : (+n).toFixed(2));
const clone = o => JSON.parse(JSON.stringify(o));
const SESSION_KEY = 'akbowl-admin-session', DRAFT_KEY = 'akbowl-admin-draft';
const IC = {
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10l4.5-4.5 4.5 4.5"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6l4.5 4.5 4.5-4.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 2.5v11M2.5 8h11"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

/* ================= STATE ================= */
let session = null;       // signed session from api/admin (30 days), or null in demo mode
let demo = false;
let dataText = '';        // data.js as published (keeps its header comment)
let base = '';            // published config as JSON (to detect changes)
let cfg = null;           // the config being edited
let files = {};           // new photos waiting to publish: { pid: { full, sm, ext } } (data URLs)
let page = 'orders';
let dbFound = [];
let orders = null, ordersOn = true, ofilter = 'new', oq = '', knownIds = null;
const PUBLISHED = {};      // photos published this session (shown from memory until Vercel redeploys)

const dirty = () => JSON.stringify(cfg) !== base || Object.keys(files).length > 0;
function changed() {
  const d = dirty();
  $('#status').textContent = d ? 'Unpublished changes' : (demo ? 'Demo mode' : 'All published');
  $('#status').classList.toggle('dirty', d);
  $('#publishBtn').disabled = !d;
  saveDraft();
}
let draftT;
function saveDraft() {
  clearTimeout(draftT);
  draftT = setTimeout(() => {
    try {
      if (!dirty()) { localStorage.removeItem(DRAFT_KEY); return; }
      const photos = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.sm]));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ base, config: cfg, photos, files }));
    } catch (e) { toast('Too many new photos to keep as a draft. Publish soon!'); }
  }, 250);
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.base === base && d.config) { cfg = d.config; files = d.files || {}; toast('Restored your unpublished changes'); }
  } catch (e) {}
}

/* ================= SERVER (api/admin.js) ================= */
const enc = s => { const b = new TextEncoder().encode(s); let out = ''; for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(out); };
async function api(body) {
  let r;
  try { r = await fetch('api/admin', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (e) { throw new Error('No internet connection. Try again.'); }
  let j = {}; try { j = await r.json(); } catch (e) { j = { error: r.status === 404 ? 'The owner panel server isn\'t set up on this website yet.' : 'Something went wrong (' + r.status + ').' }; }
  if (!r.ok) { const err = new Error(j.error || 'Something went wrong.'); err.status = r.status; throw err; }
  return j;
}
const parseCfg = text => { const m = text.match(/\/\*AK-CONFIG-START\*\/([\s\S]*?)\/\*AK-CONFIG-END\*\//); if (!m) throw new Error('data.js is missing the AK-CONFIG markers.'); return JSON.parse(m[1]); };
const buildDataJs = c => dataText.replace(/\/\*AK-CONFIG-START\*\/[\s\S]*?\/\*AK-CONFIG-END\*\//, () => '/*AK-CONFIG-START*/' + JSON.stringify(c, null, 1) + '/*AK-CONFIG-END*/');
async function loadSettings() {
  const j = await api({ action: 'load', session });
  dataText = j.dataText; cfg = parseCfg(dataText); base = JSON.stringify(cfg); files = {};
}
function signedOut(msg) {
  session = null; try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = msg || '';
}

/* ================= LOGIN ================= */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('#pw').value;
  $('#loginErr').textContent = '';
  if (!password) { $('#loginErr').textContent = 'Type your password first.'; $('#pw').focus(); return; }
  $('#loginBtn').disabled = true; $('#loginBtn').textContent = 'Signing in…';
  try {
    session = (await api({ action: 'login', password })).session;
    try { localStorage.setItem(SESSION_KEY, session); } catch (er) {}
    await loadSettings(); $('#pw').value = ''; demo = false; start();
  } catch (er) { session = null; $('#loginErr').textContent = er.message; }
  $('#loginBtn').disabled = false; $('#loginBtn').textContent = 'Sign in';
});
function start() {
  loadDraft();
  $('#login').hidden = true; $('#app').hidden = false;
  $('#whoTxt').textContent = demo ? 'Demo, changes are not saved' : 'Signed in';
  go(page); changed(); refreshOrders(true);
}
(async function boot() {
  try { session = localStorage.getItem(SESSION_KEY); } catch (e) {}
  if (!session) return;
  try { await loadSettings(); start(); } catch (e) { signedOut(e.status === 401 ? 'Please sign in again.' : e.message); }
})();

/* ================= NAV ================= */
$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); });
function go(p) {
  page = p; $$('#nav [data-p]').forEach(b => b.setAttribute('aria-current', b.dataset.p === p ? 'page' : 'false'));
  PAGES[p](); scrollTo({ top: 0 });
}
const sw = (id, on, label, cls = '') => `<button type="button" class="sw ${cls}" role="switch" aria-checked="${!!on}" id="${id}" aria-label="${esc(label)}"></button>`;
const photoSrc = f => !f.photo ? 'assets/photos/scoop-sm.webp' : files[f.photo] ? files[f.photo].sm : PUBLISHED[f.photo] || `assets/photos/${f.photo}-sm.${f.ext || 'webp'}`;
const visible = () => cfg.flavors.filter(f => !f.hidden);
function demoNote() { return demo ? '<p class="demo-note"><b>Demo mode.</b> Look around and try anything. To really change the website, sign in with the owner password.</p>' : ''; }

/* ================= PAGES ================= */
const PAGES = {
  home() {
    const vis = visible(), out = vis.filter(f => f.soldOut).length, promos = (cfg.promos || []).filter(p => p.on).length;
    $('#page').innerHTML = `${demoNote()}<h2>Today</h2><p class="lead">The quick switches you'll use most. Change what you need, then tap <b>Publish</b>.</p>
      <div class="grid4" style="margin-bottom:16px">
        <div class="stat"><b>${vis.length}</b><span>Flavors on the menu</span></div>
        <div class="stat"><b style="color:${out ? 'var(--bad)' : 'inherit'}">${out}</b><span>Sold out</span></div>
        <div class="stat"><b>${money(cfg.price)}</b><span>Per cup</span></div>
        <div class="stat"><b>${promos}</b><span>Active promo codes</span></div>
      </div>
      <div class="grid2">
        <div class="card"><div class="bigsw">${sw('swOpen', cfg.open, 'Taking orders')}<div class="t"><b>${cfg.open ? '<span class="dot" style="background:var(--ok)"></span>Taking orders' : '<span class="dot" style="background:var(--bad)"></span>Orders paused'}</b><span class="hint">${cfg.open ? 'Customers can order on the website.' : 'People can browse, but checkout is off.'}</span></div></div>
          <div class="field"><label for="closedMsg">Message when orders are paused</label><input id="closedMsg" value="${esc(cfg.closedMsg)}" maxlength="90"></div></div>
        <div class="card"><div class="row"><div class="grow"><h3>Top banner</h3><p class="hint">A bar across the top of the website, for offers and news.</p></div>${sw('swBan', cfg.banner.on, 'Show banner')}</div>
          <div class="field"><label for="banTxt">Banner text</label><input id="banTxt" value="${esc(cfg.banner.text)}" maxlength="90" placeholder="e.g. New flavor: Oreo is here!"></div>
          <div class="annprev" id="annPrev"></div></div>
      </div>
      <div class="card"><h3>Sold out today</h3><p class="hint">Tap a flavor to mark it sold out. Tap again when it's back.</p>
        <div class="chips" id="soChips">${vis.map(f => `<button type="button" class="chip" data-so="${f.id}" aria-pressed="${!!f.soldOut}" style="--c:${f.lid}"><i></i>${esc(f.name)}</button>`).join('')}</div></div>`;
    const annPrev = () => { const el = $('#annPrev'), closed = !cfg.open, t = closed ? cfg.closedMsg : cfg.banner.text; el.textContent = t || ' '; el.className = 'annprev' + (closed ? ' closed' : '') + (!closed && !cfg.banner.on ? ' off' : ''); };
    annPrev();
    $('#swOpen').onclick = () => { cfg.open = !cfg.open; changed(); PAGES.home(); };
    $('#swBan').onclick = () => { cfg.banner.on = !cfg.banner.on; changed(); $('#swBan').setAttribute('aria-checked', cfg.banner.on); annPrev(); };
    $('#closedMsg').oninput = e => { cfg.closedMsg = e.target.value; changed(); annPrev(); };
    $('#banTxt').oninput = e => { cfg.banner.text = e.target.value; changed(); annPrev(); };
    $('#soChips').onclick = e => { const b = e.target.closest('[data-so]'); if (!b) return; const f = cfg.flavors.find(x => x.id === b.dataset.so); f.soldOut = !f.soldOut; changed(); PAGES.home(); toast(`${f.name} ${f.soldOut ? 'marked sold out' : 'is back'}`); };
  },

  flavors() {
    $('#page').innerHTML = `${demoNote()}<div class="row" style="align-items:flex-end;margin-bottom:6px"><div class="grow"><h2>Flavors</h2></div><button class="btn sm" type="button" id="addF">${IC.plus} Add flavor</button></div>
      <p class="lead">Edit names, nutrition, photos and colors. Use the arrows to change the order on the website.</p>
      <div class="fl" id="fl">${cfg.flavors.map((f, i) => `<div class="fitem${f.hidden ? ' hid' : ''}" style="--c:${f.lid}">
        <div class="ord"><button type="button" data-mv="${i}" data-d="-1" aria-label="Move ${esc(f.name)} up" ${i ? '' : 'disabled'}>${IC.up}</button><button type="button" data-mv="${i}" data-d="1" aria-label="Move ${esc(f.name)} down" ${i < cfg.flavors.length - 1 ? '' : 'disabled'}>${IC.down}</button></div>
        <img src="${photoSrc(f)}" alt="">
        <div><b>${esc(f.name)}</b><small>${f.p} g protein${f.k != null ? ` · ${f.k} kcal` : ''}</small>
          <div class="tags">${f.soldOut ? '<span class="tg out">Sold out</span>' : ''}${f.isNew ? '<span class="tg new">New</span>' : ''}${f.hidden ? '<span class="tg hid">Hidden</span>' : ''}</div></div>
        <div class="acts"><span class="hint">Sold out</span>${sw('so-' + f.id, f.soldOut, f.name + ' sold out', 'red')}<button class="btn ghost sm" type="button" data-ed="${f.id}">Edit</button></div></div>`).join('')}</div>`;
    $('#addF').onclick = () => editor(null);
    $('#fl').onclick = e => {
      const mv = e.target.closest('[data-mv]'), ed = e.target.closest('[data-ed]'), s = e.target.closest('.sw');
      if (mv) { const i = +mv.dataset.mv, j = i + +mv.dataset.d; [cfg.flavors[i], cfg.flavors[j]] = [cfg.flavors[j], cfg.flavors[i]]; changed(); PAGES.flavors(); }
      if (ed) editor(ed.dataset.ed);
      if (s) { const f = cfg.flavors.find(x => 'so-' + x.id === s.id); f.soldOut = !f.soldOut; changed(); PAGES.flavors(); }
    };
  },

  prices() {
    $('#page').innerHTML = `${demoNote()}<h2>Prices &amp; delivery</h2><p class="lead">All prices are in US dollars. The website does the box-deal math automatically.</p>
      <div class="card"><h3>Cups &amp; the box deal</h3>
        <div class="fields3">
          <div class="field"><label for="pCup">One cup</label><div class="pre"><span>$</span><input id="pCup" type="number" inputmode="decimal" min="0.25" step="0.25" value="${cfg.price}"></div></div>
          <div class="field"><label for="pN">Cups in a box</label><input id="pN" type="number" inputmode="numeric" min="2" max="30" step="1" value="${cfg.box.size}"></div>
          <div class="field"><label for="pBox">Box price</label><div class="pre"><span>$</span><input id="pBox" type="number" inputmode="decimal" min="1" step="0.5" value="${cfg.box.price}"></div></div>
        </div><div class="calc" id="calc"></div></div>
      <div class="card"><h3>Delivery fee</h3><p class="hint">For orders smaller than a box (boxes always get free delivery). Leave it empty and the website says "confirmed on WhatsApp".</p>
        <div class="field" style="max-width:220px"><label for="pFee">Fee</label><div class="pre"><span>$</span><input id="pFee" type="number" inputmode="decimal" min="0" step="0.5" value="${cfg.delivery.fee ?? ''}" placeholder="—"></div></div></div>`;
    const calc = () => {
      const c = cfg.price, n = cfg.box.size, b = cfg.box.price, ex = n + 3, tot = b + 3 * c, s = n * c - b;
      $('#calc').innerHTML = `1 cup = <b>${money(c)}</b> · ${n} cups = <b>${money(b)}</b> ${s > 0 ? `(save ${money(s)})` : '<span style="color:var(--bad)">(no saving, the box costs the same or more than single cups!)</span>'} · ${ex} cups = <b>${money(tot)}</b>`;
    };
    calc();
    const num = (el, fn) => { el.oninput = () => { const v = parseFloat(el.value); if (!isNaN(v)) { fn(v); changed(); calc(); } }; };
    num($('#pCup'), v => cfg.price = Math.max(0, Math.round(v * 100) / 100));
    num($('#pN'), v => cfg.box.size = Math.max(2, Math.min(30, Math.round(v))));
    num($('#pBox'), v => cfg.box.price = Math.max(0, Math.round(v * 100) / 100));
    $('#pFee').oninput = e => { const v = e.target.value.trim(); cfg.delivery.fee = v === '' ? null : Math.max(0, Math.round(parseFloat(v) * 100) / 100); changed(); };
  },

  promos() {
    cfg.promos = cfg.promos || [];
    $('#page').innerHTML = `${demoNote()}<div class="row" style="align-items:flex-end;margin-bottom:6px"><div class="grow"><h2>Promo codes</h2></div><button class="btn sm" type="button" id="addP">${IC.plus} New code</button></div>
      <p class="lead">Customers type the code in their cart and get a % off their cups. Share codes on Instagram, with gyms or with influencers.</p>
      <div class="card" id="pl">${cfg.promos.length ? cfg.promos.map((p, i) => `<div class="prow">
        <div class="field"><label for="pc${i}">Code</label><input id="pc${i}" data-pc="${i}" value="${esc(p.code)}" maxlength="20" autocapitalize="characters" style="text-transform:uppercase"></div>
        <div class="field"><label for="po${i}">% off</label><input id="po${i}" data-po="${i}" type="number" inputmode="numeric" min="1" max="90" value="${p.off}"></div>
        <div style="padding-bottom:8px">${sw('pon' + i, p.on, p.code + ' active')}</div>
        <button type="button" class="iconbtn del" data-pd="${i}" aria-label="Delete ${esc(p.code)}" style="margin-bottom:2px">${IC.trash}</button></div>`).join('') : '<p class="hint">No promo codes yet.</p>'}</div>`;
    $('#addP').onclick = () => { cfg.promos.push({ code: 'AK' + Math.floor(10 + Math.random() * 90), off: 10, on: true }); changed(); PAGES.promos(); };
    $('#pl').oninput = e => {
      const t = e.target;
      if (t.dataset.pc != null) { cfg.promos[+t.dataset.pc].code = t.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); changed(); }
      if (t.dataset.po != null) { const v = parseInt(t.value, 10); if (!isNaN(v)) { cfg.promos[+t.dataset.po].off = Math.max(1, Math.min(90, v)); changed(); } }
    };
    $('#pl').onclick = e => {
      const s = e.target.closest('.sw'), d = e.target.closest('[data-pd]');
      if (s) { const p = cfg.promos[+s.id.slice(3)]; p.on = !p.on; changed(); s.setAttribute('aria-checked', p.on); }
      if (d && confirmDel(`Delete code ${cfg.promos[+d.dataset.pd].code}?`)) { cfg.promos.splice(+d.dataset.pd, 1); changed(); PAGES.promos(); }
    };
  },

  store() {
    const local = String(cfg.whatsapp || '').replace(/^961/, '').replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
    $('#page').innerHTML = `${demoNote()}<h2>Store &amp; contact</h2><p class="lead">Where orders go, and your links.</p>
      <div class="card"><h3>WhatsApp for orders</h3><p class="hint">Every order and wholesale request opens WhatsApp to this number.</p>
        <div class="field" style="max-width:300px"><label for="wa">Lebanese number</label><div class="pre"><span>+961</span><input id="wa" type="tel" inputmode="tel" value="${esc(local)}" placeholder="70 426 400"></div><p class="err" id="waErr"></p></div></div>
      <div class="card"><h3>Instagram</h3><div class="field"><label for="ig">Profile link</label><input id="ig" type="url" value="${esc(cfg.instagram)}" placeholder="https://www.instagram.com/ak__bowl/"></div></div>
      <div class="card"><h3>Backup</h3><p class="hint">Download all your settings as a file, or restore them from one.</p>
        <div class="row" style="flex-wrap:wrap;margin-top:12px"><button class="btn ghost sm" type="button" id="dl">Download backup</button><label class="btn ghost sm" style="cursor:pointer">Restore backup<input type="file" accept="application/json,.json" id="ul" hidden></label><button class="btn ghost sm" type="button" id="discard">Discard unpublished changes</button></div></div>
      <div class="card"><h3>Account</h3><p class="hint">${demo ? 'Not signed in (demo mode).' : 'Signed in on this device. You stay signed in for 30 days.'}</p>
        <div class="row" style="margin-top:12px"><button class="btn ${demo ? '' : 'red'} sm" type="button" id="out">${demo ? 'Sign in' : 'Sign out on this device'}</button></div></div>`;
    $('#wa').oninput = e => { const d = e.target.value.replace(/\D/g, '').replace(/^961/, ''); $('#waErr').textContent = d.length >= 7 && d.length <= 8 ? '' : 'Lebanese numbers have 7 or 8 digits, e.g. 70 426 400.'; if (d.length >= 7 && d.length <= 8) { cfg.whatsapp = '961' + d; changed(); } };
    $('#ig').oninput = e => { cfg.instagram = e.target.value.trim(); changed(); };
    $('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })); a.download = `ak-bowl-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
    $('#ul').onchange = async e => { try { const c = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(c.flavors) || !c.box) throw 0; cfg = c; changed(); toast('Backup restored. Publish to make it live.'); go('home'); } catch (er) { toast('That file is not an AK Bowl backup.'); } };
    $('#discard').onclick = () => { if (!dirty()) { toast('Nothing to discard'); return; } if (confirmDel('Throw away all changes you haven\'t published?')) { cfg = JSON.parse(base); files = {}; changed(); toast('Changes discarded'); PAGES.store(); } };
    $('#out').onclick = () => { if (!demo && dirty() && !confirmDel('You have unpublished changes. Sign out anyway?')) return; try { localStorage.removeItem(SESSION_KEY); } catch (er) {} location.reload(); };
  },
};
const confirmDel = m => window.confirm(m);

/* ================= ORDERS (tracker) ================= */
const STAT = { new: 'New', confirmed: 'Confirmed', delivered: 'Delivered', cancelled: 'Cancelled' };
const time12 = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
function when(t) {
  const d = new Date(t), now = new Date(), mins = Math.round((now - d) / 6e4);
  const day = d.toDateString() === now.toDateString() ? 'Today' : new Date(now - 864e5).toDateString() === d.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day} ${time12(t)}${mins < 60 ? ` · ${mins < 1 ? 'just now' : mins + ' min ago'}` : ''}`;
}
const intl = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = d.slice(1); return d.length <= 8 ? '961' + d : d; };
async function refreshOrders(first) {
  if (!session) return;
  try {
    const j = await api({ action: 'orders', session });
    ordersOn = j.configured; orders = j.orders; dbFound = j.found || [];
    const ids = new Set(orders.map(o => o.id));
    if (knownIds && !first) { const fresh = orders.filter(o => !knownIds.has(o.id)); if (fresh.length) { toast(`🔔 ${fresh.length} new order${fresh.length > 1 ? 's' : ''}!`); try { navigator.vibrate && navigator.vibrate(200); } catch (e) {} } }
    knownIds = ids; badge();
    if (page === 'orders' && $('#modal').hidden && document.activeElement !== $('#oq')) PAGES.orders();
  } catch (e) { if (e.status === 401) signedOut('Please sign in again.'); }
}
function badge() {
  const n = (orders || []).filter(o => o.status === 'new').length;
  $('#ordBadge').hidden = !n; $('#ordBadge').textContent = n;
  document.title = (n ? `(${n}) ` : '') + 'AK Bowl · Owner panel';
}
setInterval(() => { if (!document.hidden) refreshOrders(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshOrders(); });
PAGES.orders = function () {
  if (!orders) { $('#page').innerHTML = '<h2>Orders</h2><p class="lead">Loading orders…</p>'; return; }
  if (!ordersOn) {
    $('#page').innerHTML = `<h2>Orders</h2><div class="card"><h3>Connect the orders database</h3><p class="hint" style="margin-top:6px">Order tracking needs a free database. Ask your web developer to connect it (Vercel → Storage → Upstash for Redis → Connect to this project → Redeploy). After that, every website order shows up here.</p><p class="hint" style="margin-top:10px;font-size:12px">Database settings found on the server: ${dbFound.length ? dbFound.map(esc).join(', ') : 'none yet (redeploy after connecting the database)'}</p></div>`; return;
  }
  const live = orders.filter(o => o.status !== 'cancelled');
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const sum = arr => arr.reduce((s, o) => s + (o.total || 0), 0);
  const today = live.filter(o => o.at >= +midnight), week = live.filter(o => o.at >= Date.now() - 7 * 864e5);
  const month = live.filter(o => o.at >= Date.now() - 30 * 864e5), fc = {};
  month.forEach(o => o.items.forEach(i => { fc[i.name] = (fc[i.name] || 0) + i.qty; }));
  const top = Object.entries(fc).sort((a, b) => b[1] - a[1]).slice(0, 5), topMax = top.length ? top[0][1] : 1;
  const col = name => (cfg.flavors.find(f => f.name === name) || {}).lid || 'var(--cocoa)';
  const counts = { all: orders.length }; Object.keys(STAT).forEach(s => counts[s] = orders.filter(o => o.status === s).length);
  const q = oq.trim().toLowerCase().replace(/\s/g, '');
  const shown = orders.filter(o => (ofilter === 'all' || o.status === ofilter) && (!q || (o.name + o.phone + o.no).toLowerCase().replace(/\s/g, '').includes(q)));
  $('#page').innerHTML = `<div class="row" style="align-items:flex-end;margin-bottom:6px"><div class="grow"><h2>Orders</h2></div><button class="btn ghost sm" type="button" id="csv">Export</button></div>
    <p class="lead">Orders from the website, newest first. Confirm them with the customer on WhatsApp, then mark them here. Updates every 30 seconds.</p>
    <div class="grid4" style="margin-bottom:16px">
      <div class="stat"><b>${today.length}</b><span>Orders today</span></div>
      <div class="stat"><b>${money(sum(today))}</b><span>Sales today</span></div>
      <div class="stat"><b>${week.length}</b><span>Orders, 7 days</span></div>
      <div class="stat"><b>${money(sum(week))}</b><span>Sales, 7 days</span></div>
    </div>
    ${top.length ? `<div class="card"><h3>Top flavors, last 30 days</h3><div class="topfl">${top.map(([n, c]) => `<div><span>${esc(n)}</span><i style="--c:${col(n)};width:${Math.max(6, c / topMax * 100)}%"></i><span>${c}</span></div>`).join('')}</div></div>` : ''}
    <div class="otabs" role="group" aria-label="Filter orders">${[['new', 'New'], ['confirmed', 'Confirmed'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, l]) => `<button type="button" class="otab" data-of="${k}" aria-pressed="${ofilter === k}">${l}<small>${counts[k]}</small></button>`).join('')}</div>
    <input class="osearch" id="oq" type="search" placeholder="Search name, phone or order number" value="${esc(oq)}">
    <div class="olist" id="olist">${shown.length ? shown.map(orderCard).join('') : `<div class="empty-o"><b>${orders.length ? 'Nothing here' : 'No orders yet'}</b>${orders.length ? 'Try another filter.' : 'When customers order on the website, they show up here.'}</div>`}</div>`;
  $$('[data-of]').forEach(b => b.onclick = () => { ofilter = b.dataset.of; PAGES.orders(); });
  $('#oq').oninput = e => { oq = e.target.value; const pos = e.target.selectionStart; PAGES.orders(); const i = $('#oq'); i.focus(); i.setSelectionRange(pos, pos); };
  $('#csv').onclick = exportCsv;
  $('#olist').onclick = async e => {
    const b = e.target.closest('[data-st]'), d = e.target.closest('[data-del]');
    if (b) {
      const o = orders.find(x => x.id === b.dataset.id), prev = o.status; o.status = b.dataset.st; badge(); PAGES.orders();
      try { await api({ action: 'setStatus', session, id: o.id, status: o.status }); toast(`${o.no} → ${STAT[o.status]}`); }
      catch (er) { o.status = prev; badge(); PAGES.orders(); toast(er.message); }
    }
    if (d && confirmDel('Delete this order forever?')) {
      try { await api({ action: 'deleteOrder', session, id: d.dataset.del }); orders = orders.filter(x => x.id !== d.dataset.del); badge(); PAGES.orders(); toast('Order deleted'); } catch (er) { toast(er.message); }
    }
  };
};
function orderCard(o) {
  const ph = o.phone.replace(/\D/g, ''), intlN = intl(o.phone);
  const extras = [o.save ? `box deal −${money(o.save)}` : '', o.promo ? `promo ${esc(o.promo.code)} −${money(o.promo.disc)}` : '', `delivery ${o.fee == null ? 'to confirm' : o.fee ? money(o.fee) : 'free'}`].filter(Boolean).join(' · ');
  const btn = (st, label, cls = '') => `<button class="btn sm ${cls}" type="button" data-st="${st}" data-id="${o.id}">${label}</button>`;
  const acts = { new: btn('confirmed', '✓ Confirm', 'blue') + btn('cancelled', 'Cancel', 'ghost'), confirmed: btn('delivered', '🚚 Delivered', 'green') + btn('cancelled', 'Cancel', 'ghost'), delivered: btn('confirmed', 'Undo', 'ghost'), cancelled: btn('new', 'Restore', 'ghost') + `<button class="btn sm ghost" type="button" data-del="${o.id}" style="color:var(--bad);box-shadow:inset 0 0 0 1.5px var(--bad)">Delete</button>` }[o.status] || '';
  return `<article class="ocard st-${o.status}"><div class="oh"><span class="pill">${STAT[o.status] || o.status}</span><b>${esc(o.no)}</b><span class="when">${when(o.at)}</span></div>
    <div class="cust"><b>${esc(o.name)}</b><a href="tel:+${intlN}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>${esc(o.phone)}</a><a class="wa" href="https://wa.me/${intlN}?text=${encodeURIComponent(`Hi ${o.name}! About your AK Bowl order ${o.no}: `)}" target="_blank" rel="noopener">WhatsApp</a></div>
    <p class="addr">📍 ${esc(o.address)}</p>
    <ul class="oitems">${o.items.map(i => `<li>${i.qty} × ${esc(i.name)}</li>`).join('')}</ul>
    <div class="otot">${o.cups} cup${o.cups > 1 ? 's' : ''} · <b>${money(o.total)}</b> <small>${extras}</small></div>
    ${o.notes ? `<p class="onote">📝 ${esc(o.notes)}</p>` : ''}
    <div class="oact">${acts}</div></article>`;
}
function exportCsv() {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Time', 'Order', 'Status', 'Name', 'Phone', 'Address', 'Items', 'Cups', 'Total $', 'Promo', 'Notes']].concat((orders || []).map(o => {
    const d = new Date(o.at); return [d.toLocaleDateString('en-GB'), time12(o.at), o.no, STAT[o.status], o.name, o.phone, o.address, o.items.map(i => `${i.qty} x ${i.name}`).join(', '), o.cups, o.total, o.promo ? o.promo.code : '', o.notes];
  }));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `ak-bowl-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

/* ================= FLAVOR EDITOR ================= */
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flavor';
function editor(id) {
  const isNew = !id;
  const src = isNew ? { id: '', name: '', tag: '', p: 25, c: null, k: null, f: null, lid: '#B8682C', ink: '#5A3020', fill: '#8E5428', top: '#4A2A1A', photo: '', soldOut: false, isNew: true, hidden: false } : cfg.flavors.find(f => f.id === id);
  const f = clone(src); let pending = null;
  const nv = v => v == null ? '' : v;
  const m = $('#modal');
  m.innerHTML = `<div class="mh"><h3 id="edTitle">${isNew ? 'New flavor' : 'Edit ' + esc(f.name)}</h3><button class="iconbtn" type="button" data-x aria-label="Close">${IC.x}</button></div>
    <div class="ed">
      <div><div class="phbox"><img id="edImg" src="${photoSrc(f)}" alt=""><label>${IC.cam} ${f.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" id="edFile"></label></div>
        <div class="lidprev" id="lidPrev" style="--c:${f.lid};--ink:${f.ink}"><span id="lidName">${esc(f.name || 'Your flavor')}</span></div></div>
      <div>
        <div class="field" style="margin-top:0"><label for="eN">Name</label><input id="eN" value="${esc(f.name)}" maxlength="24" placeholder="e.g. Oreo"></div>
        <div class="field"><label for="eT">Tagline</label><input id="eT" value="${esc(f.tag)}" maxlength="32" placeholder="e.g. Cookies & cream"></div>
        <p class="hint" style="margin-top:14px">Nutrition from the cup's label. Leave a box empty if it's not on the label.</p>
        <div class="fields4">
          <div class="field"><label for="eP">Protein g</label><input id="eP" type="number" inputmode="decimal" min="0" value="${nv(f.p)}"></div>
          <div class="field"><label for="eC">Choco g</label><input id="eC" type="number" inputmode="decimal" min="0" value="${nv(f.c)}"></div>
          <div class="field"><label for="eK">Calories</label><input id="eK" type="number" inputmode="numeric" min="0" value="${nv(f.k)}"></div>
          <div class="field"><label for="eF">Fat g</label><input id="eF" type="number" inputmode="decimal" min="0" value="${nv(f.f)}"></div>
        </div>
        <p class="hint" style="margin-top:14px">Colors used for the 3D cup, badges and lid.</p>
        <div class="colors">
          <div class="field"><label for="cL">Lid</label><input type="color" id="cL" value="${f.lid}"></div>
          <div class="field"><label for="cI">Lid text</label><input type="color" id="cI" value="${f.ink}"></div>
          <div class="field"><label for="cF">Cream</label><input type="color" id="cF" value="${f.fill}"></div>
          <div class="field"><label for="cT">Topping</label><input type="color" id="cT" value="${f.top}"></div>
        </div>
        <div class="togs">
          <div class="tog">${sw('tSo', f.soldOut, 'Sold out', 'red')}<div>Sold out<small>Shown on the website, can't be ordered.</small></div></div>
          <div class="tog">${sw('tNew', f.isNew, 'New badge')}<div>"New" badge<small>Puts a NEW tag on the flavor card.</small></div></div>
          <div class="tog">${sw('tHid', f.hidden, 'Hidden')}<div>Hide from the website<small>Keeps it saved here for later.</small></div></div>
        </div>
      </div>
    </div>
    <p class="err" id="edErr"></p>
    <div class="mf">${isNew ? '' : `<button class="btn ghost sm" type="button" id="edDel" style="color:var(--bad);box-shadow:inset 0 0 0 1.5px var(--bad)">${IC.trash} Delete</button>`}<span class="sp"></span><button class="btn ghost" type="button" data-x>Cancel</button><button class="btn" type="button" id="edSave">${isNew ? 'Add flavor' : 'Save'}</button></div>`;
  $('#ov').hidden = false; m.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#eN').focus(), 50);
  const lp = () => { $('#lidPrev').style.setProperty('--c', $('#cL').value); $('#lidPrev').style.setProperty('--ink', $('#cI').value); $('#lidName').textContent = $('#eN').value || 'Your flavor'; };
  ['eN', 'cL', 'cI'].forEach(k => $('#' + k).addEventListener('input', lp));
  m.querySelectorAll('.togs .sw').forEach(s => s.onclick = () => s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true'));
  $('#edFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try { pending = await processPhoto(file); $('#edImg').src = pending.sm; } catch (er) { $('#edErr').textContent = 'Couldn\'t read that image. Try a JPG or PNG.'; }
  };
  m.querySelectorAll('[data-x]').forEach(b => b.onclick = closeEditor);
  if ($('#edDel')) $('#edDel').onclick = () => {
    if (visible().length <= 1 && !f.hidden) { $('#edErr').textContent = 'The website needs at least one flavor.'; return; }
    if (!confirmDel(`Delete ${f.name}? You can also just hide it.`)) return;
    cfg.flavors = cfg.flavors.filter(x => x.id !== id); changed(); closeEditor(); go('flavors'); toast(`${f.name} deleted`);
  };
  $('#edSave').onclick = () => {
    const name = $('#eN').value.trim(); const num = k => { const v = $('#' + k).value.trim(); return v === '' ? null : Math.max(0, +v); };
    if (!name) { $('#edErr').textContent = 'Give the flavor a name.'; $('#eN').focus(); return; }
    if (num('eP') == null) { $('#edErr').textContent = 'Protein is needed (it\'s on every card).'; $('#eP').focus(); return; }
    Object.assign(f, { name, tag: $('#eT').value.trim(), p: num('eP'), c: num('eC'), k: num('eK'), f: num('eF'), lid: $('#cL').value, ink: $('#cI').value, fill: $('#cF').value, top: $('#cT').value,
      soldOut: $('#tSo').getAttribute('aria-checked') === 'true', isNew: $('#tNew').getAttribute('aria-checked') === 'true', hidden: $('#tHid').getAttribute('aria-checked') === 'true' });
    if (isNew) { let sid = slug(name), n = 2; while (cfg.flavors.some(x => x.id === sid)) sid = slug(name) + '-' + n++; f.id = sid; }
    if (f.hidden && visible().filter(x => x.id !== f.id).length === 0) { $('#edErr').textContent = 'The website needs at least one visible flavor.'; return; }
    if (pending) { const pid = `${f.id}-${Date.now().toString(36)}`; files[pid] = pending; f.photo = pid; f.ext = pending.ext; delete f.small; }
    if (isNew) cfg.flavors.push(f); else cfg.flavors[cfg.flavors.findIndex(x => x.id === id)] = f;
    changed(); closeEditor(); go('flavors'); toast(isNew ? `${name} added` : 'Saved. Publish when you\'re ready');
  };
}
function closeEditor() { $('#modal').hidden = true; $('#ov').hidden = true; document.body.style.overflow = ''; }
$('#ov').onclick = closeEditor;
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeEditor(); });

/* photos: resized in the browser to 900px + 480px wide (WebP where supported, else JPEG) */
function processPhoto(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const out = w => { const s = Math.min(1, w / im.naturalWidth), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let d = c.toDataURL('image/webp', .82); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', .85); return d; };
      const full = out(900), sm = out(480); URL.revokeObjectURL(url);
      res({ full, sm, ext: full.startsWith('data:image/webp') ? 'webp' : 'jpg' });
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    im.src = url;
  });
}

/* ================= PREVIEW ================= */
$('#previewBtn').onclick = () => {
  try { const photos = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.sm])); localStorage.setItem(DRAFT_KEY, JSON.stringify({ base, config: cfg, photos, files })); } catch (e) {}
  window.open('index.html?preview=1', '_blank');
};

/* ================= PUBLISH ================= */
function problems() {
  const p = [];
  if (!visible().length) p.push('At least one flavor must be visible.');
  if (!(cfg.price > 0)) p.push('The cup price must be more than $0.');
  if (!(cfg.box.price > 0) || !(cfg.box.size >= 2)) p.push('Check the box deal (at least 2 cups and a price).');
  const codes = (cfg.promos || []).map(x => x.code);
  if (codes.some(c => !c)) p.push('A promo code is empty.');
  if (new Set(codes).size !== codes.length) p.push('Two promo codes have the same name.');
  if (!/^961\d{7,8}$/.test(cfg.whatsapp || '')) p.push('The WhatsApp number looks wrong.');
  return p;
}
function summary() {
  const b = JSON.parse(base), out = [];
  cfg.flavors.forEach(f => { const o = b.flavors.find(x => x.id === f.id); if (!o) out.push(`add ${f.name}`); else if (o.soldOut !== f.soldOut) out.push(`${f.name} ${f.soldOut ? 'sold out' : 'back in stock'}`); else if (JSON.stringify(o) !== JSON.stringify(f)) out.push(`edit ${f.name}`); });
  b.flavors.forEach(o => { if (!cfg.flavors.some(f => f.id === o.id)) out.push(`remove ${o.name}`); });
  if (b.price !== cfg.price || JSON.stringify(b.box) !== JSON.stringify(cfg.box) || JSON.stringify(b.delivery) !== JSON.stringify(cfg.delivery)) out.push('prices');
  if (JSON.stringify(b.promos) !== JSON.stringify(cfg.promos)) out.push('promo codes');
  if (b.open !== cfg.open) out.push(cfg.open ? 'orders open' : 'orders paused');
  if (JSON.stringify(b.banner) !== JSON.stringify(cfg.banner) || b.closedMsg !== cfg.closedMsg) out.push('banner');
  if (b.whatsapp !== cfg.whatsapp || b.instagram !== cfg.instagram) out.push('contact');
  return out.length ? out.slice(0, 6).join(', ') + (out.length > 6 ? '…' : '') : 'update';
}
$('#publishBtn').onclick = async () => {
  const bad = problems();
  const box = $('#pubBox'), pub = $('#pub');
  pub.hidden = false;
  if (bad.length) { box.innerHTML = `<h3>Almost!</h3><p>Fix this first:</p><ul class="steps">${bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul><button class="btn" type="button" id="pubOk" style="margin-top:12px">OK</button>`; $('#pubOk').onclick = () => pub.hidden = true; return; }
  if (demo) { box.innerHTML = `<h3>Demo mode</h3><p>In demo mode nothing is saved. Sign in with the owner password to publish for real. Use <b>Preview</b> to see your changes on the website.</p><button class="btn" type="button" id="pubOk" style="margin-top:16px">Got it</button>`; $('#pubOk').onclick = () => pub.hidden = true; return; }
  const steps = ['Preparing photos and settings', 'Saving to the website', 'Publishing'];
  box.innerHTML = `<div class="spin"></div><h3>Publishing…</h3><ul class="steps">${steps.map((s, i) => `<li id="st${i}">${s}</li>`).join('')}</ul>`;
  const done = i => $('#st' + i).classList.add('done');
  try {
    const up = [];
    for (const [pid, v] of Object.entries(files)) for (const [suffix, d] of [['', v.full], ['-sm', v.sm]]) up.push({ path: `assets/photos/${pid}${suffix}.${v.ext}`, content: d.split(',')[1] });
    const data = buildDataJs(cfg);
    done(0);
    await api({ action: 'publish', session, data, files: up, message: summary() });
    done(1); done(2);
    dataText = buildDataJs(cfg); base = JSON.stringify(cfg);
    // new photos are now in the repo; keep showing them from memory until the site redeploys
    Object.entries(files).forEach(([pid, v]) => { PUBLISHED[pid] = v.sm; }); files = {};
    changed(); try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    box.innerHTML = `<div style="font-size:54px">🎉</div><h3>Published!</h3><p>Your website updates in about a minute. Refresh it to see the changes.</p><div class="row" style="justify-content:center;margin-top:18px;flex-wrap:wrap"><a class="btn ghost" href="./" target="_blank" rel="noopener">Open website</a><button class="btn" type="button" id="pubOk">Done</button></div>`;
    $('#pubOk').onclick = () => { pub.hidden = true; go(page); };
  } catch (e) {
    if (e.status === 401) { pub.hidden = true; saveDraft(); signedOut('Please sign in again. Your changes are kept.'); return; }
    box.innerHTML = `<h3>Couldn't publish</h3><p>${esc(e.message)}</p><p class="hint" style="margin-top:8px">Your changes are still here. Check your internet and try again.</p><button class="btn" type="button" id="pubOk" style="margin-top:16px">OK</button>`;
    $('#pubOk').onclick = () => pub.hidden = true;
  }
};
addEventListener('beforeunload', e => { if (cfg && dirty()) { e.preventDefault(); e.returnValue = ''; } });

/* ================= TOAST ================= */
let tt; function toast(s) { const el = $('#toast'); el.textContent = s; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2400); }
