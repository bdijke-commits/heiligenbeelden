// Mijn Heiligenbeelden — app-logica
import { firebaseConfig, OWNER_EMAIL } from './config.js';

const $ = id => document.getElementById(id);
const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('VUL-IN');
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/* ================= toestand ================= */
let beelden = [];      // [{id, naam, oms, mat, hoogte, periode, herkomst, fd:'MM-DD', attr, patroon, verhaal, fotos:[{id,th}], t}]
let prive = {};        // id -> {hoe, wanneer, waar, prijs, van, notitie}  (alleen eigenaar)
let comments = [];     // [{id, beeld, naam, tekst, uid, t:Date|null}]
let isOwner = false, myUid = null;
const fotoCache = new Map();
const byId = id => beelden.find(b => b.id === id);

/* ================= opslag: Firebase of demo ================= */
const api = DEMO ? demoBackend() : await firebaseBackend();

function demoBackend() {
  $('demoBanner').hidden = false;
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } };
  const L = { b: [], p: [], c: [], a: [] };
  const emitB = () => { const o = get('hb-beelden', {}); L.b.forEach(f => f(Object.entries(o).map(([id, v]) => ({ id, ...v })))) };
  const emitP = () => L.p.forEach(f => f(get('hb-prive', {})));
  const emitC = () => L.c.forEach(f => f(get('hb-reacties', []).map(c => ({ ...c, t: new Date(c.t) }))));
  let owner = get('hb-owner', false);
  const rid = () => Math.random().toString(36).slice(2, 12);
  return {
    onBeelden(cb) { L.b.push(cb); emitB() },
    onPrive(cb) { L.p.push(cb); emitP() },
    onComments(cb) { L.c.push(cb); emitC() },
    onAuth(cb) { L.a.push(cb); cb({ owner, uid: 'demo' }) },
    async saveBeeld(id, data) { const o = get('hb-beelden', {}); id = id || rid(); o[id] = data; put('hb-beelden', o); emitB(); return id },
    async savePrive(id, data) { const o = get('hb-prive', {}); o[id] = data; put('hb-prive', o); emitP() },
    async deleteBeeld(id) { const o = get('hb-beelden', {}); delete o[id]; put('hb-beelden', o); const p = get('hb-prive', {}); delete p[id]; put('hb-prive', p); emitB(); emitP() },
    async addFoto(img) { const id = rid(); if (!put('hb-foto-' + id, img)) throw new Error('Browseropslag vol (demo-modus)'); return id },
    async getFoto(id) { return get('hb-foto-' + id, null) },
    async delFoto(id) { try { localStorage.removeItem('hb-foto-' + id) } catch { } },
    async addComment(c) { const a = get('hb-reacties', []); a.push({ ...c, id: rid(), uid: 'demo', t: Date.now() }); put('hb-reacties', a); emitC() },
    async delComment(cid) { put('hb-reacties', get('hb-reacties', []).filter(x => x.id !== cid)); emitC() },
    async login() { owner = true; put('hb-owner', true); L.a.forEach(f => f({ owner, uid: 'demo' })) },
    async logout() { owner = false; put('hb-owner', false); L.a.forEach(f => f({ owner, uid: 'demo' })) },
  };
}

async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }) }
  catch { db = F.getFirestore(app) }
  const ownerOf = u => !!(u && !u.isAnonymous && u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
  let unPrive = null, priveCb = () => { };
  return {
    onBeelden(cb) {
      F.onSnapshot(F.collection(db, 'beelden'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => setSync('', 'De verzameling kon niet geladen worden. Controleer de Firestore-regels.'));
    },
    onPrive(cb) { priveCb = cb },
    onComments(cb) {
      const q = F.query(F.collection(db, 'reacties'), F.orderBy('t', 'desc'), F.limit(1000));
      F.onSnapshot(q, s => cb(s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, t: x.t ? x.t.toDate() : null } })), () => { });
    },
    onAuth(cb) {
      A.onAuthStateChanged(auth, u => {
        const own = ownerOf(u);
        if (unPrive) { unPrive(); unPrive = null }
        if (own) unPrive = F.onSnapshot(F.collection(db, 'prive'), s => { const o = {}; s.docs.forEach(d => o[d.id] = d.data()); priveCb(o) }, () => { });
        else priveCb({});
        cb({ owner: own, uid: u ? u.uid : null });
      });
    },
    async saveBeeld(id, data) { const r = id ? F.doc(db, 'beelden', id) : F.doc(F.collection(db, 'beelden')); await F.setDoc(r, data); return r.id },
    savePrive: (id, data) => F.setDoc(F.doc(db, 'prive', id), data),
    async deleteBeeld(id) { await F.deleteDoc(F.doc(db, 'beelden', id)); await F.deleteDoc(F.doc(db, 'prive', id)) },
    async addFoto(img) { const r = F.doc(F.collection(db, 'fotos')); await F.setDoc(r, { img }); return r.id },
    async getFoto(id) { const s = await F.getDoc(F.doc(db, 'fotos', id)); return s.exists() ? s.data().img : null },
    delFoto: id => F.deleteDoc(F.doc(db, 'fotos', id)),
    async addComment(c) {
      if (!auth.currentUser) await A.signInAnonymously(auth);
      await F.addDoc(F.collection(db, 'reacties'), { beeld: c.beeld, naam: c.naam, tekst: c.tekst, uid: auth.currentUser.uid, t: F.serverTimestamp() });
    },
    delComment: cid => F.deleteDoc(F.doc(db, 'reacties', cid)),
    login: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    logout: () => A.signOut(auth),
  };
}

/* ================= hulpjes ================= */
function setSync(kind, txt) { $('syncDot').className = 'dot ' + (kind || ''); $('syncTxt').textContent = txt }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
const fdTekst = fd => { if (!fd) return ''; const [m, d] = fd.split('-').map(Number); return `${d} ${MAANDEN[m - 1]}` };
const vandaagFd = () => { const n = new Date(); return String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0') };
const euro = n => (n || n === 0) && n !== '' ? Number(n).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) : '';
const fmtDatum = d => d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'zojuist';

/* foto verkleinen naar een dataURL (JPEG) */
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Deze foto kon niet gelezen worden')) }; im.src = url;
  });
}
async function fullFoto(id) {
  if (fotoCache.has(id)) return fotoCache.get(id);
  const u = await api.getFoto(id); if (u) fotoCache.set(id, u); return u;
}

/* ================= filters en lijst ================= */
const F = { q: '', mat: '', sort: 'az' };
let qt; $('q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value.trim().toLowerCase(); renderList() }, 120) });
$('fMat').addEventListener('change', e => { F.mat = e.target.value; renderList() });
$('sort').addEventListener('change', e => { F.sort = e.target.value; renderList() });

const commentCount = () => { const m = new Map(); for (const c of comments) m.set(c.beeld, (m.get(c.beeld) || 0) + 1); return m };
function filtered() {
  const words = F.q ? F.q.split(/\s+/) : [];
  const r = beelden.filter(b => {
    if (F.mat && (b.mat || '').toLowerCase() !== F.mat) return false;
    const hay = [b.naam, b.oms, b.mat, b.periode, b.herkomst, b.attr, b.patroon, b.verhaal, fdTekst(b.fd)].join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });
  const az = (a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl');
  if (F.sort === 'az') r.sort(az);
  else if (F.sort === 'nieuw') r.sort((a, b) => (b.t || 0) - (a.t || 0));
  else if (F.sort === 'periode') r.sort((a, b) => (a.periode || '~').localeCompare(b.periode || '~', 'nl', { numeric: true }) || az(a, b));
  else { const v = vandaagFd(); const k = fd => fd ? (fd < v ? '1' : '0') + fd : '2'; r.sort((a, b) => k(a.fd).localeCompare(k(b.fd)) || az(a, b)) }
  return r;
}
function metaLine(b) { return [b.mat, b.hoogte ? `${String(b.hoogte).replace('.', ',')} cm` : '', b.periode].filter(Boolean).join(' · ') }
function renderList() {
  const list = filtered(), cc = commentCount(), g = $('grid');
  if (!beelden.length) {
    g.innerHTML = `<div class="empty"><p>Er staan nog geen beelden in de verzameling.</p>${isOwner ? '<button class="btn" data-new="1">+ Eerste beeld toevoegen</button>' : ''}</div>`;
  } else if (!list.length) g.innerHTML = '<p class="empty">Geen beelden gevonden met deze zoekopdracht.</p>';
  else g.innerHTML = list.map(b => {
    const th = b.fotos && b.fotos[0] && b.fotos[0].th, n = cc.get(b.id) || 0;
    return `<button class="card" data-id="${esc(b.id)}" aria-label="${esc(b.naam)}">
      <span class="niche${th ? '' : ' leeg'}"${th ? ` style="background-image:url('${th}')"` : ''}>${th ? '' : '<span>Nog geen foto</span>'}${n ? `<span class="rc">${n} ${n === 1 ? 'reactie' : 'reacties'}</span>` : ''}</span>
      <span class="nm">${esc(b.naam)}</span>
      ${metaLine(b) ? `<span class="meta">${esc(metaLine(b))}</span>` : ''}
    </button>`;
  }).join('');
  $('count').textContent = `${list.length} ${list.length === 1 ? 'beeld' : 'beelden'}`;
}
$('grid').addEventListener('click', e => {
  if (e.target.closest('[data-new]')) return openForm(null);
  const c = e.target.closest('.card'); if (c) openDetail(c.dataset.id);
});
function renderSummary() {
  $('tCount').textContent = beelden.length;
  const mats = [...new Set(beelden.map(b => (b.mat || '').trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
  const cur = F.mat;
  $('fMat').innerHTML = '<option value="">Alle materialen</option>' + mats.map(m => `<option value="${esc(m)}">${esc(m[0].toUpperCase() + m.slice(1))}</option>`).join('');
  $('fMat').value = mats.includes(cur) ? cur : ''; F.mat = $('fMat').value;
  const n = new Date(), mm = String(n.getMonth() + 1).padStart(2, '0'), v = vandaagFd();
  $('feestKop').textContent = `Feestdagen in ${MAANDEN[n.getMonth()]}`;
  const deze = beelden.filter(b => b.fd && b.fd.startsWith(mm)).sort((a, b) => a.fd.localeCompare(b.fd));
  $('feestList').innerHTML = deze.length
    ? deze.map(b => `<li class="${b.fd === v ? 'vandaag' : ''}"><button data-id="${esc(b.id)}"><b>${fdTekst(b.fd)}</b> · ${esc(b.naam)}${b.fd === v ? ' · vandaag' : ''}</button></li>`).join('')
    : `<li class="leeg">Geen feestdagen deze maand${beelden.some(b => b.fd) ? '' : ' (vul bij een beeld de feestdag in)'}.</li>`;
}
$('feestList').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) openDetail(b.dataset.id) });

/* ================= detail ================= */
let dId = null;
function openDetail(id) { dId = id; $('dDelConfirm').hidden = true; $('rMsg').textContent = ''; fillDetail(true); $('dlg').showModal() }
function fillDetail(full) {
  const b = byId(dId); if (!b) { $('dlg').close(); return }
  $('dTitle').textContent = b.naam; $('dSub').textContent = b.oms || ''; $('dSub').hidden = !b.oms;
  const rows = [['Materiaal', b.mat], ['Hoogte', b.hoogte ? `${String(b.hoogte).replace('.', ',')} cm` : ''], ['Periode', b.periode], ['Herkomst', b.herkomst],
  ['Feestdag', fdTekst(b.fd)], ['Attributen', b.attr], ['Patroon van', b.patroon], ['Toelichting', b.verhaal]].filter(r => r[1]);
  $('dInfo').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd>`).join('');
  const p = prive[dId] || {};
  const pr = [['Verkregen', p.hoe ? p.hoe[0].toUpperCase() + p.hoe.slice(1) : ''], ['Van', p.van], ['Waar', p.waar], ['Wanneer', p.wanneer], ['Prijs', euro(p.prijs)], ['Notitie', p.notitie]].filter(r => r[1]);
  $('dPrive').innerHTML = pr.length ? pr.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd>`).join('') : '<dd style="grid-column:1/-1;color:var(--muted)">Nog niets ingevuld. Via Bewerken voeg je aankoop of schenker toe.</dd>';
  if (full) showFoto(0);
  renderComments();
}
function showFoto(i) {
  const b = byId(dId), fotos = (b && b.fotos) || [];
  const big = $('dBig'); big.classList.toggle('leeg', !fotos.length); big.textContent = fotos.length ? '' : 'Nog geen foto';
  $('dStrip').hidden = fotos.length < 2;
  $('dStrip').innerHTML = fotos.map((f, j) => `<button style="background-image:url('${f.th}')" aria-label="Foto ${j + 1}" aria-current="${j === i}" data-i="${j}"></button>`).join('');
  if (!fotos.length) { big.style.backgroundImage = ''; return }
  const f = fotos[i]; big.style.backgroundImage = `url('${f.th}')`;
  fullFoto(f.id).then(u => { if (u && dId === b.id) big.style.backgroundImage = `url('${u}')` }).catch(() => { });
}
$('dStrip').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) showFoto(+b.dataset.i) });
$('dClose').addEventListener('click', () => $('dlg').close());
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close() });
$('dlg').addEventListener('close', () => { dId = null });
$('dEdit').addEventListener('click', () => { const id = dId; $('dlg').close(); openForm(id) });
$('dDel').addEventListener('click', () => { $('dDelConfirm').hidden = false });
$('dDelNo').addEventListener('click', () => { $('dDelConfirm').hidden = true });
$('dDelYes').addEventListener('click', async () => {
  const b = byId(dId); if (!b) return; $('dlg').close();
  try { await api.deleteBeeld(b.id); for (const f of b.fotos || []) api.delFoto(f.id).catch(() => { }) }
  catch (e) { setSync('', 'Verwijderen mislukt (' + (e.code || e.message) + ')') }
});

/* ================= reacties ================= */
function renderComments() {
  const cs = comments.filter(c => c.beeld === dId).slice().reverse();
  $('rList').innerHTML = cs.length ? cs.map(c => `<li><div class="rk"><span><b>${esc(c.naam)}</b> · ${fmtDatum(c.t)}</span>${(isOwner || (myUid && c.uid === myUid)) ? `<button class="del" data-c="${esc(c.id)}">Verwijderen</button>` : ''}</div>${esc(c.tekst)}</li>`).join('')
    : '<li class="geen">Nog geen reacties. Laat als eerste iets achter.</li>';
}
$('rList').addEventListener('click', async e => { const b = e.target.closest('.del'); if (!b) return; b.disabled = true; try { await api.delComment(b.dataset.c) } catch { b.disabled = false } });
try { $('rNaam').value = localStorage.getItem('hb-naam') || '' } catch { }
$('rForm').addEventListener('submit', async e => {
  e.preventDefault(); if (dId == null) return;
  const naam = $('rNaam').value.trim().slice(0, 40), tekst = $('rTekst').value.trim().slice(0, 600); if (!naam || !tekst) return;
  try { localStorage.setItem('hb-naam', naam) } catch { }
  $('rSend').disabled = true; $('rMsg').textContent = 'Plaatsen…';
  try { await api.addComment({ beeld: dId, naam, tekst }); $('rTekst').value = ''; $('rMsg').textContent = 'Geplaatst.' }
  catch (err) { $('rMsg').textContent = 'Plaatsen lukte niet (' + (err.code || 'geen verbinding') + ').' }
  finally { $('rSend').disabled = false }
});

/* ================= toevoegen / bewerken ================= */
for (let d = 1; d <= 31; d++) $('fDag').insertAdjacentHTML('beforeend', `<option value="${String(d).padStart(2, '0')}">${d}</option>`);
MAANDEN.forEach((m, i) => $('fMaand').insertAdjacentHTML('beforeend', `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`));
let fId = null, fFotos = [], fRemoved = [];   // fFotos: [{id|null, th, full?}]
const FIELDS = { fNaam: 'naam', fOms: 'oms', fMat2: 'mat', fPeriode: 'periode', fHerkomst: 'herkomst', fAttr: 'attr', fPatroon: 'patroon', fVerhaal: 'verhaal' };
const PFIELDS = { fHoe: 'hoe', fWanneer: 'wanneer', fWaar: 'waar', fVan: 'van', fNotitie: 'notitie' };
function openForm(id) {
  if (!isOwner) return;
  fId = id; fRemoved = []; const b = id ? byId(id) : {}, p = (id && prive[id]) || {};
  $('fTitle').textContent = id ? 'Beeld bewerken' : 'Beeld toevoegen';
  for (const k in FIELDS) $(k).value = b[FIELDS[k]] || '';
  for (const k in PFIELDS) $(k).value = p[PFIELDS[k]] || '';
  $('fHoogte').value = b.hoogte ?? ''; $('fPrijs').value = p.prijs ?? '';
  const [m, d] = (b.fd || '-').split('-'); $('fMaand').value = m || ''; $('fDag').value = d || '';
  fFotos = (b.fotos || []).map(f => ({ ...f }));
  $('fMsg').textContent = ''; $('fSave').disabled = false; toggleHoe(); renderFormFotos();
  $('fdlg').showModal();
}
function toggleHoe() { const h = $('fHoe').value; $('fPrijsL').hidden = h === 'gekregen' || h === 'geërfd'; $('fVanL').hidden = h === 'gekocht' }
$('fHoe').addEventListener('change', toggleHoe);
function renderFormFotos() {
  $('fFotos').innerHTML = fFotos.map((f, i) => `<div class="ft${i === 0 ? ' hoofd' : ''}" style="background-image:url('${f.th}')">
      <button type="button" class="rm" data-rm="${i}" aria-label="Foto weghalen">✕</button>
      ${i ? `<button type="button" class="mk" data-mk="${i}">Hoofdfoto</button>` : ''}</div>`).join('')
    + `<label class="addfoto">+ Foto's<br>toevoegen<input type="file" id="fFile" accept="image/*" multiple></label>`;
}
$('fFotos').addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]'), mk = e.target.closest('[data-mk]');
  if (rm) { const [f] = fFotos.splice(+rm.dataset.rm, 1); if (f.id) fRemoved.push(f.id); renderFormFotos() }
  if (mk) { const [f] = fFotos.splice(+mk.dataset.mk, 1); fFotos.unshift(f); renderFormFotos() }
});
$('fFotos').addEventListener('change', async e => {
  if (e.target.id !== 'fFile') return;
  const files = [...e.target.files]; $('fMsg').textContent = 'Foto’s verwerken…';
  for (const file of files) {
    if (fFotos.length >= 8) { $('fMsg').textContent = 'Maximaal 8 foto’s per beeld.'; break }
    try { fFotos.push({ id: null, th: await shrink(file, 360, .72), full: await shrink(file, 1400, .82) }) }
    catch (err) { $('fMsg').textContent = err.message }
  }
  if ($('fMsg').textContent === 'Foto’s verwerken…') $('fMsg').textContent = '';
  renderFormFotos();
});
$('fCancel').addEventListener('click', () => $('fdlg').close());
$('fForm').addEventListener('submit', async e => {
  e.preventDefault(); if (!isOwner) return;
  $('fSave').disabled = true; $('fMsg').textContent = 'Opslaan…';
  try {
    const fotos = [];
    for (const f of fFotos) {
      if (f.id) { fotos.push({ id: f.id, th: f.th }); continue }
      const id = await api.addFoto(f.full); fotoCache.set(id, f.full); fotos.push({ id, th: f.th });
    }
    const old = fId ? byId(fId) : null;
    const data = { fotos, t: (old && old.t) || Date.now() };
    for (const k in FIELDS) data[FIELDS[k]] = $(k).value.trim();
    data.hoogte = $('fHoogte').value === '' ? null : Number($('fHoogte').value);
    data.fd = $('fMaand').value && $('fDag').value ? `${$('fMaand').value}-${$('fDag').value}` : '';
    const pdata = {}; for (const k in PFIELDS) pdata[PFIELDS[k]] = $(k).value.trim();
    pdata.prijs = $('fPrijs').value === '' || $('fPrijsL').hidden ? null : Number($('fPrijs').value);
    if ($('fVanL').hidden) pdata.van = '';
    const id = await api.saveBeeld(fId, data);
    await api.savePrive(id, pdata);
    for (const r of fRemoved) api.delFoto(r).catch(() => { });
    $('fdlg').close();
  } catch (err) {
    $('fSave').disabled = false;
    $('fMsg').textContent = 'Opslaan lukte niet: ' + (err.code || err.message);
  }
});
$('newBtn').addEventListener('click', () => openForm(null));

/* ================= inloggen ================= */
$('loginBtn').addEventListener('click', async () => { if (isOwner) { await api.logout(); return } $('lMsg').textContent = ''; $('loginDlg').showModal() });
$('lCancel').addEventListener('click', () => $('loginDlg').close());
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('lMsg').textContent = 'Bezig…';
  try {
    await api.login($('lEmail').value.trim(), $('lPass').value);
    if (!DEMO && $('lEmail').value.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) { $('lMsg').textContent = 'Dit account mag de verzameling niet bewerken.'; await api.logout(); return }
    $('lPass').value = ''; $('loginDlg').close();
  } catch (err) {
    $('lMsg').textContent = /invalid|wrong|user-not-found|credential/.test(err.code || '') ? 'E-mailadres of wachtwoord klopt niet.' : 'Inloggen lukte niet (' + (err.code || 'onbekende fout') + ').';
  }
});

/* ================= koppelen ================= */
function connect() {
  setSync('', DEMO ? 'Demo-modus' : 'Verbinden…');
  api.onAuth(a => {
    isOwner = a.owner; myUid = a.uid;
    document.body.classList.toggle('owner', isOwner);
    $('loginBtn').textContent = isOwner ? 'Uitloggen' : 'Inloggen';
    $('lede').textContent = isOwner
      ? 'Je bent ingelogd. Voeg beelden toe, maak foto’s met je telefoon en vul het verhaal erachter in.'
      : 'Een verzameling heiligenbeelden. Klik op een beeld voor foto’s en het verhaal erachter, en laat gerust een reactie achter.';
    renderList(); if (dId) fillDetail(false);
  });
  api.onBeelden(list => {
    beelden = list;
    setSync('ok', DEMO ? 'Demo-modus · alleen in deze browser' : (navigator.onLine ? 'Bijgewerkt' : 'Offline · laatst bekende stand'));
    renderSummary(); renderList(); if (dId) fillDetail(false);
  });
  api.onPrive(p => { prive = p; if (dId) fillDetail(false) });
  api.onComments(c => { comments = c; renderList(); if (dId) renderComments() });
  window.addEventListener('online', () => setSync('ok', 'Bijgewerkt'));
  window.addEventListener('offline', () => setSync('', 'Offline · laatst bekende stand'));
}
renderSummary(); renderList(); connect();
