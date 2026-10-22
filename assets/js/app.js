/* Shell (Medica): router, login, right side nav + phone tab bar, command palette, notifications, motion. */
(function (App) {
  'use strict';
  const U = App.util, S = App.store, I = App.icon;
  App.pages = App.pages || {};

  // four sections; each holds one or more screens, shown as chips inside the section
  const lowCount = () => S.state.products.filter((p) => S.stockStatus(p).key !== 'ok').length;
  const pendingCount = () => (S.me()?.role === 'admin' ? S.state.orders.filter((o) => o.status === 'pending').length : 0);
  const NAV = [
    { key: 'home', group: 'الرئيسية', icon: 'home', items: [{ key: 'dashboard', label: 'الرئيسية', icon: 'home' }] },
    { key: 'store', group: 'المخزن', icon: 'package', count: lowCount, items: [
      { key: 'products', label: 'الأصناف', icon: 'package' },
      { key: 'inventory', label: 'الأرصدة والصلاحية', icon: 'layers' },
      { key: 'movements', label: 'الأذون والحركات', icon: 'swap' },
      { key: 'barcodes', label: 'الباركود', icon: 'barcode' },
    ] },
    { key: 'sales', group: 'المبيعات', icon: 'cart', count: pendingCount, items: [
      { key: 'orders', label: 'أوامر البيع', icon: 'cart' },
      { key: 'cases', label: 'العمليات الجراحية', icon: 'pulse' },
      { key: 'customers', label: 'المستشفيات', icon: 'hospital' },
      { key: 'reps', label: 'المناديب', icon: 'users' },
    ] },
    { key: 'admin', group: 'الإدارة', icon: 'shield', items: [
      { key: 'admin', label: 'المستخدمون والإعدادات', icon: 'shield' },
      { key: 'soon/accounts', label: 'الحسابات والتحصيل', icon: 'wallet', soon: true },
      { key: 'soon/invoices', label: 'الفواتير والمديونيات', icon: 'receipt', soon: true },
      { key: 'soon/hr', label: 'الموارد البشرية', icon: 'briefcase', soon: true },
    ] },
  ];
  const visible = (it) => (it.soon ? S.can('admin') : S.can(it.key));
  const sectionOf = (key) => NAV.find((g) => g.items.some((it) => it.key === key)) || NAV[0];
  App.roll = (text) => `<span class="roll"><span data-t="${U.esc(text)}">${U.esc(text)}</span></span>`;
  App.NAV = NAV;

  /* ---------- theme + motion preference ---------- */
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  const de = document.documentElement;
  App.applyTheme = (t) => { de.setAttribute('data-theme', t); store.set('lmx_theme', t); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#020d0d' : '#04201f'; };
  App.applyTheme(store.get('lmx_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  de.setAttribute('data-motion', store.get('lmx_motion') || 'full');
  /** Theme switch with a circular reveal from the button that was pressed. */
  function toggleTheme(btn) {
    const next = de.dataset.theme === 'dark' ? 'light' : 'dark';
    const r = btn.getBoundingClientRect();
    de.style.setProperty('--cx', `${r.left + r.width / 2}px`); de.style.setProperty('--cy', `${r.top + r.height / 2}px`);
    const go = () => { App.applyTheme(next); paintTop(); };
    if (document.startViewTransition && App.full()) {
      de.classList.add('vt-theme');
      document.startViewTransition(go).finished.finally(() => de.classList.remove('vt-theme'));
    } else go();
  }

  /* ---------- router ---------- */
  const root = document.getElementById('root');
  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, q] = h.split('?');
    const parts = path.split('/');
    return { name: parts[0], arg: parts[1], query: new URLSearchParams(q || '') };
  }
  App.go = (hash) => { location.hash = hash; };
  App.refresh = () => render();

  function render() {
    const r = parse();
    if (!S.me()) { if (r.name !== 'login') { history.replaceState(null, '', '#/login'); } return renderLogin(); }
    if (r.name === 'login') { history.replaceState(null, '', '#/dashboard'); r.name = 'dashboard'; }
    const page = App.pages[r.name];
    const cur = r.name === 'soon' ? 'soon/' + r.arg : r.name;
    const allowed = r.name === 'soon' ? S.can('admin') : S.can(r.name);
    if (!root.querySelector('.app')) root.innerHTML = shell();
    const app = root.querySelector('.app');
    app.classList.toggle('is-home', cur === 'dashboard');
    if (cur !== 'dashboard') app.classList.remove('scrolled');
    paintNav(cur);
    paintTop(page, cur);
    // fresh node each render so page-level listeners never stack up
    const old = root.querySelector('.content');
    const prevV = [...old.querySelectorAll('[data-v]')].map((e) => e.dataset.v);
    const content = old.cloneNode(false);
    content.classList.remove('enter');
    old.replaceWith(content);
    const first = cur !== lastRoute;
    if (!page || !allowed) {
      content.innerHTML = `<div class="card soon-hero"><div class="art">${I('lock', 42, 1.5)}</div><h2>مش مسموح لك تفتح الشاشة دي</h2><p class="muted">الشاشة دي مش متاحة لدور «${App.meta.ROLES[S.me().role].name}». مدير النظام يقدر يعدّل الصلاحيات من الإدارة.</p><a class="btn primary" href="#/dashboard">الرجوع للرئيسية</a></div>`;
    } else {
      content.innerHTML = subnav(cur) + page.render(r);
      page.mount && page.mount(content, r);
    }
    // entrance motion + counting numbers only when the screen changes, not on every re-render
    if (first) { lastRoute = cur; content.classList.add('enter'); countUp(content); }
    after(content, first, first ? [] : prevV);
    document.title = `${page?.title || 'Life Medx'} — لايف ميديكس`;
  }
  let lastRoute = null;

  function subnav(cur) {
    const items = sectionOf(cur).items.filter(visible);
    if (items.length < 2) return '';
    return `<nav class="subnav">${items.map((it) => `<a class="${it.key === cur ? 'on' : ''}" href="#/${it.key}">${I(it.icon, 15)}${U.esc(it.label)}${it.soon ? '<span class="soon">قريباً</span>' : ''}</a>`).join('')}</nav>`;
  }

  /** Count KPI numbers up from zero on inner screens (respects calm/reduced motion). */
  function countUp(el) {
    if (!App.full()) return;
    el.querySelectorAll('.k-value').forEach((v) => {
      const node = [...v.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
      if (!node) return;
      const text = node.textContent, m = text.match(/[\d,]+/);
      const target = +m[0].replace(/,/g, '');
      if (!target) return;
      const t0 = performance.now(), dur = 900;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        node.textContent = text.replace(m[0], Math.round(target * e).toLocaleString('en-US'));
        if (k < 1 && document.body.contains(node)) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** After each render: scroll-reveal cards, roll odometers into view, keep the nav pills in place. */
  let io = null;
  function after(content, first, prevV = []) {
    if (io) io.disconnect();
    const rvs = content.querySelectorAll('.rv');
    const all = [...content.querySelectorAll('[data-v]')];
    const from = (el) => { const v = prevV[all.indexOf(el)]; return v === undefined ? undefined : +v; };
    const roll = (scope, delay) => scope.querySelectorAll('[data-v]').forEach((el) => setTimeout(() => App.odo(el, +el.dataset.v, from(el)), delay));
    all.forEach((el) => { if (!el.closest('.rv')) setTimeout(() => App.odo(el, +el.dataset.v, from(el)), first ? 250 : 0); });
    if (!first || !App.full() || !('IntersectionObserver' in window)) {
      rvs.forEach((c) => { c.classList.add('in'); roll(c, 0); });
    } else {
      io = new IntersectionObserver((ents) => {
        let k = 0;
        ents.forEach((en) => {
          if (!en.isIntersecting) return;
          const c = en.target;
          c.style.transitionDelay = `${k++ * 90 + 200}ms`;
          c.classList.add('in');
          setTimeout(() => { c.style.transitionDelay = ''; }, 900);
          roll(c, 250);
          io.unobserve(c);
        });
      }, { threshold: 0.12 });
      rvs.forEach((c) => io.observe(c));
    }
    placePills(first);
  }

  // spotlight: let .spot cards follow the cursor
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.spot');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- shell ---------- */
  const brandMark = `<span class="mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-5 4 10 2.5-5h5"/></svg></span>`;
  App.brandMark = brandMark;
  function shell() {
    const live = S.mode === 'server';
    const guest = S.preview === true;
    return `<div class="app">
      <aside class="side" aria-label="القائمة">
        <a class="logo" href="#/dashboard">${brandMark}<div>لايف ميديكس<small>${guest ? 'GUEST · READ ONLY' : live ? 'LIVE · LIFE MEDX' : 'DEMO · LIFE MEDX'}</small></div></a>
        <nav class="snav" id="snav"><span class="pill"></span></nav>
        <div class="promo"><span class="blob bl1" style="width:140px;height:140px;top:-60px;right:-40px"></span>
          <b><span class="live-dot" style="margin-inline-end:6px"></span>${guest ? 'معاينة للقراءة فقط' : live ? 'متصل بسيرفر الشركة' : 'نسخة العرض التجريبية'}</b>
          <span>${guest ? 'كل الأسماء والبيانات وهمية — الحفظ والتعديل مقفولين.' : live ? 'أي تعديل بيوصل لكل الفريق فوراً.' : 'البيانات تجريبية ومحفوظة على المتصفح ده بس.'}</span></div>
      </aside>
      <div class="main">
        <header class="dtop">
          <div class="dtitle"><small></small><b></b></div>
          <button class="dsearch" data-act="palette" aria-label="بحث سريع">${I('search', 17)}<span class="t">ابحث عن صنف أو مستشفى…</span><span class="kbd">Ctrl K</span></button>
          <button class="cbtn" data-act="scan" title="مسح باركود" aria-label="مسح باركود">${I('scan', 19)}</button>
          <button class="cbtn" data-act="theme" title="فاتح / داكن" aria-label="تبديل الألوان"></button>
          <button class="cbtn" data-act="notif" title="التنبيهات" aria-label="التنبيهات">${I('bell', 19)}<span class="dot hidden"></span></button>
          <button class="avatar-btn" data-act="user" aria-label="حسابي"></button>
        </header>
        <main class="content"></main>
      </div>
      <nav class="tabbar" id="tabbar" aria-label="الأقسام"><span class="pill"></span></nav>
      <div class="ptr" aria-hidden="true">${I('refresh', 19, 2.2)}</div>
    </div>`;
  }

  let lastSec = null;
  function paintNav(cur) {
    const on = sectionOf(cur).key;
    const secs = NAV.map((g) => ({ g, items: g.items.filter(visible) })).filter((x) => x.items.length);
    const cnt = (g) => { const n = g.count ? g.count() : 0; return n ? `<span class="cnt">${n}</span>` : ''; };
    const sn = root.querySelector('#snav'), tb = root.querySelector('#tabbar');
    sn.innerHTML = '<span class="pill"></span>' + secs.map(({ g, items }) => `<a class="${g.key === on ? 'on' : ''}" href="#/${items[0].key}">${I(g.icon, 20)}${App.roll(g.group)}${cnt(g)}</a>`).join('');
    tb.innerHTML = '<span class="pill"></span>' + secs.map(({ g, items }) => `<a class="${g.key === on ? 'on' : ''}" href="#/${items[0].key}" aria-label="${g.group}">${I(g.icon, 21)}<span class="t">${g.group}</span>${cnt(g)}</a>`).join('');
    // carry the old pill position so it can stretch to the new tab
    sn._prev = sn._pos; tb._prev = tb._pos;
    pillMoved = lastSec !== null && lastSec !== on;
    lastSec = on;
  }
  let pillMoved = false;
  function placePill(nav, btn, vertical) {
    const p = nav && nav.querySelector('.pill');
    if (!p || !btn) return;
    nav._pos = vertical ? { a: btn.offsetTop, b: btn.offsetHeight } : { a: btn.offsetLeft, b: btn.offsetWidth };
    if (vertical) { p.style.height = btn.offsetHeight + 'px'; p.style.transform = `translateY(${btn.offsetTop}px)`; } else { p.style.width = btn.offsetWidth + 'px'; p.style.transform = `translateX(${btn.offsetLeft}px)`; }
  }
  /** The pill first stretches over both tabs, then settles on the new one (like a drop of liquid). */
  function stretchPill(nav, btn, vertical) {
    const p = nav.querySelector('.pill'), old = nav._prev;
    if (!p || !btn) return;
    if (!App.full() || !old) return placePill(nav, btn, vertical);
    p.style.transition = 'none';
    if (vertical) { p.style.height = old.b + 'px'; p.style.transform = `translateY(${old.a}px)`; } else { p.style.width = old.b + 'px'; p.style.transform = `translateX(${old.a}px)`; }
    void p.offsetWidth;
    const a = vertical ? btn.offsetTop : btn.offsetLeft, b = vertical ? btn.offsetHeight : btn.offsetWidth;
    const lo = Math.min(old.a, a), hi = Math.max(old.a + old.b, a + b);
    p.style.transition = `transform .16s var(--out), ${vertical ? 'height' : 'width'} .16s var(--out)`;
    if (vertical) { p.style.height = (hi - lo) + 'px'; p.style.transform = `translateY(${lo}px)`; } else { p.style.width = (hi - lo) + 'px'; p.style.transform = `translateX(${lo}px)`; }
    setTimeout(() => { p.style.transition = ''; placePill(nav, btn, vertical); }, 170);
  }
  function placePills(animate) {
    const sn = root.querySelector('#snav'), tb = root.querySelector('#tabbar');
    if (!sn) return;
    // the tab bar's active tab grows (flex) — wait for that before measuring
    const go = () => {
      (animate && pillMoved ? stretchPill : placePill)(sn, sn.querySelector('a.on'), true);
      (animate && pillMoved ? stretchPill : placePill)(tb, tb.querySelector('a.on'));
    };
    requestAnimationFrame(go);
    setTimeout(() => placePill(tb, tb.querySelector('a.on')), 520);
  }
  addEventListener('resize', U.debounce(() => { const tb = root.querySelector('#tabbar'); if (tb) placePill(tb, tb.querySelector('a.on')); }));

  App.firstName = (name) => name.replace(/^(م\.|د\.)\s*/, '').split(' ')[0];
  App.meInitial = () => U.esc(App.firstName(S.me().name).charAt(0));
  function greeting() { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; }
  App.greeting = greeting;
  function paintTop(page, cur) {
    const me = S.me(), top = root.querySelector('.dtop');
    if (!top || !me) return;
    top.querySelector('[data-act="theme"]').innerHTML = I(de.dataset.theme === 'dark' ? 'sun' : 'moon', 19);
    top.querySelector('.dot').classList.toggle('hidden', !S.notifications().length);
    top.querySelector('[data-act="user"]').innerHTML = `<span class="avatar me">${App.meInitial()}</span>`;
    if (page !== undefined) {
      const home = cur === 'dashboard';
      // inner screens carry their own page title, so the bar names the section
      top.querySelector('.dtitle small').textContent = home ? `${App.meta.ROLES[me.role].name} · ${U.date(new Date())}` : U.date(new Date());
      top.querySelector('.dtitle b').textContent = home ? `${greeting()}، ${App.firstName(me.name)}` : sectionOf(cur).group;
    }
    document.querySelectorAll('[data-act="theme"]').forEach((b) => { if (!b.closest('.dtop')) b.innerHTML = I(de.dataset.theme === 'dark' ? 'sun' : 'moon', 18); });
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'theme') toggleTheme(b);
    if (act === 'palette') openPalette();
    if (act === 'scan') openPalette('', true);
    if (act === 'notif') openNotifs(b);
    if (act === 'user') openUserMenu(b);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S.me()) { e.preventDefault(); openPalette(); }
  });

  /* ---------- phone: compact bar on scroll, hero parallax, pull to refresh ---------- */
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const app = root.querySelector('.app.is-home');
      if (!app) return;
      const y = scrollY;
      app.classList.toggle('scrolled', y > 230);
      if (innerWidth <= 900 && App.full()) {
        const k = Math.min(1, y / 300);
        app.querySelectorAll('.home > .hero > :not(.blob):not(.grain)').forEach((p, i) => { p.style.transform = y > 0 ? `translateY(${y * (0.25 + i * 0.08)}px) scale(${1 - k * 0.06})` : ''; p.style.opacity = y > 0 ? 1 - k * 1.1 : ''; });
      }
    });
  }, { passive: true });
  (function pullToRefresh() {
    let sy = null, dy = 0, busy = false;
    addEventListener('touchstart', (e) => { if (scrollY > 0 || busy || document.querySelector('.overlay') || !root.querySelector('.app')) return; sy = e.touches[0].clientY; dy = 0; }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (sy == null) return;
      dy = Math.max(0, e.touches[0].clientY - sy);
      const p = root.querySelector('.ptr'); if (!p) return;
      const k = Math.min(1, dy / 90);
      p.style.opacity = k; p.style.transform = `translate(-50%, ${Math.min(dy, 90) * 0.6 - 10}px) rotate(${dy * 3}deg)`;
    }, { passive: true });
    addEventListener('touchend', async () => {
      if (sy == null) return; sy = null;
      const p = root.querySelector('.ptr'); if (!p) return;
      if (dy > 80) {
        busy = true; p.classList.add('spin');
        try { if (S.mode === 'server') await S.pull(); } catch (e) { /* toast below */ }
        setTimeout(() => { render(); p.classList.remove('spin'); p.style.opacity = 0; p.style.transform = ''; busy = false; App.ui.toast('اتحدّثت البيانات'); }, 600);
      } else { p.style.opacity = 0; p.style.transform = ''; }
    });
  })();

  function openNotifs(anchor) {
    const list = S.notifications();
    if (App.full()) { anchor.classList.remove('ring'); void anchor.offsetWidth; anchor.classList.add('ring'); }
    const p = App.ui.popover(anchor, `<div class="popover-head">التنبيهات <span class="badge b-danger plain">${list.length}</span></div>
      <div class="popover-body"><div class="list">${list.length ? list.map((n) => `<a class="list-item" href="${n.href}"><span class="li-ic ${n.tint}">${I(n.icon, 17)}</span><div class="grow"><div class="li-t">${U.esc(n.title)}</div><div class="li-s">${U.esc(n.sub)}</div></div></a>`).join('') : '<div class="empty">مفيش تنبيهات</div>'}</div></div>`);
    p.addEventListener('click', (e) => { if (e.target.closest('a')) p.remove(); });
  }

  function openUserMenu(anchor) {
    const me = S.me();
    const calm = de.dataset.motion === 'calm';
    const p = App.ui.popover(anchor, `<div class="popover-head"><div class="row"><span class="avatar me">${App.meInitial()}</span><div class="stack" style="gap:0"><span>${U.esc(me.name)}</span><span class="small muted" style="font-weight:400">${U.esc(me.title)} · ${App.meta.ROLES[me.role].name}</span></div></div></div>
      <div class="menu-list">
        <button data-m="theme">${I(de.dataset.theme === 'dark' ? 'sun' : 'moon', 17)} ${de.dataset.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</button>
        <button data-m="motion">${I('sparkles', 17)} ${calm ? 'تشغيل الحركة الكاملة' : 'حركة هادئة (أخف)'}</button>
        ${S.mode === 'local' ? `<button data-m="switch">${I('users', 17)} تبديل المستخدم (عرض تجريبي)</button>` : ''}
        <button data-m="logout" style="color:var(--danger)">${I('logout', 17)} تسجيل الخروج</button></div>`, { width: 300 });
    p.addEventListener('click', (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      p.remove();
      if (m === 'theme') return toggleTheme(anchor);
      if (m === 'motion') { const v = calm ? 'full' : 'calm'; de.setAttribute('data-motion', v); store.set('lmx_motion', v); return App.ui.toast(v === 'calm' ? 'الحركة بقت هادئة' : 'الحركة الكاملة اشتغلت'); }
      S.logout().then(() => { root.innerHTML = ''; lastRoute = null; lastSec = null; App.go('#/login'); render(); });
    });
  }
  App.openUserMenu = openUserMenu;
  App.openNotifs = openNotifs;

  /* ---------- command palette ---------- */
  function openPalette(initial = '', scanMode = false) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="palette"><div class="palette-input">${I(scanMode ? 'scan' : 'search', 20)}<input placeholder="${scanMode ? 'امسح الباركود أو اكتبه ودوس Enter…' : 'دوّر على صنف، باركود، مستشفى، عملية أو شاشة…'}" value="${U.esc(initial)}"><span class="kbd">Esc</span></div><div class="palette-results"></div></div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('input'), res = ov.querySelector('.palette-results');
    let items = [], sel = 0;
    const close = () => ov.remove();
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    const draw = () => {
      const q = input.value.trim();
      const secs = [];
      const pages = NAV.flatMap((g) => g.items).filter((it) => visible(it) && U.match(q, it.label, sectionOf(it.key).group)).slice(0, 5)
        .map((it) => ({ icon: it.icon, t: it.label, s: 'افتح الشاشة', go: () => App.go('#/' + it.key) }));
      const prods = S.can('products') ? S.state.products.filter((p) => U.match(q, p.nameAr, p.shortAr, p.nameEn, p.barcode, p.sku)).slice(0, q ? 7 : 4)
        .map((p) => ({ icon: App.meta.CATEGORIES[p.category].icon, t: p.shortAr + ' — ' + p.nameEn, s: `${p.barcode} · الرصيد ${S.stock(p.id)} ${p.unit}`, go: () => App.openProduct(p.id) })) : [];
      const custs = S.can('customers') ? S.state.customers.filter((c) => U.match(q, c.name, c.city)).slice(0, q ? 4 : 2)
        .map((c) => ({ icon: 'hospital', t: c.name, s: c.city + ' · ' + c.type, go: () => App.openCustomer(c.id) })) : [];
      const cases = S.can('cases') && q ? S.state.cases.filter((c) => U.match(q, c.no, c.procedure, c.surgeon)).slice(0, 4)
        .map((c) => ({ icon: 'pulse', t: c.procedure, s: c.no + ' · ' + S.customer(c.customerId).name, go: () => App.openCase(c.id) })) : [];
      if (prods.length) secs.push(['الأصناف', prods]);
      if (custs.length) secs.push(['المستشفيات', custs]);
      if (cases.length) secs.push(['العمليات', cases]);
      if (pages.length && !scanMode) secs.push(['الشاشات', pages]);
      items = secs.flatMap((s) => s[1]);
      sel = Math.min(sel, Math.max(items.length - 1, 0));
      let i = 0;
      res.innerHTML = items.length ? secs.map(([name, arr]) => `<div class="palette-sec">${name}</div>${arr.map((it) => `<div class="palette-item ${i === sel ? 'sel' : ''}" data-i="${i++}"><span class="pi-ic">${I(it.icon, 17)}</span><div class="grow"><div class="truncate" style="font-weight:500">${U.esc(it.t)}</div><div class="small muted truncate">${U.esc(it.s)}</div></div>${I('chevL', 16)}</div>`).join('')}`).join('')
        : `<div class="empty">${I('search', 34)}<div>مفيش نتايج لـ «${U.esc(q)}»</div></div>`;
    };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      if (e.key === 'Enter' && items[sel]) { close(); items[sel].go(); }
    });
    res.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) { close(); items[+it.dataset.i].go(); } });
    draw();
    input.focus();
  }
  App.openPalette = openPalette;

  /* ---------- login ---------- */
  const heroBlobs = '<span class="blob bl1"></span><span class="blob bl2"></span><span class="blob bl3"></span><span class="grain"></span>';
  App.heroBlobs = heroBlobs;
  function renderLogin() {
    const st = S.state;
    const counts = S.mode === 'server' ? S.serverInfo.counts : { products: st.products.length, warehouses: st.warehouses.length, customers: st.customers.length };
    const reps = S.mode === 'server' ? [] : st.users.filter((u) => u.role === 'sales');
    const card = (uid, role, sub) => `<button class="role-card" data-login="${uid}"><span class="rc-ic ${App.meta.ROLES[role].tint}">${I(App.meta.ROLES[role].icon, 20)}</span><div class="grow"><div class="rc-t">${App.meta.ROLES[role].name}</div><div class="rc-s">${sub}</div></div>${I('chevL', 18)}</button>`;
    root.innerHTML = `<div class="auth"><div style="width:min(440px,100%)">
      <div class="auth-card">
        <div class="auth-hero">${heroBlobs}
          <div class="logo">${brandMark}<div>لايف ميديكس<small>LIFE MEDX · ERP</small></div></div>
          <h1>${greeting()}</h1><p>${S.mode === 'server' ? 'سجّل دخولك عشان تكمّل شغلك' : 'نسخة العرض — اختار الدور اللي عايز تجربه'}</p>
        </div>
        <div class="auth-body">
        ${S.mode === 'server' ? serverLoginForm() : `
        ${card('U1', 'admin', 'كل حاجة: الموافقات والإدارة والتقارير')}
        ${card('U2', 'warehouse', 'التجهيز والأذون والصلاحية والباركود')}
        <div class="role-card" style="cursor:default"><span class="rc-ic ${App.meta.ROLES.sales.tint}">${I('briefcase', 20)}</span><div class="grow"><div class="rc-t">مندوب مبيعات</div>
          <div class="row" style="margin-top:8px"><select class="select" id="repSel" style="min-height:40px" aria-label="اختار المندوب">${reps.map((u) => `<option value="${u.id}">${U.esc(u.name)}</option>`).join('')}</select><button class="btn primary sm" id="repGo">دخول</button></div></div></div>
        <div class="demo-note">بيانات تجريبية بالكامل — للعرض فقط، ولا يمكن حفظ أي تعديل.</div>`}
        </div>
      </div>
      <div class="auth-stats"><span><b>${counts.products}</b>صنف</span><span><b>${counts.warehouses}</b>مخازن</span><span><b>${counts.customers}</b>مستشفى</span></div>
    </div></div>`;
    if (S.mode === 'server') return mountServerLogin();
    root.querySelectorAll('[data-login]').forEach((b) => (b.onclick = () => enter(b.dataset.login)));
    root.querySelector('#repGo').onclick = () => enter(root.querySelector('#repSel').value);
  }
  function serverLoginForm() {
    return `<form id="loginForm" class="stack" style="gap:14px" autocomplete="on">
        <div class="field"><label for="lgUser">اسم المستخدم</label><div class="input-icon">${I('user', 17)}<input class="input ltr" id="lgUser" name="username" autocomplete="username" required placeholder="admin" style="text-align:right"></div></div>
        <div class="field"><label for="lgPass">كلمة المرور</label><div class="input-icon">${I('lock', 17)}<input class="input ltr" id="lgPass" name="password" type="password" autocomplete="current-password" required style="text-align:right"></div></div>
        <div class="small" id="lgErr" role="alert" style="color:var(--danger);min-height:18px"></div>
        <button class="big-cta" type="submit">${App.roll('دخول')}</button>
      </form>
      <div class="demo-note"><span class="row" style="justify-content:center;gap:8px"><span class="live-dot"></span>متصل بسيرفر الشركة</span></div>`;
  }
  function mountServerLogin() {
    const f = root.querySelector('#loginForm');
    root.querySelector('#lgUser').focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button'); btn.disabled = true;
      try {
        await S.loginWithPassword(f.username.value.trim(), f.password.value);
        root.innerHTML = '';
        App.go('#/dashboard'); render();
        App.ui.toast(`أهلاً ${S.me().name}`, 'ok', 'سجّلت دخولك');
      } catch (err) {
        root.querySelector('#lgErr').textContent = err.message; btn.disabled = false;
        const card = root.querySelector('.auth-card'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = 'shake .45s';
      }
    };
  }
  function enter(uid) {
    S.login(uid);
    root.innerHTML = '';
    lastRoute = null; lastSec = null;
    App.go('#/dashboard');
    if (parse().name === 'dashboard') render();
    App.ui.toast(`أهلاً ${S.me().name}`, 'ok', 'سجّلت دخولك');
  }

  /** Run a store action from a UI handler: toast the error, return the result (or undefined on failure). */
  App.run = async (name, payload, okMsg, okSub) => {
    try {
      const r = await S.act(name, payload);
      App.refresh();
      if (okMsg) App.ui.toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok', okSub || '');
      return r;
    } catch (e) {
      App.ui.toast(e.message, 'err');
      if (e.status === 401) { root.innerHTML = ''; App.go('#/login'); render(); }
      return undefined;
    }
  };

  /* ---------- shared bits for pages ---------- */
  App.pageHead = (title, sub, actions = '', crumbs = '') => `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row wrap">${actions}</div></div>`;
  App.prodThumb = (p, size = 40) => { const c = App.meta.CATEGORIES[p.category]; return `<span class="prod-thumb ${c.tint}" style="width:${size}px;height:${size}px">${I(c.icon, size * 0.5)}</span>`; };
  App.badge = (cls, text) => `<span class="badge ${cls}">${text}</span>`;

  // changes made by other users arrive over the live channel; re-render unless the user is typing in the page
  S.onChange((source) => {
    if (source !== 'remote' || !S.me()) return;
    const typing = () => document.activeElement && (document.activeElement.closest('.content') || document.activeElement.closest('.overlay')) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const go = () => (typing() || document.querySelector('.overlay') ? setTimeout(go, 1500) : render());
    go();
  });

  async function boot() {
    // skeleton while the data loads
    root.innerHTML = `<div style="max-width:1100px;margin:0 auto;padding:28px 16px;display:grid;gap:16px">
      <div class="sk" style="height:190px;border-radius:30px"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px"><div class="sk" style="height:220px;border-radius:26px"></div><div class="sk" style="height:220px;border-radius:26px"></div></div></div>`;
    try { await S.init(); } catch (e) {
      root.innerHTML = `<div class="auth"><div class="card" style="width:min(420px,100%)"><div class="state"><div class="art" style="background:color-mix(in srgb,var(--neg) 14%,transparent);color:var(--neg)">${I('alert', 28)}</div>
        <h4>النت فاصل أو السيرفر مش بيرد</h4><p>مقدرناش نجيب البيانات من سيرفر الشركة. اتأكد إن السيرفر شغال وجرّب تاني.</p><button class="pbtn" onclick="location.reload()">${I('refresh', 17)} حاول تاني</button></div></div></div>`;
      return;
    }
    // direct demo links (offline demo only): ?demo=admin | store | rep
    const demo = { admin: 'U1', store: 'U2', rep: 'U4' }[new URLSearchParams(location.search).get('demo') || (S.preview ? 'admin' : '')];
    if (demo && S.mode === 'local') { S.login(demo); history.replaceState(null, '', location.pathname + (location.hash || '#/dashboard')); }
    root.innerHTML = '';
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.App);
