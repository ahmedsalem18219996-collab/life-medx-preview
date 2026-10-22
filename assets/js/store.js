/* Store — thin layer over Domain.
   server mode: the local server (server/server.mjs) owns the data; every change goes through its API and is pushed live to all users.
   local mode:  no server reachable (opened as a file / static host / preview) → offline demo in this browser's localStorage. */
(function (App) {
  'use strict';
  const D = window.Domain;
  const U = App.util;
  const KEY = 'lmx_erp_state_v2';
  const SESSION = 'lmx_erp_session';
  App.meta = D.META;

  const S = App.store = { mode: 'local', state: null, version: 0, preview: true };
  const listeners = new Set();
  S.onChange = (fn) => listeners.add(fn);
  const changed = (source) => listeners.forEach((fn) => fn(source));

  /* ---------------- boot ---------------- */
  async function api(path, body) {
    let r;
    try {
      r = await fetch('api/' + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { const err = new Error('النت فاصل أو السيرفر مش بيرد — جرّب تاني'); err.network = true; throw err; }
    let j = null; try { j = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok) { const err = new Error(j?.error || 'تعذر الاتصال بالسيرفر'); err.status = r.status; throw err; }
    return j;
  }
  S.api = api;

  S.init = async () => {
    // Standalone guest preview: never contact company servers or Supabase.
    // Use freshly generated, synthetic demo values on every page load.
    S.mode = 'local';
    S.state = D.seed(window.SEED_PRODUCTS, window.SEED_CONTRACT);
  };

  /* ---------------- server mode ---------------- */
  S.pull = async () => {
    const j = await api('state');
    S._me = j.userId; S.accounts = j.accounts || {};
    if (j.state) { S.state = j.state; S.version = j.version; }
    if (S._me) connectEvents();
  };
  let es;
  function connectEvents() {
    if (es || !window.EventSource) return;
    es = new EventSource('api/events');
    es.onmessage = async (e) => {
      const { version } = JSON.parse(e.data);
      if (version > S.version) { try { await S.pull(); changed('remote'); } catch (err) { /* retry on next event */ } }
    };
    es.onerror = () => { App.ui && document.body.classList.add('offline'); };
    es.onopen = () => document.body.classList.remove('offline');
  }

  /* ---------------- local mode ---------------- */
  function loadLocal() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s.version === 1) return s; } } catch (e) { /* storage unavailable */ }
    return D.seed(window.SEED_PRODUCTS, window.SEED_CONTRACT);
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S.state)); } catch (e) { /* ignore */ } }

  /** Run a domain action. Resolves with its result; rejects with an Error whose message is user-facing Arabic. */
  S.act = async (name, payload) => {
    if (S.preview) throw new Error('دي نسخة عرض تجريبية للقراءة فقط — مفيش حفظ أو تعديل بيانات.');
    if (S.mode === 'server') {
      const j = await api('action', { name, payload });
      S.state = j.state; S.version = j.version;
      changed('self');
      return j.result;
    }
    const { state, result } = D.run(S.state, name, payload, { userId: S.session() });
    S.state = state; saveLocal(); changed('self');
    return result;
  };

  S.reset = async () => {
    if (S.preview) throw new Error('إعادة الضبط غير متاحة في نسخة العرض.');
    if (S.mode === 'server') { const j = await api('admin/reset', {}); S.state = j.state; S.version = j.version; }
    else { S.state = D.seed(window.SEED_PRODUCTS, window.SEED_CONTRACT); saveLocal(); }
    changed('self');
  };
  S.restore = async (s) => {
    if (S.preview) throw new Error('استيراد الملفات غير متاح في نسخة العرض.');
    if (!s || s.version !== 1 || !Array.isArray(s.products)) throw new Error('الملف مش سليم');
    if (S.mode === 'server') { const j = await api('admin/restore', { state: s }); S.state = j.state; S.version = j.version; }
    else { S.state = s; saveLocal(); }
    changed('self');
  };

  /* ---------------- session ---------------- */
  S.session = () => {
    if (S.mode === 'server') return S._me || null;
    try { return localStorage.getItem(SESSION); } catch (e) { return S._sess; }
  };
  S.login = (userId) => { S._sess = userId; try { localStorage.setItem(SESSION, userId); } catch (e) { /* ignore */ } };
  S.loginWithPassword = async (username, password) => { await api('login', { username, password }); await S.pull(); };
  S.logout = async () => {
    if (S.mode === 'server') { try { await api('logout', {}); } catch (e) { /* already gone */ } S._me = null; if (es) { es.close(); es = null; } return; }
    S._sess = null; try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
  };
  S.me = () => (S.state && S.state.users.find((u) => u.id === S.session() && u.active)) || null;
  S.can = (module, level = 1) => {
    if (S.preview && level > 1) return false;
    const me = S.me();
    return !!me && (S.state.perms[me.role]?.[module] || 0) >= level;
  };
  S.myRepId = () => (S.me()?.role === 'sales' ? S.me().repId : null);

  /* ---------------- lookups ---------------- */
  const st = () => S.state;
  S.product = (id) => D.Q.product(st(), id);
  S.customer = (id) => D.Q.customer(st(), id);
  S.rep = (id) => D.Q.rep(st(), id);
  S.user = (id) => D.Q.user(st(), id);
  S.warehouse = (id) => D.Q.warehouse(st(), id);
  S.lotsOf = (pid, wh) => D.Q.lotsOf(st(), pid, wh);
  S.stock = (pid, wh) => D.Q.stock(st(), pid, wh);
  S.allocate = (pid, wh, qty) => D.Q.allocate(st(), pid, wh, qty);
  S.priceFor = (pid, cid) => D.Q.priceFor(st(), pid, cid);
  S.orderTotal = D.Q.orderTotal;
  S.reserved = (pid) => D.Q.reserved(st(), pid);
  S.stockStatus = (p) => {
    const q = S.stock(p.id);
    if (q === 0) return { key: 'out', name: 'نفد المخزون', badge: 'b-danger', color: 'var(--danger)' };
    if (q < p.minStock) return { key: 'low', name: 'تحت حد الطلب', badge: 'b-warning', color: 'var(--warning)' };
    return { key: 'ok', name: 'متوفر', badge: 'b-success', color: 'var(--success)' };
  };
  S.daysToExpiry = (lot) => U.daysBetween(new Date(), lot.expiry);
  S.expiringLots = () => st().lots.filter((l) => l.qty > 0 && S.daysToExpiry(l) <= st().settings.expiryWarnDays).sort((a, b) => a.expiry.localeCompare(b.expiry));
  // cost prices are for the admin only (warehouse works with quantities, reps with selling prices)
  S.seesCost = () => S.me()?.role === 'admin';
  S.inventoryValue = () => U.sum(st().lots, (l) => l.qty * (S.product(l.productId)?.cost || 0));

  S.notifications = () => {
    const me = S.me(); const out = [];
    if (!me) return out;
    if (me.role !== 'sales') {
      st().products.forEach((p) => { const s = S.stockStatus(p); if (s.key !== 'ok') out.push({ icon: 'alert', tint: s.key === 'out' ? 'tint-danger' : 'tint-warning', title: `${s.name}: ${p.shortAr}`, sub: `الرصيد ${S.stock(p.id)} — حد الطلب ${p.minStock}`, href: '#/inventory' }); });
      S.expiringLots().slice(0, 4).forEach((l) => out.push({ icon: 'clock', tint: 'tint-danger', title: `تشغيلة قاربت الانتهاء ${l.lot}`, sub: `${S.product(l.productId).shortAr} — متبقي ${S.daysToExpiry(l)} يوم`, href: '#/inventory' }));
    }
    if (me.role === 'admin') {
      const pend = st().orders.filter((o) => o.status === 'pending');
      if (pend.length) out.unshift({ icon: 'cart', tint: 'tint-accent', title: `${pend.length} أوامر بيع مستنية اعتمادك`, sub: 'اضغط عشان تراجعها', href: '#/orders' });
    }
    const rep = S.myRepId();
    // order hand-offs, derived from the order itself so every role sees its next step
    const approved = st().orders.filter((o) => o.status === 'approved' && (!rep || o.repId === rep));
    if (me.role === 'warehouse' || me.role === 'admin') {
      const wait = approved.filter((o) => !o.issuedMovementId);
      if (wait.length) out.unshift({ icon: 'truck', tint: 'tint-info', title: `${wait.length} أوامر بيع معتمدة مستنية تجهيز`, sub: 'جهّزها بالتشغيلات الأقرب انتهاءً', href: '#/dashboard' });
    }
    if (rep) {
      approved.forEach((o) => out.unshift(o.issuedMovementId
        ? { icon: 'truck', tint: 'tint-success', title: `طلب ${o.no} جاهز للتسليم`, sub: `${S.customer(o.customerId).name} — المخزن صرفه`, href: '#/orders' }
        : { icon: 'check', tint: 'tint-info', title: `اتعتمد طلب ${o.no}`, sub: `${S.customer(o.customerId).name} — مستني المخزن يجهّزه`, href: '#/orders' }));
    }
    st().cases.filter((c) => c.status === 'scheduled' && U.daysBetween(new Date(), c.date) <= 2 && (!rep || c.repId === rep))
      .forEach((c) => out.unshift({ icon: 'pulse', tint: 'tint-info', title: `عملية قريبة: ${c.procedure}`, sub: `${S.customer(c.customerId).name} — ${U.date(c.date)}`, href: '#/cases' }));
    return out;
  };
})(window.App);
