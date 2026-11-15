/* AK Bowl: flavors, 3D hero picker, the 10-cup box builder, compare bars, cart + checkout.
   Data: data.js (window.AK). The 3D cup is scene.js (window.AKScene). */
'use strict';

/* Everything the owner can change lives in data.js (edited from admin.html).
   Orders and wholesale requests open WhatsApp with the full text typed out; the customer taps Send.
   An empty whatsapp number = demo mode. */
const AK = window.AK;
const ORDER_WHATSAPP = String(AK.whatsapp || '').replace(/\D/g, '');
const waLink = text => `https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent(text)}`;
function openWA(text) {
  const url = waLink(text), w = window.open(url, '_blank');
  if (w) w.opener = null; else location.href = url;   // popup blocked (e.g. Instagram's in-app browser): go there directly
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FL = AK.flavors.filter(f => !f.hidden), BY = Object.fromEntries(FL.map(f => [f.id, f]));
const BUY = () => FL.filter(f => !f.soldOut);     // flavors you can order right now
const SHORTS = { lotus: 'LOTUS', pistachio: 'PISTA', snickers: 'SNICK', twix: 'TWIX', cheesecake: 'CHEESE', peanut: 'PB', kitkat: 'KITKAT', galaxy: 'GALAXY', oreo: 'OREO', dark: 'DARK' };
const SHORT = id => SHORTS[id] || BY[id].name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(' ')[0].slice(0, 6);
const ICON = {
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 2.5v11M2.5 8h11"/></svg>',
  minus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2.5 8h11"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>',
};
const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const img = (f, sm) => !f.photo ? 'assets/photos/scoop-sm.webp' : (AK._photos && AK._photos[f.photo]) || `assets/photos/${f.photo}${sm || f.small ? '-sm' : ''}.${f.ext || 'webp'}`;
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/* accent: lid colour, or the lid's ink when the lid colour is too light for white text */
function lum(hex) { const c = hex.match(/\w\w/g).map(h => { const v = parseInt(h, 16) / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
const accOf = f => (1.05 / (lum(f.lid) + .05) >= 3 ? f.lid : f.ink);

/* ================= CART + PRICING ================= */
const KEY = 'akbowl-cart-v1';
let cart = {};
try { cart = JSON.parse(localStorage.getItem(KEY) || '{}'); Object.keys(cart).forEach(k => { if (!BY[k] || BY[k].soldOut || !(cart[k] > 0)) delete cart[k]; }); } catch (e) { cart = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
/* promo code: % off the cups (after the box deal); delivery is free with a box, otherwise AK.delivery.fee (null = confirm on WhatsApp) */
let promo = null;
try { const c = localStorage.getItem('akbowl-promo'); promo = (AK.promos || []).find(p => p.on && p.code.toUpperCase() === c) || null; } catch (e) {}
function price(n = count()) {
  const boxes = Math.floor(n / AK.box.size), rest = n % AK.box.size;
  const sub = boxes * AK.box.price + rest * AK.price, full = n * AK.price;
  const disc = promo ? Math.round(sub * promo.off) / 100 : 0;
  const fee = !n || boxes ? 0 : AK.delivery && AK.delivery.fee != null && AK.delivery.fee !== '' ? +AK.delivery.fee : null;
  return { n, boxes, rest, sub, full, save: full - sub, disc, fee, total: Math.round((sub - disc + (fee || 0)) * 100) / 100 };
}
const feeText = p => p.boxes ? 'Free' : p.fee == null ? 'Confirmed on WhatsApp' : p.fee ? money(p.fee) : 'Free';
function setQty(id, q, from) {
  const before = cart[id] || 0; q = Math.max(0, Math.min(99, q));
  if (q > before && BY[id].soldOut) { toast(`${BY[id].name} is sold out right now`); return; }
  if (q) cart[id] = q; else delete cart[id];
  save(); renderCtl(id); updateCounts(q > before);
  if (q > before) { fly(from, BY[id]); const p = price(); if (p.rest === 0 && p.boxes > 0) toast(`Box deal unlocked: ${p.boxes * AK.box.size} cups for ${money(p.boxes * AK.box.price)} 🎉`); else toast(`${BY[id].name} added`); }
  if ($('#cart').classList.contains('on')) renderCart();
}
const add = (id, n = 1, from) => setQty(id, (cart[id] || 0) + n, from);

/* ================= ACCENT / HERO FLAVOR ================= */
let current = FL[0], userPicked = false;
function setFlavor(f, byUser) {
  current = f; if (byUser) userPicked = true;
  document.documentElement.style.setProperty('--acc', accOf(f));
  document.documentElement.style.setProperty('--accfill', f.fill);
  $$('#rail .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.f === f.id));
  if (window.AKScene) window.AKScene.setFlavor(f); else pendingScene = f;
  renderNow();
}
let pendingScene = FL[0];
(function waitScene() { if (window.AKScene) { window.AKScene.setFlavor(pendingScene || current); return; } setTimeout(waitScene, 120); })();

$('#rail').innerHTML = FL.map(f => `<button class="chip" type="button" data-f="${f.id}" style="--c:${f.lid}" aria-pressed="false"><i></i>${esc(f.name)} <small>${f.soldOut ? 'sold out' : f.p + 'g'}</small></button>`).join('');
$('#rail').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) setFlavor(BY[b.dataset.f], true); });
function renderNow() {
  const f = current, q = cart[f.id] || 0;
  $('#now').innerHTML = `<span class="k">In the cup</span><h3>${esc(f.name)}</h3>
    <div class="big"><b>${f.p}g</b><span>protein</span></div>
    <div class="mini">${f.k != null ? `<span>${f.k} kcal</span>` : ''}${f.f != null ? `<span>${f.f} g fat</span>` : ''}<span>No added sugar</span></div>
    <div class="row"><span class="price">${money(AK.price)}</span>${f.soldOut ? '<span class="soldtxt">Sold out</span>' : `<button class="addpill" type="button" data-add="${f.id}">${ICON.plus}${q ? `Add another (${q})` : 'Add to order'}</button>`}</div>`;
}
// gently cycle the hero cup until someone picks a flavor
let heroVisible = true;
new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe($('.hero'));
if (!reduce) setInterval(() => { if (!userPicked && heroVisible && !document.hidden && !$('.ov.on')) setFlavor(FL[(FL.indexOf(current) + 1) % FL.length]); }, 5200);

/* marquee */
const MQ = ['HIGH PROTEIN', 'NO ADDED SUGAR', 'LOW CALORIE', 'CREAMY & DELICIOUS', `${AK.box.size} CUPS · ${money(AK.box.price)}`, 'FREE DELIVERY'];
$('#mq').innerHTML = [...MQ, ...MQ].map(t => `<span>${t}</span>`).join('');

/* ================= FLAVOR GRID ================= */
const wave = '<svg class="wave" viewBox="0 0 400 44" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 26 C 70 6 130 40 210 24 S 340 6 400 20 V44 H0z"/></svg>';
function cardHTML(f) {
  const mac = [f.k != null ? `${f.k} kcal` : null, f.f != null ? `${f.f} g fat` : null, f.c != null ? `${f.c} g choco` : null].filter(Boolean);
  const badges = (f.isNew ? '<span class="badge new">New</span>' : '') + (f.soldOut ? '<span class="badge out">Sold out</span>' : '');
  return `<article class="card${f.soldOut ? ' soldout' : ''}" id="fl-${f.id}" data-id="${f.id}" style="--c:${f.lid}">
    <div class="ph">${badges ? `<div class="badges">${badges}</div>` : ''}<img src="${img(f, true)}" alt="AK Bowl ${esc(f.name)} protein cup" loading="lazy" width="480" height="650"><button type="button" data-open="${f.id}" aria-label="See ${esc(f.name)} details"></button>${wave}
      <div class="pro" aria-hidden="true"><b>${f.p}g</b><small>PROTEIN</small></div></div>
    <div class="bd"><h3>${esc(f.name)}</h3><p class="tag">${esc(f.tag)}</p>
      <div class="mac">${mac.length ? mac.map(m => `<span>${m}</span>`).join('') : '<span>Full label soon</span>'}</div>
      <div class="ft"><span class="price">${money(AK.price)}<small>/ cup</small></span><div class="ctl" data-ctl="${f.id}"></div></div></div></article>`;
}
$('#grid').innerHTML = FL.map(cardHTML).join('');
function renderCtl(id) {
  const f = BY[id], q = cart[id] || 0;
  $$(`[data-ctl="${id}"]`).forEach(el => {
    el.innerHTML = f.soldOut ? '<span class="soldtxt">Sold out</span>' : q ? `<div class="step" role="group" aria-label="${esc(f.name)} quantity"><button type="button" data-dec="${id}" aria-label="One less ${esc(f.name)}">${ICON.minus}</button><output>${q}</output><button type="button" data-add="${id}" aria-label="One more ${esc(f.name)}">${ICON.plus}</button></div>`
      : `<button class="add" type="button" data-add="${id}" aria-label="Add ${esc(f.name)} to order">${ICON.plus}</button>`;
  });
  if (id === current.id) renderNow();
}
FL.forEach(f => renderCtl(f.id));

// sort with a FLIP animation
$$('[data-sort]').forEach(b => b.addEventListener('click', () => {
  $$('[data-sort]').forEach(x => x.setAttribute('aria-pressed', x === b));
  const k = b.dataset.sort, grid = $('#grid'), cards = $$('.card', grid);
  const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
  const val = f => (f[k] == null ? (k === 'p' ? -1 : 9999) : f[k]);
  const order = k === 'all' ? FL : [...FL].sort((a, b) => k === 'p' ? val(b) - val(a) : val(a) - val(b));
  order.forEach(f => grid.appendChild($('#fl-' + f.id)));
  if (reduce) return;
  cards.forEach(c => { const a = first.get(c), z = c.getBoundingClientRect(); const dx = a.left - z.left, dy = a.top - z.top; if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' }); });
}));

// 3D tilt on cards (mouse only)
if (!reduce) $('#grid').addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return; const c = e.target.closest('.card'); if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  c.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
});
$('#grid').addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });

/* ================= THE BOX ================= */
let box = [];
$('#mfl').innerHTML = BUY().map(f => `<button class="mf" type="button" data-bf="${f.id}" style="--c:${f.lid}" aria-label="Add ${esc(f.name)} to the box"><i></i>${esc(f.name)}</button>`).join('');
function renderBox(popIdx = -1) {
  $('#slots').innerHTML = Array.from({ length: AK.box.size }, (_, i) => {
    const f = BY[box[i]];
    return f ? `<button type="button" class="slot on" data-slot="${i}" style="--c:${f.lid};${i === popIdx || popIdx === 'all' ? '' : 'animation:none'}" aria-label="${esc(f.name)}, tap to remove"><span>${SHORT(f.id)}</span></button>`
      : `<span class="slot" aria-hidden="true">${i + 1}</span>`;
  }).join('');
  const n = box.length;
  $('#progBar').style.width = (n / AK.box.size * 100) + '%';
  $('#trayTxt').textContent = n === AK.box.size ? 'Box full, ready to go!' : `${n} of ${AK.box.size} cups`;
  $('#boxAdd').disabled = n !== AK.box.size;
  $('#boxAdd').textContent = n === AK.box.size ? `Add box to order · ${money(AK.box.price)}` : `Add ${AK.box.size - n} more`;
}
renderBox();
$('#mfl').addEventListener('click', e => { const b = e.target.closest('[data-bf]'); if (!b) return; if (box.length >= AK.box.size) { toast('Box is full. Tap a cup to swap it'); return; } box.push(b.dataset.bf); renderBox(box.length - 1); });
$('#slots').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; box.splice(+b.dataset.slot, 1); renderBox(); });
$('#boxRand').onclick = () => { const B = BUY(); if (!B.length) return; while (box.length < AK.box.size) box.push(B[Math.floor(Math.random() * B.length)].id); renderBox('all'); };
$('#boxClear').onclick = () => { box = []; renderBox(); };
$('#boxAdd').onclick = () => {
  if (box.length !== AK.box.size) return;
  const r = $('#boxAdd').getBoundingClientRect();
  box.forEach(id => { cart[id] = (cart[id] || 0) + 1; }); save(); FL.forEach(f => renderCtl(f.id)); updateCounts(true);
  fly(r, BY[box[0]]); toast(`Box of ${AK.box.size} added · ${money(AK.box.price)} with free delivery`);
  box = []; renderBox();
};

/* ================= INSIDE (exploding layers) ================= */
const stack = $('#stack'), discs = $$('.disc', stack);
function layers() {
  const r = stack.getBoundingClientRect(), vh = innerHeight; if (r.bottom < 0 || r.top > vh) return;
  const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height * .4)));
  const gap = reduce ? 60 : 8 + p * 92;
  discs.forEach(d => { d.style.setProperty('--gap', gap + 'px'); d.style.setProperty('--rz', (reduce ? 0 : p * 50) + 'deg'); });
}

/* ================= COMPARE ================= */
const MET = { p: ['g', 'Protein per cup. Higher is more protein.'], k: [' kcal', 'Calories per cup, lightest first.'], f: [' g', 'Fat per cup, leanest first.'], r: ['g', 'Grams of protein per 100 kcal. Higher means more protein for the calories.'] };
const metric = (f, m) => m === 'r' ? (f.k ? +(f.p / f.k * 100).toFixed(1) : null) : f[m];
function renderBars(m) {
  const rows = FL.filter(f => metric(f, m) != null).sort((a, b) => (m === 'k' || m === 'f') ? metric(a, m) - metric(b, m) : metric(b, m) - metric(a, m));
  const max = Math.max(...rows.map(f => metric(f, m)));
  $('#bars').innerHTML = rows.map(f => `<button class="bar" type="button" data-open="${f.id}" style="--c:${f.lid}"><span class="nm"><i></i>${esc(f.name)}</span><span class="tr"><span data-w="${(metric(f, m) / max * 100).toFixed(1)}"></span></span><span class="v">${metric(f, m)}${MET[m][0]}</span></button>`).join('');
  const missing = FL.filter(f => metric(f, m) == null).map(f => f.name);
  $('#cmpNote').textContent = MET[m][1] + (missing.length ? ` ${missing.join(', ')}: full label coming soon.` : '');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#bars [data-w]').forEach(s => { s.style.width = s.dataset.w + '%'; })));
}
let barsShown = false;
$$('[data-m]').forEach(b => b.addEventListener('click', () => { $$('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderBars(b.dataset.m); }));
new IntersectionObserver((es, o) => { if (es[0].isIntersecting && !barsShown) { barsShown = true; renderBars('p'); o.disconnect(); } }, { threshold: .25 }).observe($('#bars'));

/* ================= SHEET (flavor detail) ================= */
function openSheet(id) {
  const f = BY[id]; let qty = 1;
  $('#sheet').style.setProperty('--c', f.lid);
  $('#shPh').innerHTML = `<img src="${img(f)}" alt="AK Bowl ${esc(f.name)}">`;
  const ring = (v, max, label, unit) => `<div class="rg"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"/><circle class="fg" cx="50" cy="50" r="40" data-o="${v == null ? 251 : (251 - 251 * Math.min(1, v / max)).toFixed(1)}"/></svg><b>${v == null ? '—' : v + unit}</b><small>${label}</small></div>`;
  const draw = () => {
    $('#shBd').innerHTML = `<button class="xbtn" type="button" data-close aria-label="Close">${ICON.x}</button>
      <p class="tag">${esc(f.tag)}</p><h2 id="shName">${esc(f.name)}</h2>
      <div class="rings">${ring(f.p, 40, 'Protein', 'g')}${ring(f.c, 30, 'Choco', 'g')}${ring(f.k, 400, 'Calories', '')}${ring(f.f, 20, 'Fat', 'g')}</div>
      <p class="d">Biscuit crumble, thick protein cream and a ${esc(f.name)} finish. No added sugar.${f.k == null ? ' Full nutrition label coming soon.' : ''}</p>
      <div class="sh-act"><div class="step" role="group" aria-label="Quantity"><button type="button" id="shM" aria-label="One less">${ICON.minus}</button><output id="shQ">${qty}</output><button type="button" id="shP" aria-label="One more">${ICON.plus}</button></div>
      ${f.soldOut ? '<button class="gobtn" type="button" disabled style="opacity:.5"><span>Sold out right now</span><span></span></button>' : `<button class="gobtn" type="button" id="shAdd"><span>Add to order</span><span id="shT">${money(qty * AK.price)}</span></button>`}</div>`;
    $('#shM').onclick = () => { if (qty > 1) { qty--; upd(); } };
    $('#shP').onclick = () => { if (qty < 30) { qty++; upd(); } };
    if ($('#shAdd')) $('#shAdd').onclick = () => { const r = $('#shAdd').getBoundingClientRect(); closeAll(); add(f.id, qty, r); };
  };
  const upd = () => { $('#shQ').textContent = qty; $('#shT').textContent = money(qty * AK.price); };
  draw(); openPanel('sheet');
  setTimeout(() => $$('#shBd .fg').forEach(c => { c.style.strokeDashoffset = c.dataset.o; }), reduce ? 0 : 250);
}

/* ================= CART DRAWER + CHECKOUT ================= */
let view = 'list', form = { name: '', phone: '', address: '', notes: '' };
try { Object.assign(form, JSON.parse(localStorage.getItem('akbowl-details') || '{}')); } catch (e) {}
function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot'), p = price();
  if (view === 'done') return;
  if (!p.n) { view = 'list'; body.innerHTML = `<div class="empty"><img src="${(AK._photos && AK._photos.scoop) || 'assets/photos/scoop-sm.webp'}" alt=""><b>Nothing scooped yet</b>Pick a flavor and it lands here.</div>`; foot.innerHTML = `<button class="gobtn ghost" type="button" data-close>Browse flavors</button>`; return; }
  if (view === 'list') {
    const lines = FL.filter(f => cart[f.id]).map(f => `<div class="line"><img src="${img(f, true)}" alt=""><div><b>${esc(f.name)}</b><small>${f.p} g protein · ${money(AK.price)} each</small></div>
      <div class="step" role="group" aria-label="${esc(f.name)} quantity"><button type="button" data-dec="${f.id}" aria-label="One less">${ICON.minus}</button><output>${cart[f.id]}</output><button type="button" data-add="${f.id}" aria-label="One more">${ICON.plus}</button></div></div>`).join('');
    const need = AK.box.size - p.rest;
    const nudge = p.rest >= Math.ceil(AK.box.size * .6) && AK.box.price < AK.box.size * AK.price ? `<div class="nudge">🎁<span>Add <b>${need} more cup${need > 1 ? 's' : ''}</b> and ${p.boxes ? 'another' : 'the'} ${AK.box.size} cost just <b>${money(AK.box.price)}</b> with free delivery.</span></div>` : '';
    const promos = (AK.promos || []).some(x => x.on);
    body.innerHTML = lines + `<div class="sum"><div><span>${p.n} cup${p.n > 1 ? 's' : ''} × ${money(AK.price)}</span><span>${money(p.full)}</span></div>
      ${p.save > 0 ? `<div class="save"><span>Box deal (${p.boxes} × ${AK.box.size} for ${money(AK.box.price)})</span><span>−${money(p.save)}</span></div>` : ''}
      ${p.disc ? `<div class="save"><span>Promo ${esc(promo.code)} (−${promo.off}%)</span><span>−${money(p.disc)}</span></div>` : ''}
      <div><span>Delivery</span><span>${feeText(p)}</span></div>
      <div class="tot"><span>Total</span><span>${money(p.total)}</span></div></div>`
      + (promos ? `<form class="promo" id="promoForm"><input id="promoIn" aria-label="Promo code" placeholder="Promo code" autocapitalize="characters" value="${promo ? esc(promo.code) : ''}"><button type="submit">${promo ? 'Remove' : 'Apply'}</button></form><p class="promo-msg" id="promoMsg"></p>` : '') + nudge;
    foot.innerHTML = AK.open ? `<button class="gobtn" type="button" id="toDetails"><span>Checkout</span><span>${money(p.total)}</span></button>`
      : `<p class="closedmsg">${esc(AK.closedMsg || "We're closed right now.")}</p><button class="gobtn" type="button" disabled style="opacity:.5"><span>Ordering is paused</span><span>${money(p.total)}</span></button>`;
    if ($('#toDetails')) $('#toDetails').onclick = () => { view = 'details'; renderCart(); };
    if ($('#promoForm')) $('#promoForm').onsubmit = e => {
      e.preventDefault();
      if (promo) { promo = null; try { localStorage.removeItem('akbowl-promo'); } catch (er) {} renderCart(); updateCounts(); return; }
      const code = $('#promoIn').value.trim().toUpperCase(), hit = (AK.promos || []).find(x => x.on && x.code.toUpperCase() === code);
      if (!hit) { $('#promoMsg').textContent = code ? 'That code isn’t valid.' : 'Type a code first.'; return; }
      promo = hit; try { localStorage.setItem('akbowl-promo', code); } catch (er) {} renderCart(); updateCounts(); toast(`${hit.off}% off applied 🎉`);
    };
  } else if (view === 'details') {
    body.innerHTML = `<form id="ckForm" class="form" style="margin-top:4px" novalidate>
      <div class="field"><label for="cName">Your name</label><input id="cName" name="name" autocomplete="name" value="${esc(form.name)}"><span class="err" id="eName"></span></div>
      <div class="field"><label for="cPhone">Phone</label><input id="cPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="70 123 456" value="${esc(form.phone)}"><span class="err" id="ePhone"></span></div>
      <div class="field"><label for="cAddr">Delivery address</label><input id="cAddr" name="address" autocomplete="street-address" placeholder="Area, street, building" value="${esc(form.address)}"><span class="err" id="eAddr"></span></div>
      <div class="field"><label for="cNotes">Notes (optional)</label><textarea id="cNotes" name="notes" rows="3" placeholder="Best time to deliver, floor…">${esc(form.notes)}</textarea></div>
      <p class="privacy">🔒 We only use your details to prepare and deliver your order.</p></form>`;
    foot.innerHTML = `<button class="gobtn" type="submit" form="ckForm"><span>Send order on WhatsApp</span><span>${money(p.total)}</span></button><button class="gobtn ghost" type="button" id="ckBack">Back</button>`;
    const f = $('#ckForm');
    f.addEventListener('input', () => { form = Object.fromEntries(new FormData(f)); try { localStorage.setItem('akbowl-details', JSON.stringify(form)); } catch (e) {} });
    f.addEventListener('submit', placeOrder);
    $('#ckBack').onclick = () => { view = 'list'; renderCart(); };
  }
}
function placeOrder(e) {
  e.preventDefault();
  const eN = !form.name.trim(), eP = String(form.phone).replace(/\D/g, '').length < 7, eA = !form.address.trim();
  $('#eName').textContent = eN ? 'Tell us your name.' : ''; $('#ePhone').textContent = eP ? 'We need a phone number to deliver.' : ''; $('#eAddr').textContent = eA ? 'Where should we deliver?' : '';
  if (eN || eP || eA) { (eN ? $('#cName') : eP ? $('#cPhone') : $('#cAddr')).focus(); return; }
  if (!AK.open) { toast(AK.closedMsg || "We're closed right now."); return; }
  const p = price(), no = 'AK-' + Math.floor(1000 + Math.random() * 9000);
  const items = FL.filter(f => cart[f.id]).map(f => `🥤 ${cart[f.id]} × ${f.name} (${money(cart[f.id] * AK.price)})`).join('\n');
  const txt = `*New AK Bowl order* ${no}\n\n${items}\n\n${p.n} cup${p.n > 1 ? 's' : ''}: ${money(p.full)}${p.save > 0 ? `\nBox deal (${p.boxes} × ${AK.box.size} for ${money(AK.box.price)}): −${money(p.save)}` : ''}${p.disc ? `\nPromo ${promo.code} (−${promo.off}%): −${money(p.disc)}` : ''}\nDelivery: ${p.fee == null && !p.boxes ? 'please confirm the fee' : feeText(p)}\n*Total: ${money(p.total)}*\n\n👤 ${form.name.trim()}\n📞 ${form.phone.trim()}\n📍 ${form.address.trim()}${form.notes.trim() ? '\n📝 ' + form.notes.trim() : ''}`;
  // save a copy for the owner's order tracker (admin.html → Orders). Fire-and-forget: WhatsApp opens no matter what.
  if (!window.AK_PREVIEW) try {
    fetch('api/order', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      no, name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), notes: form.notes.trim(),
      items: FL.filter(f => cart[f.id]).map(f => ({ id: f.id, name: f.name, qty: cart[f.id], price: AK.price })),
      full: p.full, save: p.save, promo: p.disc ? { code: promo.code, off: promo.off, disc: p.disc } : null, fee: p.boxes ? 0 : p.fee, total: p.total }) }).catch(() => {});
  } catch (er) {}
  if (ORDER_WHATSAPP) openWA(txt);
  view = 'done';
  $('#cartBody').innerHTML = `<div class="done"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path pathLength="1" d="M30 52l13 13 27-29"/></svg><h3>Almost there!</h3><p>Your order <b>${no}</b> (${p.n} cup${p.n > 1 ? 's' : ''}, ${money(p.total)}) is ready in WhatsApp. <b>Just tap Send</b> and AK Bowl will confirm.</p>${ORDER_WHATSAPP ? `<a class="gobtn" style="margin-top:22px;text-decoration:none" href="${waLink(txt)}" target="_blank" rel="noopener"><span>WhatsApp didn't open?</span><span>Open it</span></a>` : '<div class="demo">Demo mode: this order was not sent to AK Bowl.</div>'}</div>`;
  $('#cartFoot').innerHTML = `<button class="gobtn" type="button" id="newOrder"><span>Done</span><span>✓</span></button>`;
  cart = {}; save(); promo = null; try { localStorage.removeItem('akbowl-promo'); } catch (er) {} FL.forEach(f => renderCtl(f.id)); updateCounts();
  $('#newOrder').onclick = () => { view = 'list'; closeAll(); };
}

/* ================= PANELS ================= */
let openId = null, returnFocus = null;
function openPanel(id) {
  if (openId) $('#' + openId).classList.remove('on');
  returnFocus = returnFocus || document.activeElement; openId = id;
  $('#' + id).classList.add('on'); $('#ov').classList.add('on'); document.body.classList.add('locked'); $('#obar').classList.remove('on');
  if (id === 'cart') renderCart();
  setTimeout(() => { const f = $('#' + id + ' [data-close]'); if (f) f.focus(); }, 80);
}
function closeAll() {
  if (!openId) return;
  $('#' + openId).classList.remove('on'); $('#ov').classList.remove('on'); document.body.classList.remove('locked'); openId = null;
  if (view === 'done') view = 'list';
  updateCounts(); if (returnFocus && document.contains(returnFocus)) returnFocus.focus(); returnFocus = null;
}
addEventListener('keydown', e => {
  if (e.key === 'Escape' && openId) closeAll();
  if (e.key === 'Tab' && openId) {
    const f = $$(`#${openId} button, #${openId} input, #${openId} textarea, #${openId} select`).filter(x => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ================= GLOBAL CLICKS ================= */
document.addEventListener('click', e => {
  const t = e.target;
  const a = t.closest('[data-add]'); if (a) { add(a.dataset.add, 1, a.closest('#cart') ? null : a.getBoundingClientRect()); return; }
  const d = t.closest('[data-dec]'); if (d) { setQty(d.dataset.dec, (cart[d.dataset.dec] || 0) - 1); return; }
  const o = t.closest('[data-open]'); if (o) { openSheet(o.dataset.open); return; }
  if (t.closest('#cartBtn') || t.closest('[data-open-cart]')) { openPanel('cart'); return; }
  if (t.closest('[data-close]') || t === $('#ov')) closeAll();
});

/* ================= COUNTS / FLY / TOAST ================= */
function updateCounts(bump) {
  const p = price();
  $('#cnt').textContent = p.n;
  $('#obarTxt').innerHTML = `${p.n} cup${p.n === 1 ? '' : 's'} · <b>${money(p.total)}</b>`;
  $('#obar').classList.toggle('on', p.n > 0 && !openId);
  if (bump && !reduce) { const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  renderNow();
}
function fly(r, f) {
  if (!r || reduce) return;
  const d = document.createElement('div'); d.className = 'fly'; d.style.setProperty('--c', f.lid); document.body.appendChild(d);
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, t = $('#cartBtn').getBoundingClientRect(), x1 = t.left + t.width / 2, y1 = t.top + t.height / 2;
  d.style.left = x0 + 'px'; d.style.top = y0 + 'px';
  d.animate([{ transform: 'translate(0,0) scale(1) rotate(0)' }, { transform: `translate(${(x1 - x0) * .5}px,${Math.min(y0, y1) - y0 - 110}px) scale(1.2) rotate(200deg)`, offset: .5 }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.3) rotate(360deg)`, opacity: .6 }], { duration: 850, easing: 'cubic-bezier(.45,0,.55,1)' }).onfinish = () => d.remove();
}
let tt; function toast(s) { const el = $('#toast'); el.textContent = s; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2200); $('#live').textContent = s; }

/* ================= WHOLESALE ================= */
$('#wsForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#wsName').value.trim();
  $('#wsErr').textContent = name ? '' : 'Tell us the name of your place.';
  if (!name) { $('#wsName').focus(); return; }
  const txt = `Wholesale request for AK Bowl\n${name} (${$('#wsType').value})\nAbout ${$('#wsQty').value} cups per week\nArea: ${$('#wsArea').value.trim() || '-'}`;
  if (ORDER_WHATSAPP) openWA(txt);
  else toast('Demo mode: request not sent');
  e.target.reset();
});

/* ================= SCROLL / REVEAL / LOADER ================= */
$('#igTop').href = AK.instagram; $('#igFoot').href = AK.instagram;
if (ORDER_WHATSAPP) $('#waFoot').href = `https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent('Hi AK Bowl!')}`; else $('#waFoot').remove();
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
$$('.reveal').forEach(el => rio.observe(el));
function onScroll() { $('#hd').classList.toggle('solid', scrollY > 30); layers(); }
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', layers);

(function loader() {
  const el = $('#loader'); let seen = false;
  try { seen = sessionStorage.getItem('ak-intro') === '1'; sessionStorage.setItem('ak-intro', '1'); } catch (e) {}
  const go = () => { el.classList.add('out'); document.documentElement.classList.add('ready'); setTimeout(() => el.remove(), 800); };
  if (seen || reduce) { el.remove(); document.documentElement.classList.add('ready'); return; }
  setTimeout(go, 1500);
})();

/* ================= OWNER SETTINGS: texts, banner, closed, preview ================= */
(function settings() {
  const full = AK.box.size * AK.price, saveAmt = full - AK.box.price;
  const K = { cup: money(AK.price), box: money(AK.box.price), full: money(full), save: money(saveAmt), n: AK.box.size, nw: (WORD[AK.box.size] || AK.box.size) };
  $$('[data-k]').forEach(el => { const v = K[el.dataset.k]; el.textContent = el.dataset.cap ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : v; });
  if (saveAmt <= 0) $$('[data-k="full"], .perk-save').forEach(el => el.remove());
  if (money(AK.price).length > 3) $('.ring').classList.add('long');
  const msg = !AK.open ? (AK.closedMsg || "We're closed right now.") : AK.banner && AK.banner.on && AK.banner.text;
  if (msg) { const el = $('#ann'); el.textContent = msg; el.hidden = false; el.classList.toggle('closed', !AK.open); document.body.classList.add('has-ann'); }
  if (window.AK_PREVIEW) { const b = document.createElement('div'); b.className = 'preview-pill'; b.textContent = 'Preview · not published yet'; document.body.appendChild(b); }
})();

if ($('#yr')) $('#yr').textContent = new Date().getFullYear();
setFlavor(BUY()[0] || FL[0]); updateCounts(); onScroll();
