/* Home (Medica) — one landing screen per role, built only from data the system really stores.
   Admin: decisions + month in numbers + reps.  Warehouse: picking with FEFO lots + shortages + expiry.  Rep: target + next surgery + my orders.
   Debts, collections, visits and cheques have no data yet, so they show as «قريباً» instead of invented numbers. */
(function (App) {
  'use strict';
  const U = App.util, S = App.store, I = App.icon, C = App.charts, M = App.meta;

  const counted = (o) => o.status !== 'cancelled' && o.status !== 'draft';
  const thisMonth = (d) => { const x = new Date(d), n = new Date(); return x.getMonth() === n.getMonth() && x.getFullYear() === n.getFullYear(); };
  /** last n months (oldest first) with order totals; optional per-category split */
  App.monthlySales = (filter = () => true, n = 12) => {
    const now = new Date();
    const months = Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1));
    const key = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    const idx = Object.fromEntries(months.map((m, i) => [key(m), i]));
    const total = Array(n).fill(0);
    const byCat = { knee: Array(n).fill(0), hip: Array(n).fill(0), other: Array(n).fill(0) };
    S.state.orders.filter((o) => counted(o) && filter(o)).forEach((o) => {
      const i = idx[key(new Date(o.date))];
      if (i === undefined) return;
      o.lines.forEach((l) => {
        const v = l.qty * l.price;
        total[i] += v;
        const cat = S.product(l.productId).category;
        byCat[cat === 'knee' || cat === 'hip' ? cat : 'other'][i] += v;
      });
    });
    return { labels: months.map((m) => U.month(m)), total, byCat };
  };
  /** sales of the previous month up to today's day-of-month (fair month-to-date comparison) */
  App.prevMonthToDate = (filter = () => true) => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59);
    return U.sum(S.state.orders.filter((o) => counted(o) && filter(o) && new Date(o.date) >= from && new Date(o.date) <= to), S.orderTotal);
  };
  App.repMonth = (repId) => U.sum(S.state.orders.filter((o) => counted(o) && o.repId === repId && thisMonth(o.date)), S.orderTotal);

  /* ---------- shared bits (also used by other screens) ---------- */
  const kpi = ({ icon, tint, label, value, foot = '', spark = '' }) => `<div class="card kpi spot">${spark}<div class="k-top"><span class="k-ic ${tint}">${I(icon, 21)}</span></div><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-foot">${foot}</div></div>`;
  App.kpi = kpi;
  const trendPct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);
  const caseItem = (c) => {
    const d = new Date(c.date);
    return `<div class="list-item" style="cursor:pointer" data-case="${c.id}"><span class="li-ic tint-info" style="flex-direction:column;line-height:1.05"><b style="font-size:15px">${d.getDate()}</b><span style="font-size:11px">${U.month(d)}</span></span>
      <div class="grow"><div class="li-t truncate">${U.esc(c.procedure)}</div><div class="li-s truncate">${U.esc(S.customer(c.customerId).name)} · ${U.time(c.date)}</div></div>${App.badge(M.CASE_STATUS[c.status].badge, M.CASE_STATUS[c.status].name)}</div>`;
  };
  App.caseItem = caseItem;

  const COL = { c1: 'var(--c1)', c2: 'var(--c2)', c3: 'var(--c3)', c4: 'var(--c4)', c5: 'var(--c5)' };
  const COLS = Object.keys(COL);
  const av = (text, c, size) => `<span class="lg" style="background:color-mix(in srgb,${COL[c]} 18%,transparent);color:${COL[c]}${size ? `;width:${size}px;height:${size}px` : ''}">${text}</span>`;
  const money = (v) => `<span class="amt num">${U.num(Math.round(v))}<small>ج.م</small></span>`;
  const card = (title, sub, body, btn = '', d = 3, extra = '', id = '') => `<div class="card rv ${extra}" style="--d:${d}"${id ? ` id="${id}"` : ''}><div class="ch"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${btn}</div>${body}</div>`;
  const stateBox = (icon, color, title, text, btn = '') => `<div class="state"><div class="art" style="background:color-mix(in srgb,${color} 14%,transparent);color:${color}">${I(icon, 28)}</div><h4>${title}</h4><p>${text}</p>${btn}</div>`;
  const blobs = () => App.heroBlobs;
  const upcomingCases = (repId) => S.state.cases.filter((c) => (c.status === 'scheduled' || c.status === 'issued') && (!repId || c.repId === repId)).sort((a, b) => a.date.localeCompare(b.date));
  const whenTxt = (date) => {
    const days = U.daysBetween(U.dayISO(new Date()), U.dayISO(date));
    return days === 0 ? 'النهارده' : days === 1 ? 'بكرة' : days === -1 ? 'امبارح' : days > 0 ? `بعد ${days} أيام` : `من ${-days} أيام`;
  };

  /* hero: avatar line on phones, the big number, quick actions */
  function heroTop(me) {
    return `<div class="htop up"><button class="avatar-btn" data-act="user" aria-label="حسابي"><span class="avatar me">${App.meInitial()}</span></button>
      <div class="who-h"><div class="hello">${App.greeting()}،</div><div class="hname">${U.esc(me.name.replace(/^(م\.|د\.)\s*/, '').split(' ').slice(0, 2).join(' '))} <span class="role-chip">${App.meta.ROLES[me.role].name}</span></div></div>
      <button class="gbtn" data-act="palette" aria-label="بحث">${I('search', 18)}</button><button class="gbtn" data-act="notif" aria-label="التنبيهات">${I('bell', 18)}${S.notifications().length ? '<span class="dot"></span>' : ''}</button></div>`;
  }
  const acts = (list) => `<div class="acts">${list.filter(Boolean).map((x, i) => {
    const inner = `<span>${I(x.icon, 22)}${x.badge ? `<i class="badge-n num">${x.badge}</i>` : ''}</span>${x.t}`;
    return x.href ? `<a class="act up${i === 0 ? ' main' : ''}" style="--d:${i + 2}" href="${x.href}">${inner}</a>` : `<button class="act up${i === 0 ? ' main' : ''}" style="--d:${i + 2}" data-h="${x.h}">${inner}</button>`;
  }).join('')}</div>`;
  const hero = (me, inner, actions) => `<section class="hero up" style="--d:1">${blobs()}${heroTop(me)}<div class="up" style="--d:1">${inner}</div>${actions}</section>`;
  const segBar = (parts) => {
    const tot = U.sum(parts, (p) => p.v);
    if (!tot) return '';
    return `<div class="aging">${parts.filter((p) => p.v > 0).map((p, i) => `<i style="flex:${p.v};background:${p.c};--i:${i}" data-tip="${U.esc(`${p.l}: ${p.tip || U.num(p.v)}`)}"></i>`).join('')}</div>
      <div class="aleg">${parts.map((p) => `<span><i style="background:${p.c}"></i>${p.l} <b>${p.short ?? U.num(p.v)}</b></span>`).join('')}</div>`;
  };
  const kShort = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)));
  const soonCard = (title, text, d) => card(title, '', stateBox('sparkles', 'var(--brand-2)', 'قريباً', text, S.can('admin') ? '<a class="more" href="#/soon/accounts">خطة الحسابات</a>' : ''), '<span class="chipx n">قريباً</span>', d);

  /* =================== ADMIN =================== */
  function adminHome(me) {
    const st = S.state;
    const month = st.orders.filter((o) => counted(o) && thisMonth(o.date));
    const cur = U.sum(month, S.orderTotal), prev = App.prevMonthToDate(), tp = trendPct(cur, prev);
    const pend = st.orders.filter((o) => o.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
    const by = (s) => U.sum(month.filter((o) => o.status === s), S.orderTotal);
    const waitStore = st.orders.filter((o) => o.status === 'approved' && !o.issuedMovementId);
    const pendAll = U.sum(st.orders.filter((o) => o.status === 'pending' && thisMonth(o.date)), S.orderTotal);
    const inner = `<div class="hcenter"><div class="hl-k">${I('chart', 16)} مبيعات ${U.month(new Date())} لحد النهارده</div>
      <div class="hl-v num"><span data-v="${Math.round(cur)}">0</span><small>ج.م</small></div>
      ${segBar([{ l: 'اتسلّم', v: by('delivered'), c: '#5eead4', short: kShort(by('delivered')) }, { l: 'معتمد', v: by('approved'), c: '#7dd3fc', short: kShort(by('approved')) }, { l: 'مستني اعتمادك', v: pendAll, c: '#fbbf24', short: kShort(pendAll) }])}
      ${pend.length ? `<div class="warnpill">${I('clock', 15)} ${pend.length} أوامر بيع مستنية قرارك · ${U.moneyTxt(U.sum(pend, S.orderTotal))}</div>` : tp !== null ? `<div class="okpill">${I(tp >= 0 ? 'up' : 'down', 15)} <span dir="ltr">${tp >= 0 ? '+' : ''}${tp}%</span> عن نفس الفترة الشهر اللي فات</div>` : ''}</div>`;
    const actions = acts([
      { icon: 'check', t: 'الموافقات', h: 'scrollapr', badge: pend.length },
      S.can('inventory') && { icon: 'package', t: 'المخزن', href: '#/inventory' },
      S.can('reps') && { icon: 'users', t: 'المناديب', href: '#/reps' },
      { icon: 'orders', t: 'أوامر البيع', href: '#/orders' },
    ]);
    const low = st.products.filter((p) => S.stockStatus(p).key !== 'ok');
    const exp = S.expiringLots();
    const tiles = [
      ['chart', `مبيعات ${U.month(new Date())}`, cur, true, tp === null ? `${month.length} أمر بيع` : `<span dir="ltr">${tp >= 0 ? '+' : ''}${tp}%</span> عن الشهر اللي فات`],
      ['truck', 'معتمد مستني المخزن', waitStore.length, false, U.moneyTxt(U.sum(waitStore, S.orderTotal))],
      ['package', 'أصناف ناقصة', low.length, false, `${low.filter((p) => S.stock(p.id) === 0).length} خلصان خالص`],
      ['clock', 'قيمة صلاحيات قريبة', U.sum(exp, (l) => l.qty * (S.product(l.productId)?.cost || 0)), true, `${exp.length} تشغيلة خلال ${st.settings.expiryWarnDays} يوم`],
    ];
    const tilesCard = card(`${U.month(new Date())} في سطرين`, 'من أوامر البيع والمخزون الفعلي', `<div class="tiles">${tiles.map(([ic, k, v, isMoney, s]) => `<div class="tile"><div class="tk">${I(ic, 15)}${k}</div><div class="tv num"><span data-v="${Math.round(v)}">0</span>${isMoney ? '<small>ج.م</small>' : ''}</div><div class="ts">${s}</div></div>`).join('')}</div>`, '', 4);
    const reps = st.reps.map((r) => ({ r, m: App.repMonth(r.id), n: st.orders.filter((o) => o.repId === r.id && counted(o) && thisMonth(o.date)).length, cs: upcomingCases(r.id).length })).sort((a, b) => b.m / b.r.target - a.m / a.r.target);
    const repsCard = S.can('reps') ? card('المناديب الشهر ده', 'المبيعات مقابل التارجت', `<ul class="reps">${reps.slice(0, 6).map(({ r, m, n, cs }, i) => { const p = Math.min(1, m / r.target); return `<li class="click" data-rep="${r.id}"><span class="mring"><svg viewBox="0 0 48 48"><circle r="21" cx="24" cy="24" style="stroke:var(--surface-2)"/><circle class="fg" pathLength="1" r="21" cx="24" cy="24" style="stroke:${COL[COLS[i % 5]]};--p:${p.toFixed(3)};--i:${i}"/></svg><b>${Math.round((m / r.target) * 100)}%</b></span><div style="min-width:0"><div class="n">${U.esc(r.name)}</div><div class="m">${n} أوامر · ${cs} عمليات جاية</div></div><div class="col">${money(m)}<div class="amt-s">من ${kShort(r.target)}</div></div></li>`; }).join('')}</ul>`, '<a class="more" href="#/reps">كل المناديب</a>', 6) : '';
    const chart = (() => { const ms = App.monthlySales(); return card('المبيعات', `آخر 12 شهر · ${U.moneyTxt(U.sum(ms.total))}`, `<div class="pad">${C.area({ labels: ms.labels, values: ms.total })}</div>`, '<a class="more" href="#/orders">أوامر البيع</a>', 7); })();
    return `<div class="home">${hero(me, inner, actions)}
      <div class="colstack">${approvalsCard(pend)}${attentionCard(5)}${chart}</div>
      <div class="colstack">${tilesCard}${repsCard}${soonCard('المديونيات والتحصيل', 'الفواتير والمديونيات وأعمار الديون والتحصيل والشيكات هتظهر هنا لما نضيف الحسابات — مش هنعرض أرقام مش متسجلة.', 8)}</div>
      ${recentMovesCard(9)}
      <div class="cbar">${I('chart', 16)} مبيعات الشهر <span class="num">${U.num(Math.round(cur))}</span></div></div>`;
  }

  function approvalsCard(pend) {
    const body = pend.length ? `<ul class="apr" id="apr">${pend.slice(0, 6).map((o) => { const c = S.customer(o.customerId); return `<li data-o="${o.id}"><div class="top"><span class="ic" style="background:color-mix(in srgb,var(--c3) 16%,transparent);color:var(--c3)">${I('cart', 20)}</span><div style="min-width:0"><b>${U.esc(c.name)}</b><div class="s"><span class="mono">${o.no}</span> · ${U.moneyTxt(S.orderTotal(o))} · من ${U.esc(S.rep(o.repId).name)}</div><div class="s">${o.lines.map((l) => U.esc(S.product(l.productId).shortAr) + ' ×' + l.qty).join('، ')}</div></div></div>
      <div class="btns"><button class="yes" data-apr="yes">${I('check', 18)} اعتمد</button><button class="no" data-apr="no">${I('x', 18)} ارفض</button></div></li>`; }).join('')}</ul>${pend.length > 6 ? `<div class="pad"><a class="ghost-cta" href="#/orders">و ${pend.length - 6} أوامر تانية</a></div>` : ''}`
      : `<div class="alldone"><span>${I('check', 24)}</span>خلّصت كل الموافقات — برافو</div>`;
    return card('محتاج قرارك', `<span id="aprc">${pend.length}</span> أوامر بيع مستنية اعتمادك`, body, '', 3, '', 'aprcard');
  }

  /** everything that needs a person today (kept from the first version): cases, shortages, expiry */
  function attentionCard(d, repId) {
    const st = S.state, rows = [];
    const row = (c, icon, t, s, extra, attr) => rows.push(`<li class="click" ${attr}>${av(I(icon, 18), c)}<div style="flex:1;min-width:0"><div class="n">${t}</div><div class="m">${s}</div></div>${extra}</li>`);
    upcomingCases(repId).slice(0, 3).forEach((c) => row('c2', 'pulse', U.esc(c.procedure), `${U.esc(S.customer(c.customerId).name)} · ${whenTxt(c.date)} ${U.time(c.date)}`, `<span class="chipx ${c.status === 'issued' ? 'b' : 'n'}">${M.CASE_STATUS[c.status].name.split('—')[0].trim()}</span>`, `data-case="${c.id}"`));
    if (!repId) {
      st.products.filter((p) => S.stockStatus(p).key !== 'ok').slice(0, 3).forEach((p) => { const s = S.stockStatus(p); row(s.key === 'out' ? 'c4' : 'c3', 'alert', U.esc(p.shortAr), `الرصيد ${S.stock(p.id)} · حد الطلب ${p.minStock}`, `<span class="chipx ${s.key === 'out' ? 'r' : 'w'}">${s.name}</span>`, `data-prod="${p.id}"`); });
      S.expiringLots().slice(0, 2).forEach((l) => row('c4', 'clock', `${U.esc(S.product(l.productId).shortAr)}`, `تشغيلة <span class="mono">${l.lot}</span> · ${l.qty} وحدة`, `<span class="chipx r">${S.daysToExpiry(l)} يوم</span>`, `data-prod="${l.productId}"`));
    }
    return card('محتاج انتباهك', rows.length ? `${rows.length} حاجات النهارده` : 'مفيش حاجة متأخرة', rows.length ? `<ul class="ovd">${rows.join('')}</ul>` : stateBox('check', 'var(--pos)', 'كله تمام', 'مفيش عمليات قريبة ولا نواقص.'), '', d);
  }

  function recentMovesCard(d) {
    if (!S.can('movements')) return '';
    return `<div class="card rv" style="--d:${d};grid-column:1/-1"><div class="ch"><div><h3>آخر الأذون</h3><div class="sub">إضافة وصرف وتحويل ومرتجع</div></div><a class="more" href="#/movements">الكل</a></div><div class="table-wrap">${App.movementsTable(S.state.movements.slice(0, 5))}</div></div>`;
  }

  /* =================== WAREHOUSE =================== */
  const pick = { job: null, done: {} }; // checklist state lives in this screen only (no order-level picking state in the database yet)
  function jobs() {
    const st = S.state;
    const cs = st.cases.filter((c) => c.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({ kind: 'case', id: c.id, no: c.no, who: S.customer(c.customerId).name, rep: S.rep(c.repId).name, date: c.date, urgent: U.daysBetween(U.dayISO(new Date()), U.dayISO(c.date)) <= 1, lines: c.items, title: c.procedure }));
    const os = st.orders.filter((o) => o.status === 'approved' && !o.issuedMovementId).sort((a, b) => a.date.localeCompare(b.date))
      .map((o) => ({ kind: 'order', id: o.id, no: o.no, who: S.customer(o.customerId).name, rep: S.rep(o.repId).name, date: o.date, urgent: false, lines: o.lines, title: 'أمر بيع معتمد' }));
    return [...cs.filter((j) => j.urgent), ...os, ...cs.filter((j) => !j.urgent)];
  }
  function pickRows(job) {
    const rows = [];
    job.lines.forEach((l, i) => {
      const p = S.product(l.productId), plan = S.allocate(l.productId, 'W1', l.qty);
      plan.alloc.forEach((a, k) => rows.push({ key: `${i}-${k}`, p, a, first: k === 0 && plan.alloc.length > 1, soon: S.daysToExpiry({ expiry: a.expiry }) <= S.state.settings.expiryWarnDays }));
      if (plan.missing > 0) rows.push({ key: `${i}-x`, p, missing: plan.missing });
    });
    return rows;
  }
  function pickCard(list) {
    if (!list.length) return card('التجهيز', '', stateBox('check', 'var(--pos)', 'مفيش طلبات مستنية تجهيز', 'أوامر البيع المعتمدة والعمليات المجدولة هتظهر هنا بالتشغيلات اللي تسحبها.'), '', 3, '', 'pickcard');
    if (!list.some((j) => j.id === pick.job)) { pick.job = list[0].id; pick.done = {}; }
    const job = list.find((j) => j.id === pick.job);
    const rows = pickRows(job), okRows = rows.filter((r) => !r.missing);
    const n = okRows.filter((r) => pick.done[r.key]).length, missing = rows.some((r) => r.missing);
    const can = job.kind === 'case' ? S.can('cases', 2) : S.can('movements', 2);
    const ready = n === okRows.length && !missing && can;
    const pin = I('pin', 13);
    return `<div class="card rv" style="--d:3" id="pickcard"><div class="ch"><div><h3>جهّز ${job.kind === 'case' ? 'طقم العملية' : 'أمر البيع'} <span class="mono" style="font-size:14px;font-weight:500">${job.no}</span></h3><div class="sub">${U.esc(job.who)} · المندوب ${U.esc(job.rep)}${job.kind === 'case' ? ` · ${whenTxt(job.date)} ${U.time(job.date)}` : ''}</div></div>${job.urgent ? '<span class="chipx r">مستعجل</span>' : `<span class="chipx n">${job.kind === 'case' ? 'عملية' : 'أمر بيع'}</span>`}</div>
      <div class="queue">${list.map((j) => `<button data-q="${j.id}" class="${j.id === job.id ? 'on' : ''}"><b>${j.no.slice(-4)}</b>${j.kind === 'case' ? 'عملية' : 'أمر'} · ${U.sum(j.lines, (l) => l.qty)} وحدة</button>`).join('')}</div>
      <div class="pprog"><span id="pcount">${n} من ${okRows.length}</span><div class="trk"><i id="pbar" class="${ready ? 'full' : ''}" style="width:${okRows.length ? (n / okRows.length) * 100 : 0}%"></i></div></div>
      <ul class="pick">${rows.map((r) => r.missing ? `<li style="cursor:default;border-color:color-mix(in srgb,var(--neg) 35%,transparent)"><span class="cbx" style="border-color:var(--neg);color:var(--neg)">${I('x', 16)}</span><div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><span class="pn">${U.esc(r.p.shortAr)}</span><span class="q" style="color:var(--neg)">ناقص ${r.missing}</span></div><div class="m"><span class="chipx r">مفيش رصيد صالح كفاية في المخزن الرئيسي</span></div></div></li>`
        : `<li data-pick="${r.key}" class="${pick.done[r.key] ? 'ok' : ''}"><span class="cbx">${I('check', 16)}</span><div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><span class="pn">${U.esc(r.p.shortAr)}</span><span class="q">${r.a.qty} ${U.esc(r.p.unit)}</span></div>
          <div class="m"><span class="chipx n">${pin}${U.esc(r.a.location || '—')}</span><span class="chipx b">تشغيلة <span class="mono">${r.a.lot}</span></span><span class="chipx ${r.soon ? 'w' : 'n'}">تنتهي ${U.date(r.a.expiry)}</span>${r.first || r.soon ? '<span class="chipx w">اسحب دي الأول</span>' : ''}</div></div></li>`).join('')}</ul>
      <div class="pad" style="padding-top:12px"><button class="big-cta${ready ? ' ready' : ''}" id="pickdone" data-h="pickdone" ${ready ? '' : 'disabled'}>${I('truck', 20)} تم التجهيز — اصرف بإذن صرف</button>
        <div class="small muted" style="margin-top:8px;text-align:center">${!can ? 'دورك مش مسموح له يصرف — اطلب الصلاحية من المدير' : missing ? 'فيه صنف ناقص — اعمل استلام أو تحويل الأول' : 'التشغيلات بالترتيب ده (الأقرب انتهاءً أولاً) هي اللي هتتصرف فعلاً'}</div></div></div>`;
  }
  function shortCard() {
    const low = S.state.products.filter((p) => S.stockStatus(p).key !== 'ok').map((p) => ({ p, have: S.stock(p.id), sug: Math.max(p.minStock * 2 - S.stock(p.id), p.minStock) })).sort((a, b) => a.have / (a.p.minStock || 1) - b.have / (b.p.minStock || 1));
    if (!low.length) return card('نواقص المخزن', '', stateBox('check', 'var(--pos)', 'مفيش نواقص', 'كل الأصناف فوق حد الطلب.'), '', 4);
    return card('نواقص المخزن', 'أقل من حد الطلب', `<ul class="ovd short">${low.slice(0, 5).map(({ p, have, sug }, i) => `<li class="click" data-prod="${p.id}"><div style="flex:1;min-width:0"><div class="n">${U.esc(p.shortAr)}</div><div class="m">موجود ${have} · حد الطلب ${p.minStock} ${U.esc(p.unit)}</div><div class="bar2"><i style="width:${Math.max(3, Math.min(100, (have / (p.minStock || 1)) * 100))}%;background:${have === 0 ? 'var(--neg)' : 'var(--warn)'};--i:${i}"></i></div></div><div style="text-align:left"><div class="amt-s">نقترح نطلب</div><b class="num" style="font-size:16px">${sug}</b></div></li>`).join('')}</ul>
      <div class="pad"><button class="ghost-cta" style="width:100%" data-h="po">${I('download', 18)} صدّر طلب شراء بالنواقص (${low.length}) — CSV</button></div>`, '', 4);
  }
  function expiryCard() {
    const lots = S.state.lots.filter((l) => l.qty > 0).map((l) => ({ l, d: S.daysToExpiry(l), v: l.qty * (S.product(l.productId)?.cost || 0) }));
    const warn = S.state.settings.expiryWarnDays;
    // the warehouse works without cost prices (approved for the Supabase model), so it sees units instead of money
    const showMoney = S.seesCost();
    const g = [['x1', 'منتهية', (x) => x.d < 0], ['x2', 'خلال 30 يوم', (x) => x.d >= 0 && x.d <= 30], ['x3', `خلال ${warn} يوم`, (x) => x.d > 30 && x.d <= warn]].map(([k, label, f]) => { const a = lots.filter(f); return { k, label, n: a.length, v: U.sum(a, (x) => x.v), u: U.sum(a, (x) => x.l.qty) }; });
    const list = lots.filter((x) => x.d <= warn).sort((a, b) => a.d - b.d).slice(0, 4);
    return card('الصلاحيات', 'اتصرّف فيها قبل ما تبقى خسارة', `<div class="exg">${g.map((x) => `<div class="${x.k}"><b class="num">${x.n}</b><span>${x.label}</span><small class="num">${showMoney ? `${U.num(Math.round(x.v))} ج.م` : `${U.num(x.u)} وحدة`}</small></div>`).join('')}</div>
      ${list.length ? `<ul class="ovd">${list.map(({ l, d }) => `<li class="click" data-prod="${l.productId}"><div style="flex:1;min-width:0"><div class="n">${U.esc(S.product(l.productId).shortAr)}</div><div class="m"><span class="chipx b">تشغيلة <span class="mono">${l.lot}</span></span>${l.qty} وحدة · ${U.esc(S.warehouse(l.warehouseId)?.code || '')}</div></div>${d < 0 ? `<span class="chipx r">منتهية من ${-d} يوم</span>` : `<span class="chipx w">باقي ${d} يوم</span>`}</li>`).join('')}</ul>` : ''}`, `${S.can('movements', 2) && g[0].n + g[1].n ? '<button class="more" data-h="rts">رجّع للمورد</button>' : ''}<a class="more" href="#/inventory">الأرصدة</a>`, 6);
  }
  function storeHome(me) {
    const list = jobs();
    const urgent = list.find((j) => j.urgent);
    const nOrders = list.filter((j) => j.kind === 'order').length, nCases = list.length - nOrders;
    const inner = `<div class="hcenter"><div class="hl-k">${I('orders', 16)} شغل مستني تجهيز</div><div class="hl-v"><span class="num" data-v="${list.length}">0</span><small>${list.length === 1 ? 'شغلانة' : 'شغلانات'}</small></div>
      ${list.length ? segBar([{ l: 'أوامر بيع معتمدة', v: nOrders, c: '#7dd3fc' }, { l: 'أطقم عمليات', v: nCases, c: '#5eead4' }]) : ''}
      ${urgent ? `<div class="warnpill">${I('clock', 15)} ${U.esc(urgent.title)} — ${whenTxt(urgent.date)} ${U.time(urgent.date)} · الطقم لسه في المخزن</div>` : `<div class="okpill">${I('check', 15)} ${list.length ? 'مفيش حاجة مستعجلة' : 'كله متجهز'}</div>`}</div>`;
    const actions = acts([
      { icon: 'orders', t: 'جهّز', h: 'scrollpick', badge: list.length },
      S.can('movements', 2) && { icon: 'in', t: 'استلام', href: '#/movements?new=in' },
      { icon: 'scan', t: 'مسح باركود', h: 'scan' },
      S.can('inventory') && { icon: 'layers', t: 'الأرصدة', href: '#/inventory' },
    ]);
    return `<div class="home">${hero(me, inner, actions)}
      <div class="colstack">${pickCard(list)}</div>
      <div class="colstack">${shortCard()}${expiryCard()}</div>
      ${recentMovesCard(8)}
      <div class="cbar">${I('orders', 16)} مستني تجهيز <span class="num">${list.length}</span></div></div>`;
  }

  /* =================== SALES REP =================== */
  function repHome(me) {
    const st = S.state, rep = S.rep(me.repId);
    const month = App.repMonth(rep.id), pct = rep.target ? Math.round((month / rep.target) * 100) : 0;
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    const inner = `<div class="hcenter"><div class="hl-k">${I('target', 16)} مبيعاتك في ${U.month(new Date())}</div><div class="hl-v num"><span data-v="${Math.round(month)}">0</span><small>ج.م</small></div>
      ${segBar([{ l: 'اتحقق', v: Math.min(month, rep.target), c: '#5eead4', short: `${pct}%` }, { l: 'فاضل للتارجت', v: Math.max(rep.target - month, 0), c: 'rgba(255,255,255,.2)', short: kShort(Math.max(rep.target - month, 0)) }])}
      <div class="okpill">${I('calendar', 15)} التارجت ${U.moneyTxt(rep.target)} · فاضل ${daysLeft} يوم في الشهر</div></div>`;
    const actions = acts([
      S.can('orders', 2) && { icon: 'plus', t: 'طلب جديد', h: 'neworder' },
      S.can('cases', 2) && { icon: 'calendar', t: 'جدولة عملية', href: '#/cases?new=1' },
      S.can('customers') && { icon: 'hospital', t: 'مستشفياتي', href: '#/customers' },
      S.can('products') && { icon: 'package', t: 'الأصناف', href: '#/products' },
    ]);
    const up = upcomingCases(rep.id);
    const next = up[0];
    const nextCard = next ? (() => {
      const cu = S.customer(next.customerId);
      return `<div class="card nv rv" style="--d:3"><div class="pad" style="padding-top:18px"><span class="lbl-now">العملية الجاية · ${whenTxt(next.date)} ${U.time(next.date)}</span><h2>${U.esc(next.procedure)}</h2>
        <div class="meta"><span>${I('hospital', 16)}${U.esc(cu.name)}</span><span>${I('user', 16)}${U.esc(next.surgeon)}</span><span>${I('wrench', 16)}${U.esc(next.set)}</span></div>
        <div class="duebox b">${I(next.status === 'issued' ? 'checkCircle' : 'package', 18)}<div>${next.status === 'issued' ? 'الطقم اتصرف وهو معاك بالعهدة — بعد العملية سجّل اللي اتستخدم.' : `الطقم لسه في المخزن · ${U.sum(next.items, (i) => i.qty)} وحدة محجوزة للعملية دي`}</div></div>
        ${S.can('orders', 2) ? `<button class="big-cta" data-h="neworder" data-cust="${cu.id}">${I('cart', 20)} ابدأ طلب للمستشفى ده</button>` : ''}
        <div class="grid2"><button class="ghost-cta" data-case="${next.id}">${I('file', 18)} تفاصيل العملية</button>${cu.phone ? `<a class="ghost-cta" href="tel:${U.esc(cu.phone.replace(/[^\d+]/g, ''))}">${I('phone', 18)} اتصال</a>` : ''}</div></div></div>`;
    })() : card('العملية الجاية', '', stateBox('calendar', 'var(--brand-2)', 'مفيش عمليات مجدولة', 'جدول عملية عشان الطقم يتحجز من المخزن.', S.can('cases', 2) ? `<a class="pbtn brand" href="#/cases?new=1">${I('plus', 17)} جدولة عملية</a>` : ''), '', 3);
    const week = st.cases.filter((c) => c.repId === rep.id && Math.abs(U.daysBetween(new Date(), c.date)) <= 7).sort((a, b) => a.date.localeCompare(b.date));
    const cls = (c) => (c.status === 'closed' || c.status === 'done' ? 'done' : c.status === 'issued' ? 'now' : 'next');
    const tl = week.length ? card('عملياتي الأسبوع ده', `${week.length} عمليات · من ${U.dateShort(U.addDays(new Date(), -7))} لـ ${U.dateShort(U.addDays(new Date(), 7))}`, `<ul class="tl">${week.map((c, i) => `<li class="${cls(c)}" style="--d:${i}" data-case="${c.id}"><span class="dot">${cls(c) === 'done' ? I('check', 14, 2.6) : ''}</span><div style="min-width:0"><div class="n">${U.esc(c.procedure)}</div><div class="m">${U.esc(S.customer(c.customerId).name)} · ${M.CASE_STATUS[c.status].name}</div></div><span class="t">${U.dateShort(c.date)}<br>${U.time(c.date)}</span></li>`).join('')}</ul>`, '<a class="more" href="#/cases">اللوحة</a>', 5) : '';
    const mine = st.orders.filter((o) => o.repId === rep.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const ochip = { draft: 'n', pending: 'w', approved: 'b', delivered: 'g', cancelled: 'r' };
    const ordersCard = card('طلباتي', `آخر ${mine.length} أوامر بيع`, mine.length ? `<ul class="ovd">${mine.map((o, i) => `<li class="click" data-order="${o.id}">${av(I('cart', 18), COLS[i % 5])}<div style="flex:1;min-width:0"><div class="n">${U.esc(S.customer(o.customerId).name)}</div><div class="m"><span class="mono">${o.no}</span><span class="chipx ${ochip[o.status]}">${M.ORDER_STATUS[o.status].name}</span>${o.status === 'approved' ? `<span class="chipx ${o.issuedMovementId ? 'g' : 'n'}">${o.issuedMovementId ? 'اتصرف من المخزن' : 'مستني المخزن'}</span>` : ''}</div></div>${money(S.orderTotal(o))}</li>`).join('')}</ul>` : stateBox('cart', 'var(--brand-2)', 'مفيش طلبات لسه', 'ابدأ أول طلب لمستشفى من مستشفياتك.'), '<a class="more" href="#/orders">الكل</a>', 4);
    const ms = App.monthlySales((o) => o.repId === rep.id);
    const chart = card('مبيعاتي', `آخر 12 شهر · ${U.moneyTxt(U.sum(ms.total))}`, `<div class="pad">${C.area({ labels: ms.labels, values: ms.total })}</div>`, '', 7);
    return `<div class="home">${hero(me, inner, actions)}
      <div class="colstack">${nextCard}${tl}${chart}</div>
      <div class="colstack">${ordersCard}${soonCard('الزيارات والتحصيل', 'خط سير الزيارات والتحصيل والعهدة هيتضافوا مع الحسابات — لحد دلوقتي مفيش بيانات زيارات متسجلة.', 6)}</div>
      <div class="cbar">${I('target', 16)} التارجت <span class="num">${pct}%</span></div></div>`;
  }

  /* =================== interactions =================== */
  const el0 = () => document.querySelector('.content');
  async function act(name, payload) {
    try { return await S.act(name, payload); } catch (e) { App.ui.toast(e.message, 'err'); return undefined; }
  }
  async function decide(li, yes) {
    if (li.dataset.busy) return;
    const o = S.state.orders.find((x) => x.id === li.dataset.o);
    if (!yes && !(await App.ui.confirm('رفض أمر البيع', `هيتلغي أمر البيع <b>${o.no}</b> لـ ${U.esc(S.customer(o.customerId).name)}. متأكد؟`, 'ارفض الأمر'))) return;
    li.dataset.busy = 1;
    const r = await act('setOrderStatus', { id: o.id, status: yes ? 'approved' : 'cancelled' });
    if (!r) { delete li.dataset.busy; return; }
    li.classList.add(yes ? 'okd' : 'rej');
    li.insertAdjacentHTML('beforeend', `<span class="stamp">${I(yes ? 'check' : 'x', 32, 2.6)}</span>`);
    App.ui.toast(yes ? 'اتعتمد — راح للمخزن يجهّزه' : 'اترفض واتلغى', yes ? 'ok' : 'warn', `${o.no} · ${U.esc(S.customer(o.customerId).name)}`);
    setTimeout(() => li.classList.add('gone'), App.full() ? 750 : 0);
    setTimeout(() => App.refresh(), App.full() ? 1200 : 300);
  }
  async function pickDone(btn) {
    const job = jobs().find((j) => j.id === pick.job);
    if (!job || btn.disabled) return;
    btn.disabled = true; btn.classList.remove('ready');
    const r = await act(job.kind === 'case' ? 'advanceCase' : 'issueOrder', { id: job.id });
    if (!r) { btn.disabled = false; return; }
    btn.classList.add('sentok'); btn.innerHTML = `${I('check', 20)} اتصرف بإذن ${r.movement?.no || ''}`;
    App.burst(btn.parentElement);
    const hv = el0().querySelector('.hero .hl-v [data-v]');
    if (hv) { App.odo(hv, Math.max(0, +hv.dataset.v - 1)); App.floatUp(hv, '−1'); }
    App.ui.toast(`${job.no} اتجهّز واتصرف`, 'ok', `إذن صرف ${r.movement?.no || ''} · المندوب ${U.esc(job.rep)} يقدر يستلم`);
    pick.job = null; pick.done = {};
    setTimeout(() => App.refresh(), App.full() ? 1600 : 300);
  }
  function exportPO() {
    const rows = S.state.products.filter((p) => S.stockStatus(p).key !== 'ok').map((p) => [p.sku, p.barcode, p.nameAr, p.nameEn, S.stock(p.id), p.minStock, Math.max(p.minStock * 2 - S.stock(p.id), p.minStock), p.unit]);
    U.csv(`life-medx-purchase-request-${U.dayISO(new Date())}.csv`, [['SKU', 'الباركود', 'الصنف', 'English', 'الرصيد', 'حد الطلب', 'الكمية المقترحة', 'الوحدة'], ...rows]);
    if (!App.framed) App.ui.toast('اتصدّر طلب الشراء', 'ok', `${rows.length} أصناف · ملف CSV يفتح على Excel`);
  }

  App.pages.dashboard = {
    title: 'الرئيسية',
    render() { const me = S.me(); return me.role === 'sales' ? repHome(me) : me.role === 'warehouse' ? storeHome(me) : adminHome(me); },
    mount(el) {
      el.addEventListener('click', (e) => {
        const t = e.target;
        let x;
        if ((x = t.closest('[data-apr]'))) return decide(x.closest('li'), x.dataset.apr === 'yes');
        if ((x = t.closest('[data-q]'))) { pick.job = x.dataset.q; pick.done = {}; return App.refresh(); }
        if ((x = t.closest('[data-pick]'))) {
          const k = x.dataset.pick; pick.done[k] = !pick.done[k]; x.classList.toggle('ok', !!pick.done[k]);
          const all = [...el.querySelectorAll('[data-pick]')], n = all.filter((li) => li.classList.contains('ok')).length;
          const btn = el.querySelector('#pickdone'), blocked = !!el.querySelector('.pick li:not([data-pick])');
          const job = jobs().find((j) => j.id === pick.job), can = job && (job.kind === 'case' ? S.can('cases', 2) : S.can('movements', 2));
          const ready = n === all.length && !blocked && can, was = !btn.disabled;
          el.querySelector('#pcount').textContent = `${n} من ${all.length}`;
          el.querySelector('#pbar').style.width = `${(n / all.length) * 100}%`;
          el.querySelector('#pbar').classList.toggle('full', ready);
          btn.disabled = !ready; btn.classList.toggle('ready', ready);
          if (ready && !was) App.burst(btn.parentElement);
          return;
        }
        if ((x = t.closest('[data-h]'))) {
          const h = x.dataset.h;
          if (h === 'scrollapr' || h === 'scrollpick') { const c = el.querySelector(h === 'scrollapr' ? '#aprcard' : '#pickcard'); if (c) c.scrollIntoView({ behavior: App.full() ? 'smooth' : 'auto', block: 'start' }); }
          if (h === 'pickdone') pickDone(x);
          if (h === 'po') exportPO();
          if (h === 'rts') App.supplierReturn();
          if (h === 'scan') App.openPalette('', true);
          if (h === 'neworder') App.newOrder(x.dataset.cust);
          return;
        }
        if ((x = t.closest('[data-case]'))) return App.openCase(x.dataset.case);
        if ((x = t.closest('[data-prod]'))) return App.openProduct(x.dataset.prod);
        if ((x = t.closest('[data-order]'))) return App.openOrder(x.dataset.order);
        if ((x = t.closest('[data-rep]'))) return App.go('#/reps');
        if ((x = t.closest('[data-mv]'))) return App.openMovement(x.dataset.mv);
      });
    },
  };
})(window.App);
