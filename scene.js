/* AK Bowl 3D hero: a clear protein cup with crumb base, cream and topping layers,
   a printed sleeve and a floating lid. Lid art and sleeve are drawn on canvases per flavor.
   API: window.AKScene.setFlavor(flavorObject) */
import * as THREE from 'three';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';

const host = document.getElementById('stage3d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function fail() { document.documentElement.classList.add('no3d'); }

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { fail(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xfff3e0, 0x8a5a3a, 0.9));
const key = new THREE.DirectionalLight(0xffe2bf, 2.2); key.position.set(4, 6, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xffd8a8, 1.4); rim.position.set(-5, 3, -4); scene.add(rim);

const world = new THREE.Group(); scene.add(world);
const cup = new THREE.Group(); world.add(cup);

/* ---------- cup geometry ---------- */
const H = 1.45, R0 = 1.0, R1 = 1.22;
const rAt = y => R0 + (R1 - R0) * (y / H);
const prof = [];
prof.push(new THREE.Vector2(0.001, 0), new THREE.Vector2(R0 - 0.06, 0), new THREE.Vector2(R0, 0.05));
for (let i = 1; i <= 20; i++) { const y = 0.05 + (H - 0.05) * i / 20; prof.push(new THREE.Vector2(rAt(y), y)); }
prof.push(new THREE.Vector2(R1 + 0.07, H + 0.02), new THREE.Vector2(R1 + 0.08, H + 0.07), new THREE.Vector2(R1 + 0.02, H + 0.08));
const cupGeo = new THREE.LatheGeometry(prof, 96);
const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.1 });
const cupMesh = new THREE.Mesh(cupGeo, cupMat); cupMesh.renderOrder = 3; cup.add(cupMesh);
const fres = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  uniforms: { uColor: { value: new THREE.Color(0xfff6ea) } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))), 2.4); gl_FragColor = vec4(uColor*f*0.9, f*0.9); }',
});
const edge = new THREE.Mesh(cupGeo, fres); edge.renderOrder = 4; cup.add(edge);

/* ---------- canvases ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function speckle(ctx, w, h, n, cols) { for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % cols.length]; const s = Math.random() * 2.2 + .4; ctx.globalAlpha = Math.random() * .5 + .1; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, s, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }

const crumbC = canvas(512, 256), cc = crumbC.getContext('2d');
cc.fillStyle = '#C9A06A'; cc.fillRect(0, 0, 512, 256); speckle(cc, 512, 256, 2600, ['#E2C18C', '#A87A45', '#F0D7A8', '#8E6236']);
const crumbTex = new THREE.CanvasTexture(crumbC); crumbTex.colorSpace = THREE.SRGBColorSpace; crumbTex.wrapS = THREE.RepeatWrapping; crumbTex.repeat.set(3, 1);

const inset = 0.035;
function layer(y0, y1, mat) {
  const g = new THREE.CylinderGeometry(rAt(y1) - inset, rAt(y0) - inset, y1 - y0, 72, 1, false);
  const m = new THREE.Mesh(g, mat); m.position.y = (y0 + y1) / 2; m.renderOrder = 1; cup.add(m); return m;
}
const crumbMat = new THREE.MeshStandardMaterial({ map: crumbTex, roughness: .95 });
layer(0.03, 0.36, crumbMat);
const creamMat = new THREE.MeshPhysicalMaterial({ color: 0x8a5a33, roughness: .42, clearcoat: .35, clearcoatRoughness: .4, sheen: .4, sheenColor: new THREE.Color(0xffffff) });
layer(0.36, 1.06, creamMat);
const topMat = new THREE.MeshStandardMaterial({ color: 0x3a2016, roughness: .55 });
layer(1.06, 1.2, topMat);
// chips / crumbs on top
const CHIPS = 70, chipGeo = new THREE.DodecahedronGeometry(0.05, 0);
const chipMat = new THREE.MeshStandardMaterial({ color: 0x2a160e, roughness: .6 });
const chips = new THREE.InstancedMesh(chipGeo, chipMat, CHIPS);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
for (let i = 0; i < CHIPS; i++) {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (rAt(1.2) - 0.12);
  V.set(Math.cos(a) * r, 1.21 + Math.random() * 0.03, Math.sin(a) * r);
  Q.setFromEuler(E.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)); const s = 0.6 + Math.random() * 1.1; S.set(s, s * .7, s);
  chips.setMatrixAt(i, M.compose(V, Q, S));
}
chips.renderOrder = 1; cup.add(chips);

/* sleeve */
const sleeveC = canvas(512, 560), sctx = sleeveC.getContext('2d');
const sleeveTex = new THREE.CanvasTexture(sleeveC); sleeveTex.colorSpace = THREE.SRGBColorSpace; sleeveTex.anisotropy = 4;
const SL0 = 0.1, SL1 = H - 0.05, TH = 1.2;
const sleeveGeo = new THREE.CylinderGeometry(rAt(SL1) + 0.012, rAt(SL0) + 0.012, SL1 - SL0, 48, 1, true, -TH / 2, TH);
const sleeve = new THREE.Mesh(sleeveGeo, new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: .85, side: THREE.DoubleSide }));
sleeve.position.y = (SL0 + SL1) / 2; sleeve.renderOrder = 2; cup.add(sleeve);

/* lid */
const lidC = canvas(1024, 1024), lctx = lidC.getContext('2d');
const lidTex = new THREE.CanvasTexture(lidC); lidTex.colorSpace = THREE.SRGBColorSpace; lidTex.anisotropy = 8;
const LR = 1.36;
const lidGeo = new THREE.CylinderGeometry(LR, LR, 0.03, 96);
const paper = new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: .9 });
const lidFace = new THREE.MeshStandardMaterial({ map: lidTex, roughness: .85, envMapIntensity: .45 });
const lid = new THREE.Mesh(lidGeo, [paper, lidFace, lidFace]);   // art on both faces so the flip never shows a blank disc
const lidPivot = new THREE.Group(); lidPivot.add(lid); world.add(lidPivot);
lid.rotation.x = Math.PI / 2;           // top face now looks at the camera (+z)
lid.rotation.y = Math.PI / 2;           // turn the cap so the art reads upright

const pod = new Image(); pod.src = 'assets/pod.png';

function fitFont(ctx, text, weight, size, family, maxW) { let s = size; do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 10); }
function drawLid(f) {
  const c = lctx, W = 1024, C = 512;
  c.clearRect(0, 0, W, W); c.save(); c.beginPath(); c.arc(C, C, 512, 0, 7); c.clip();
  c.fillStyle = '#F4EAD8'; c.fillRect(0, 0, W, W); speckle(c, W, W, 1800, ['#E6D6BA', '#D9C4A0', '#FFF8EA']);
  // flavour wave
  c.fillStyle = f.lid; c.beginPath(); c.moveTo(0, 650);
  c.bezierCurveTo(220, 560, 360, 760, 560, 680); c.bezierCurveTo(760, 600, 880, 560, 1024, 610); c.lineTo(1024, 1024); c.lineTo(0, 1024); c.fill();
  c.globalAlpha = .18; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, 690); c.bezierCurveTo(220, 600, 360, 800, 560, 720); c.bezierCurveTo(760, 640, 880, 600, 1024, 650); c.lineTo(1024, 670); c.bezierCurveTo(880, 625, 760, 665, 560, 745); c.bezierCurveTo(360, 825, 220, 625, 0, 715); c.fill(); c.globalAlpha = 1;
  // arc slogan
  const txt = 'BE STRONG • BE UNIQUE • BE HEALTHY';
  c.fillStyle = f.ink; c.font = '800 50px "League Spartan", "Montserrat", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const rad = 418, total = Math.PI * 0.86; let w = 0; const ws = [...txt].map(ch => { const m = c.measureText(ch).width + 3; w += m; return m; });
  let ang = -Math.PI / 2 - (w / rad) / 2;
  [...txt].forEach((ch, i) => { const a = ang + ws[i] / 2 / rad; c.save(); c.translate(C + Math.cos(a) * rad, C + Math.sin(a) * rad); c.rotate(a + Math.PI / 2); c.fillText(ch, 0, 0); c.restore(); ang += ws[i] / rad; });
  // pod mark tinted
  if (pod.complete && pod.naturalWidth) { const t = canvas(110, 110), tc = t.getContext('2d'); tc.drawImage(pod, 0, 0, 110, 110); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = f.ink; tc.fillRect(0, 0, 110, 110); c.drawImage(t, C - 55, 168); }
  // AK BOWL script
  c.fillStyle = f.ink; c.strokeStyle = f.ink; c.lineWidth = 3.5; c.font = '400 140px "Pinyon Script", "Great Vibes", cursive'; c.fillText('AK Bowl', C + 6, 340); c.strokeText('AK Bowl', C + 6, 340);
  c.font = '400 34px "Pinyon Script", cursive'; c.fillText('Healthy Eats', C + 150, 402);
  // three blocks
  c.fillStyle = '#2C1810';
  c.font = '800 70px "League Spartan", sans-serif'; c.fillText(`${f.lidP || f.p} G`, 238, 470);
  c.font = '800 44px "League Spartan", sans-serif'; c.fillText('PROTEIN', 238, 526);
  c.font = '700 34px "League Spartan", sans-serif'; c.fillText('MIXED BY', C, 456);
  c.fillStyle = f.ink; fitFont(c, f.name.toUpperCase(), 800, 70, '"League Spartan", sans-serif', 300); c.fillText(f.name.toUpperCase(), C, 516);
  c.fillStyle = '#2C1810'; c.font = '700 34px "League Spartan", sans-serif'; c.fillText('NO ADDED', 790, 456);
  c.fillStyle = f.ink; c.font = '800 60px "League Spartan", sans-serif'; c.fillText('SUGAR', 790, 512);
  // emblem in the wave
  c.fillStyle = 'rgba(255,248,236,.95)'; c.strokeStyle = 'rgba(255,248,236,.95)'; c.lineWidth = 2; c.font = '400 76px "Pinyon Script", cursive'; c.fillText('Be strong', C, 846); c.strokeText('Be strong', C, 846);
  c.restore();
  c.strokeStyle = 'rgba(80,50,30,.25)'; c.lineWidth = 6; c.beginPath(); c.arc(C, C, 506, 0, 7); c.stroke();
  lidTex.needsUpdate = true;
}
function pill(c, x, y, w, h) { const r = h / 2; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawSleeve(f) {
  const c = sctx, W = 512, Hh = 560;
  c.fillStyle = '#F4EBDC'; c.fillRect(0, 0, W, Hh); speckle(c, W, Hh, 600, ['#E3D2B4', '#FFF8EC']);
  c.fillStyle = f.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '800 46px "League Spartan", sans-serif'; c.fillText('CALORIES', W / 2, 96);
  const rows = [`${f.p} G protein`, f.c != null ? `${f.c} G choco` : '— choco', f.k != null ? `${f.k} kcal` : '— kcal', f.f != null ? `${f.f} g fat` : '— fat'];
  rows.forEach((t, i) => { const y = 150 + i * 92; c.strokeStyle = f.ink; c.lineWidth = 5; pill(c, 96, y, 320, 70); c.stroke(); c.fillStyle = '#2C1810'; c.font = 'italic 800 36px "Montserrat", sans-serif'; c.fillText(t, W / 2, y + 37); });
  sleeveTex.needsUpdate = true;
}

/* floating chocolate pieces */
const floaters = [];
const chunkGeo = new THREE.BoxGeometry(0.42, 0.42, 0.13, 1, 1, 1);
const chunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2716, roughness: .45, metalness: .05 });
[[-1.75, 3.2, -0.8, .7], [2.3, 0.6, 0.4, .8], [-1.7, 0.3, 0.6, .6], [2.0, 3.3, -1.2, .75], [-2.2, 1.6, -2.6, .7], [2.9, 1.9, -2.4, .9]].forEach(([x, y, z, s], i) => {
  const m = new THREE.Mesh(chunkGeo, chunkMat); m.position.set(x, y, z); m.scale.setScalar(s);
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  m.userData = { b: m.position.clone(), ph: Math.random() * 6, sp: .4 + Math.random() * .5, r: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.6) };
  world.add(m); floaters.push(m);
});
const CR = 90, crumbs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.035, 0), new THREE.MeshStandardMaterial({ color: 0xd2a66a, roughness: .9 }), CR);
const cd = Array.from({ length: CR }, () => ({ x: (Math.random() - .5) * 8, y: Math.random() * 4.5 - .3, z: (Math.random() - .5) * 4 - 1, v: .05 + Math.random() * .12, ph: Math.random() * 6, s: .6 + Math.random() * 1.4 }));
world.add(crumbs);

/* soft shadow */
const shC = canvas(128, 128), shx = shC.getContext('2d'); const g = shx.createRadialGradient(64, 64, 4, 64, 64, 64);
g.addColorStop(0, 'rgba(70,40,20,.5)'); g.addColorStop(1, 'rgba(70,40,20,0)'); shx.fillStyle = g; shx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shC), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; world.add(shadow);

/* ---------- layout ---------- */
let narrow = false;
function layout() {
  const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  narrow = w / h < 0.95;
  if (narrow) { camera.position.set(0, 2.9, 11.2); camera.lookAt(0, 2.05, 0); }
  else { camera.position.set(0, 2.5, 12); camera.lookAt(0, 1.75, 0); }
  if (narrow) camera.clearViewOffset(); else camera.setViewOffset(w, h, -w * Math.min(0.22, (w / h - 0.95) * 0.3), 0, w, h);
  camera.updateProjectionMatrix();
}
layout(); addEventListener('resize', layout);

/* ---------- flavour switching ---------- */
let cur = null, flip = 0, pending = null;
const fillCol = new THREE.Color(), fillTgt = new THREE.Color(), topCol = new THREE.Color(), topTgt = new THREE.Color();
function apply(f) { drawLid(f); drawSleeve(f); }
window.AKScene = {
  setFlavor(f) {
    fillTgt.set(f.fill); topTgt.set(f.top);
    if (!cur || reduce) { cur = f; fillCol.copy(fillTgt); topCol.copy(topTgt); apply(f); return; }
    cur = f; pending = f; flip = 0.0001;
  },
};
if (document.fonts) Promise.all(['800 50px "League Spartan"', '700 34px "League Spartan"', 'italic 800 36px Montserrat', '400 64px "Pinyon Script"'].map(f => document.fonts.load(f).catch(() => {})))
  .then(() => document.fonts.ready).then(() => { if (cur) apply(cur); });
pod.onload = () => { if (cur) drawLid(cur); };

/* ---------- input ---------- */
let spin = 0, vel = 0, dragging = false, lastX = 0, px = 0, py = 0;
host.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; host.setPointerCapture(e.pointerId); host.classList.add('grab'); });
host.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; vel = dx * 0.006; spin += vel; });
const up = () => { dragging = false; host.classList.remove('grab'); };
host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
addEventListener('pointermove', e => { px = e.clientX / innerWidth * 2 - 1; py = e.clientY / innerHeight * 2 - 1; }, { passive: true });

/* ---------- loop ---------- */
let visible = true, raf = 0, last = performance.now(); const t0 = last;
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }).observe(host);
document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
const ease = t => 1 - Math.pow(1 - t, 3);
let tx = 0, ty = 0;
function tick(now) {
  raf = 0; if (!visible || document.hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
  const intro = reduce ? 1 : ease(Math.min(1, Math.max(0, (t - 0.3) / 1.4)));
  const sc = Math.min(1, scrollY / innerHeight);
  // cup spin: idle sway + drag inertia
  if (!dragging) { spin += vel; vel *= 0.94; if (!reduce) spin += dt * 0.25; }
  cup.rotation.y = spin + Math.sin(t * .5) * .05;
  cup.position.y = (1 - intro) * -2.2;
  cup.scale.setScalar(0.7 + 0.3 * intro);
  tx += (px - tx) * .05; ty += (py - ty) * .05;
  world.rotation.y = tx * 0.18; world.rotation.x = ty * 0.06;
  world.position.y = sc * 1.2;
  // lid: drops in, floats, flips on flavour change
  const lidY = H + 1.3 + (1 - intro) * 3 + Math.sin(t * 1.3) * (reduce ? 0 : 0.05) + sc * 0.9;
  lidPivot.position.set(0, lidY, 0.25);
  let fl = 0;
  if (flip > 0) { flip += dt / 0.7; if (pending && flip >= 0.5) { apply(pending); pending = null; } if (flip >= 1) flip = 0; fl = flip; }
  lidPivot.rotation.set(-0.32 - sc * 0.5 + Math.sin(t * .9) * .03, Math.sin(t * .6) * .12 + ease(fl) * Math.PI * 2, Math.sin(t * .7) * .04);
  // colours
  fillCol.lerp(fillTgt, 0.08); topCol.lerp(topTgt, 0.08);
  creamMat.color.copy(fillCol); topMat.color.copy(topCol); chipMat.color.copy(topCol).multiplyScalar(0.7);
  // floaters
  floaters.forEach(m => { const u = m.userData; m.position.y = u.b.y + Math.sin(t * u.sp + u.ph) * 0.18; m.rotation.x += u.r.x * dt; m.rotation.y += u.r.y * dt; m.visible = intro > .2; });
  cd.forEach((d, i) => { let y = d.y + ((t * d.v) % 4.8); if (y > 4.5) y -= 4.8; V.set(d.x + Math.sin(t * .4 + d.ph) * .15, y, d.z); Q.setFromEuler(E.set(t * .3 + d.ph, d.ph, 0)); S.setScalar(d.s); crumbs.setMatrixAt(i, M.compose(V, Q, S)); });
  crumbs.instanceMatrix.needsUpdate = true;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(tick);
}
document.documentElement.classList.add('has3d');
raf = requestAnimationFrame(tick);
