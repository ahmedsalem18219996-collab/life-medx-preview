/* Domain layer — shared by the browser (offline demo) and the local server (source of truth).
   Pure functions over a plain state object: no DOM, no storage, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Domain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const U = {
    iso: (d) => new Date(d).toISOString(),
    dayISO: (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); },
    addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
    daysBetween: (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5),
    uid: (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Math.random().toString(36).slice(2, 5)}`,
    rng: (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
    sum: (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0),
  };

  const CATEGORIES = {
    knee: { name: 'مفاصل الركبة', icon: 'bone', tint: 'tint-primary', color: 'var(--chart-1)' },
    hip: { name: 'مفاصل الفخذ', icon: 'hip', tint: 'tint-accent', color: 'var(--chart-2)' },
    parts: { name: 'مكونات وملحقات', icon: 'puzzle', tint: 'tint-violet', color: 'var(--chart-5)' },
    cement: { name: 'أسمنت العظام', icon: 'drop', tint: 'tint-warning', color: 'var(--chart-3)' },
    power: { name: 'أجهزة جراحية', icon: 'wrench', tint: 'tint-info', color: 'var(--chart-6)' },
    consum: { name: 'مستهلكات', icon: 'scissors', tint: 'tint-danger', color: 'var(--chart-4)' },
  };
  const MOVE_TYPES = {
    in: { name: 'إذن إضافة', prefix: 'GRN', icon: 'in', badge: 'b-success' },
    out: { name: 'إذن صرف', prefix: 'GIN', icon: 'out', badge: 'b-accent' },
    transfer: { name: 'إذن تحويل', prefix: 'TRF', icon: 'swap', badge: 'b-violet' },
    return: { name: 'إذن مرتجع', prefix: 'RTN', icon: 'ret', badge: 'b-warning' },
    // its own screen (not the generic voucher form): the only way an expired lot leaves the stock
    rts: { name: 'مرتجع للمورد', prefix: 'RTS', icon: 'ret', badge: 'b-danger', own: true },
  };
  const CASE_STATUS = {
    scheduled: { name: 'مجدولة', badge: 'b-info', color: 'var(--info)', next: 'issued', action: 'صرف الطقم من المخزن' },
    issued: { name: 'اتصرف — بالعهدة', badge: 'b-violet', color: 'var(--violet)', next: 'done', action: 'أكّد إن العملية تمت' },
    done: { name: 'العملية تمت', badge: 'b-warning', color: 'var(--warning)', next: 'closed', action: 'سوّي ورجّع اللي ما اتستخدمش' },
    closed: { name: 'اتسوّت', badge: 'b-success', color: 'var(--success)', next: null },
  };
  const ORDER_STATUS = {
    draft: { name: 'مسودة', badge: 'b-muted' },
    pending: { name: 'مستني الاعتماد', badge: 'b-warning' },
    approved: { name: 'معتمد', badge: 'b-info' },
    delivered: { name: 'اتسلّم', badge: 'b-success' },
    cancelled: { name: 'اتلغى', badge: 'b-danger' },
  };
  const ROLES = {
    admin: { name: 'مدير النظام', icon: 'shield', tint: 'tint-primary' },
    warehouse: { name: 'أمين المخزن', icon: 'warehouse', tint: 'tint-accent' },
    sales: { name: 'مندوب مبيعات', icon: 'briefcase', tint: 'tint-warning' },
  };
  const MODULES = [
    { key: 'dashboard', name: 'لوحة التحكم' }, { key: 'products', name: 'الأصناف' },
    { key: 'inventory', name: 'المخزون والتشغيلات' }, { key: 'movements', name: 'حركات المخزن' },
    { key: 'barcodes', name: 'طباعة الباركود' }, { key: 'cases', name: 'العمليات الجراحية' },
    { key: 'orders', name: 'أوامر البيع' }, { key: 'customers', name: 'المستشفيات' },
    { key: 'reps', name: 'المناديب' }, { key: 'admin', name: 'لوحة الإدارة' },
  ];
  // access level per role & module: 0 none, 1 view, 2 edit
  const DEFAULT_PERMS = {
    admin: Object.fromEntries(MODULES.map((m) => [m.key, 2])),
    warehouse: { dashboard: 1, products: 2, inventory: 2, movements: 2, barcodes: 2, cases: 2, orders: 1, customers: 1, reps: 0, admin: 0 },
    sales: { dashboard: 1, products: 1, inventory: 1, movements: 0, barcodes: 0, cases: 2, orders: 2, customers: 1, reps: 1, admin: 0 },
  };


  /* ---------------- seed ---------------- */
  function seed(seedProducts, seedContract, now) {
    const rnd = U.rng(20261020);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const between = (a, b) => Math.floor(a + rnd() * (b - a + 1));
    const today = new Date(now || Date.now()); today.setHours(10, 0, 0, 0);
    const products = JSON.parse(JSON.stringify(seedProducts));

    const warehouses = [
      { id: 'W1', code: 'MAIN', name: 'المخزن الرئيسي — القاهرة', city: 'القاهرة', manager: 'U2', capacity: 450 },
      { id: 'W2', code: 'ALX', name: 'فرع الإسكندرية — سموحة', city: 'الإسكندرية', manager: 'U3', capacity: 220 },
      { id: 'W3', code: 'AST', name: 'فرع الصعيد — أسيوط', city: 'أسيوط', manager: 'U2', capacity: 120 },
    ];

    const reps = [
      { id: 'R1', name: 'أحمد سمير', region: 'القاهرة — شرق', phone: '0100 412 7781', target: 520000 },
      { id: 'R2', name: 'محمد عبد الرحمن', region: 'القاهرة — غرب والجيزة', phone: '0111 903 2264', target: 500000 },
      { id: 'R3', name: 'كريم حسن', region: 'الإسكندرية والبحيرة', phone: '0122 655 1029', target: 360000 },
      { id: 'R4', name: 'مصطفى عادل', region: 'الدلتا', phone: '0106 230 8812', target: 340000 },
      { id: 'R5', name: 'يوسف إبراهيم', region: 'الصعيد', phone: '0127 778 4410', target: 190000 },
      { id: 'R6', name: 'عمرو خالد', region: 'القناة وسيناء', phone: '0155 018 3307', target: 170000 },
    ];

    const customers = [
      { id: 'C1', name: 'مستشفى المدينة التخصصي', type: 'حكومي', city: 'القاهرة', rep: 'R1', discount: 0, contract: true },
      { id: 'C2', name: 'مستشفى الدمرداش الجامعي', type: 'جامعي', city: 'القاهرة', rep: 'R1', discount: 8 },
      { id: 'C3', name: 'معهد ناصر للبحوث والعلاج', type: 'حكومي', city: 'القاهرة', rep: 'R2', discount: 6 },
      { id: 'C4', name: 'مستشفى السلام الدولي', type: 'خاص', city: 'القاهرة', rep: 'R1', discount: 0 },
      { id: 'C5', name: 'مستشفى دار الفؤاد', type: 'خاص', city: 'الجيزة', rep: 'R2', discount: 0 },
      { id: 'C6', name: 'مستشفى الهلال للعظام', type: 'تأمين صحي', city: 'القاهرة', rep: 'R2', discount: 10 },
      { id: 'C7', name: 'مستشفى الإسكندرية الجامعي (الميري)', type: 'جامعي', city: 'الإسكندرية', rep: 'R3', discount: 8 },
      { id: 'C8', name: 'مستشفى سموحة التخصصي', type: 'خاص', city: 'الإسكندرية', rep: 'R3', discount: 3 },
      { id: 'C9', name: 'مستشفى المنصورة الجامعي', type: 'جامعي', city: 'المنصورة', rep: 'R4', discount: 8 },
      { id: 'C10', name: 'مستشفى طنطا الجامعي', type: 'جامعي', city: 'طنطا', rep: 'R4', discount: 8 },
      { id: 'C11', name: 'مستشفى أسيوط الجامعي', type: 'جامعي', city: 'أسيوط', rep: 'R5', discount: 7 },
      { id: 'C12', name: 'مجمع الإسماعيلية الطبي', type: 'تأمين صحي', city: 'الإسماعيلية', rep: 'R6', discount: 5 },
    ];
    customers.forEach((c, i) => { c.phone = `0${[2, 2, 2, 2, 2, 2, 3, 3, 50, 40, 88, 64][i]}-${between(2100000, 2999999)}`; c.contact = pick(['قسم المشتريات', 'إدارة الصيدلية', 'مدير المخازن', 'قسم العظام']); });

    // contract price list from the client's sheet (Nasr City hospital)
    const contractMap = ['P001', 'P002', 'P004', 'P008'];
    const contracts = seedContract.items.map((it, i) => ({ customerId: 'C1', productId: contractMap[i], name: it.name, p2025: it.p2025, p2026: it.p2026 }));

    const users = [
      { id: 'U1', name: 'م. شريف الدسوقي', role: 'admin', title: 'المدير العام', email: 'admin@lifemedx.eg', active: true },
      { id: 'U2', name: 'محمود عبد العزيز', role: 'warehouse', title: 'أمين المخزن الرئيسي', email: 'store@lifemedx.eg', active: true },
      { id: 'U3', name: 'هالة منصور', role: 'warehouse', title: 'مراقب مخزون — الإسكندرية', email: 'alex.store@lifemedx.eg', active: true },
      ...reps.map((r, i) => ({ id: 'U' + (i + 4), name: r.name, role: 'sales', title: 'مندوب مبيعات — ' + r.region, email: `rep${i + 1}@lifemedx.eg`, active: true, repId: r.id })),
    ];

    // ---- lots (current stock) ----
    const baseQty = { P001: 26, P002: 7, P003: 140, P004: 11, P005: 4, P006: 3, P007: 38, P008: 9, P009: 5, P010: 14, P011: 18, P012: 22, P013: 6,
      P014: 12, P015: 9, P016: 3, P017: 7, P018: 15, P019: 8, P020: 6, P021: 0, P022: 4, P023: 10, P024: 24, P025: 2, P026: 6 };
    const lots = [];
    products.forEach((p) => {
      const total = baseQty[p.id] ?? 8;
      if (!total) return;
      const nLots = p.category === 'power' ? 1 : total > 12 ? 3 : total > 5 ? 2 : 1;
      let left = total;
      for (let k = 0; k < nLots; k++) {
        const q = k === nLots - 1 ? left : Math.max(1, Math.round(left * (0.45 + rnd() * 0.2)));
        left -= q;
        const short = p.category === 'cement' || p.category === 'consum';
        let exp = U.addDays(today, short ? between(120, 620) : between(500, 1800));
        if ((p.id === 'P003' && k === 0) || (p.id === 'P007' && k === 0)) exp = U.addDays(today, between(25, 60));
        if (p.id === 'P018' && k === 0) exp = U.addDays(today, 74);
        const wh = k === 0 ? 'W1' : k === 1 ? pick(['W1', 'W2']) : pick(['W2', 'W3']);
        const recv = U.addDays(today, -between(20, 300));
        const pre = p.brand === 'DemoOrtho' ? 'MP' : p.brand === 'DemoMed' ? 'MB' : 'LM';
        lots.push({ id: U.uid('lot'), productId: p.id, lot: `${pre}${String(recv.getFullYear()).slice(2)}${String(recv.getMonth() + 1).padStart(2, '0')}-${between(1000, 9899)}`, warehouseId: wh, qty: q, expiry: U.dayISO(exp), received: U.dayISO(recv), location: `${pick(['A', 'B', 'C', 'D'])}-${between(1, 6)}-${between(1, 4)}` });
      }
    });

    // ---- sales orders (12 months history, upward trend) ----
    const orders = [];
    const sellable = products.filter((p) => p.category !== 'power');
    let soNo = 1;
    for (let m = 11; m >= 0; m--) {
      const count = m === 0 ? Math.max(5, Math.round(today.getDate() / 2) + 1) : between(9, 13) + Math.round((11 - m) / 3);
      for (let k = 0; k < count; k++) {
        const date = new Date(today.getFullYear(), today.getMonth() - m, m === 0 ? between(1, today.getDate()) : between(1, 28), between(9, 17), between(0, 59));
        const cust = m === 0 ? pick(customers.filter((c) => c.rep === reps[k % reps.length].id)) : pick(customers);
        const main = pick(sellable.filter((p) => p.category === 'knee' || p.category === 'hip'));
        const lines = [{ productId: main.id, qty: between(1, 3) }];
        if (rnd() > 0.35) lines.push({ productId: 'P003', qty: between(1, 4) });
        if (rnd() > 0.6) lines.push({ productId: pick(sellable.filter((p) => p.category === 'parts')).id, qty: between(1, 2) });
        lines.forEach((l) => (l.price = priceFor(products, contracts, customers, l.productId, cust.id)));
        let status = 'delivered';
        if (m === 0 && k >= count - 5) status = ['draft', 'pending', 'pending', 'approved', 'approved'][count - 1 - k] || 'delivered';
        if (rnd() < 0.03) status = 'cancelled';
        orders.push({ id: U.uid('so'), no: `SO-${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}-${String(soNo++).padStart(4, '0')}`, date: U.iso(date), customerId: cust.id, repId: cust.rep, lines, status, note: '' });
      }
    }

    // monthly targets ≈ 6-month average × 1.15, so achievement percentages look realistic
    reps.forEach((r) => {
      const from = new Date(today.getFullYear(), today.getMonth() - 6, 1), to = new Date(today.getFullYear(), today.getMonth(), 1);
      const six = orders.filter((o) => o.repId === r.id && o.status !== 'cancelled' && new Date(o.date) >= from && new Date(o.date) < to);
      r.target = Math.max(150000, Math.round((U.sum(six, (o) => U.sum(o.lines, (l) => l.qty * l.price)) / 6) * 1.15 / 10000) * 10000);
    });

    // ---- surgery cases ----
    const procs = [
      { name: 'تغيير مفصل ركبة كامل (أولي)', items: [['P001', 1], ['P003', 2]], set: 'طقم أدوات ركبة أولي' },
      { name: 'تغيير مفصل ركبة — حالة إعادة', items: [['P002', 1], ['P003', 2], ['P008', 1]], set: 'طقم أدوات ركبة إعادة' },
      { name: 'مفصل ركبة بجزع طويل', items: [['P004', 1], ['P003', 2]], set: 'طقم أدوات ركبة أولي' },
      { name: 'تغيير مفصل فخذ كامل غير أسمنتي', items: [['P020', 1], ['P023', 1]], set: 'طقم أدوات مفصل الفخذ' },
      { name: 'نصف مفصل فخذ ثنائي القطب', items: [['P019', 1], ['P003', 1]], set: 'طقم أدوات Bipolar' },
      { name: 'مفصل فخذ هجين', items: [['P025', 1], ['P003', 1]], set: 'طقم أدوات مفصل الفخذ' },
    ];
    const surgeons = ['د. هشام فؤاد', 'د. طارق الجمال', 'د. أيمن رشدي', 'د. وليد البنا', 'د. سامح عزمي', 'د. خالد الشافعي', 'د. ياسر النجار', 'د. عمرو الحديدي'];
    const caseStates = [
      ...Array(5).fill('scheduled'), ...Array(4).fill('issued'), ...Array(3).fill('done'), ...Array(6).fill('closed'),
    ];
    const cases = caseStates.map((st, i) => {
      const pr = pick(procs);
      const cust = pick(customers);
      const off = st === 'scheduled' ? between(1, 9) : st === 'issued' ? between(0, 1) : st === 'done' ? -between(1, 3) : -between(4, 25);
      const d = U.addDays(today, off); d.setHours(between(8, 14), pick([0, 30]), 0, 0);
      return {
        id: U.uid('cs'), no: `CS-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(140 + i).padStart(4, '0')}`,
        date: U.iso(d), customerId: cust.id, repId: cust.rep, surgeon: pick(surgeons), procedure: pr.name, set: pr.set + ' #' + between(1, 3),
        mrn: 'MRN-' + between(100000, 999999), status: st,
        items: pr.items.map(([pid, q]) => ({ productId: pid, qty: q + (pid === 'P003' ? 1 : 0), used: st === 'closed' ? q : null })),
      };
    });

    // ---- movement history ----
    const suppliers = ['DemoOrtho Supplies — Demo', 'DemoMed Supplies — Demo', 'مصنع تجريبي — مدينة تجريبية'];
    const movements = [];
    const mvCounters = { in: 210, out: 640, transfer: 75, return: 52 };
    for (let i = 0; i < 46; i++) {
      const type = pick(['out', 'out', 'out', 'in', 'in', 'transfer', 'return']);
      const d = U.addDays(today, -between(0, 75)); d.setHours(between(8, 18), between(0, 59));
      const lines = Array.from({ length: between(1, 3) }, () => {
        const p = pick(products);
        return { productId: p.id, qty: type === 'in' ? between(4, 20) : between(1, 4), lot: pick(lots.filter((l) => l.productId === p.id))?.lot || '—' };
      });
      const cust = pick(customers);
      movements.push({
        id: U.uid('mv'), type, no: `${MOVE_TYPES[type].prefix}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(++mvCounters[type]).padStart(4, '0')}`,
        date: U.iso(d), warehouseId: type === 'transfer' ? 'W1' : pick(['W1', 'W1', 'W1', 'W2', 'W3']), toWarehouseId: type === 'transfer' ? pick(['W2', 'W3']) : null,
        party: type === 'in' ? pick(suppliers) : type === 'transfer' ? '' : cust.name, repId: type === 'out' || type === 'return' ? cust.rep : null,
        userId: pick(['U2', 'U2', 'U3']), lines, note: type === 'out' ? 'صرف على عملية جراحية' : type === 'return' ? 'رد غير مستخدم بعد العملية' : '',
      });
    }
    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    const activity = [
      ['U2', 'أنشأ إذن صرف GIN على عملية بمستشفى الدمرداش', 0.4],
      ['U4', 'جدول عملية تغيير مفصل ركبة بمستشفى المدينة التخصصي', 1.2],
      ['U1', 'اعتمد أمر البيع لمستشفى السلام الدولي', 2.5],
      ['U3', 'استلم شحنة مفاصل فخذ — فرع الإسكندرية', 4],
      ['U6', 'أضاف أمر بيع جديد لمستشفى الإسكندرية الجامعي', 6],
      ['U2', 'حدّث موقع التخزين لتشغيلة أسمنت عظام', 9],
      ['U1', 'عدّل صلاحيات دور مندوب المبيعات', 22],
      ['U5', 'سوّى عملية ورجّع 2 عبوة أسمنت للمخزن', 27],
      ['U2', 'نفّذ إذن تحويل من المخزن الرئيسي إلى فرع الصعيد', 30],
      ['U1', 'أضاف مستخدم جديد: هالة منصور', 52],
    ].map(([u, t, h]) => ({ id: U.uid('ac'), userId: u, text: t, at: U.iso(Date.now() - h * 36e5) }));

    return {
      version: 1, createdAt: U.iso(today), products, warehouses, lots, reps, customers, contracts, users, orders, cases, movements, activity,
      perms: JSON.parse(JSON.stringify(DEFAULT_PERMS)),
      settings: { company: 'لايف ميديكس للأجهزة الطبية', companyEn: 'Life Medx Medical Devices', expiryWarnDays: 90, issuePolicy: 'FEFO', currency: 'EGP', vat: 14 },
      counters: { ...mvCounters, so: soNo, cs: 140 + caseStates.length },
    };
  }

  function priceFor(products, contracts, customers, productId, customerId) {
    const c = contracts.find((x) => x.customerId === customerId && x.productId === productId);
    if (c && (c.p2026 || c.p2025)) return c.p2026 || c.p2025;
    const p = products.find((x) => x.id === productId);
    const cust = customers.find((x) => x.id === customerId);
    return Math.round((p.price * (1 - (cust?.discount || 0) / 100)) / 100) * 100;
  }


  /* ---------------- queries (pure, take the state) ---------------- */
  const by = (arr, id) => arr.find((x) => x.id === id);
  const Q = {
    product: (st, id) => by(st.products, id),
    customer: (st, id) => by(st.customers, id),
    rep: (st, id) => by(st.reps, id),
    user: (st, id) => by(st.users, id),
    warehouse: (st, id) => by(st.warehouses, id),
    lotsOf: (st, pid, wh) => st.lots.filter((l) => l.productId === pid && l.qty > 0 && (!wh || l.warehouseId === wh)),
    stock: (st, pid, wh) => U.sum(Q.lotsOf(st, pid, wh), (l) => l.qty),
    priceFor: (st, pid, cid) => priceFor(st.products, st.contracts, st.customers, pid, cid),
    orderTotal: (o) => U.sum(o.lines, (l) => l.qty * l.price),
    reserved: (st, pid) => U.sum(st.cases.filter((c) => c.status === 'scheduled'), (c) => U.sum(c.items.filter((i) => i.productId === pid), (i) => i.qty)),
  };

  /* ---------------- actions: (state, payload, ctx{userId, user, now}) -> result; throw to reject ---------------- */
  const fail = (msg) => { throw new Error(msg); };
  const log = (st, ctx, text) => { st.activity.unshift({ id: U.uid('ac'), userId: ctx.userId, text, at: U.iso(ctx.now) }); st.activity = st.activity.slice(0, 300); };
  const nextNo = (st, ctx, prefix, key) => { const d = ctx.now; st.counters[key] = (st.counters[key] || 0) + 1; return `${prefix}-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(st.counters[key]).padStart(4, '0')}`; };
  const ownCustomer = (st, ctx, cid) => { const c = Q.customer(st, cid) || fail('المستشفى ده مش موجود'); if (ctx.user?.role === 'sales' && c.rep !== ctx.user.repId) fail('المستشفى ده مش متسجّل باسمك'); return c; };

  /** Which lots an issue would take, earliest expiry first (FEFO) or earliest received (FIFO); expired lots are never issued.
      Pure — the picking screen shows exactly what consume() will take. */
  Q.allocate = (st, pid, wh, qty, now = new Date()) => {
    const key = st.settings.issuePolicy === 'FIFO' ? 'received' : 'expiry';
    const today = U.dayISO(now);
    const lots = Q.lotsOf(st, pid, wh).filter((l) => !l.expiry || l.expiry >= today).sort((a, b) => String(a[key]).localeCompare(String(b[key])));
    const alloc = [];
    for (const l of lots) {
      if (qty <= 0) break;
      const take = Math.min(l.qty, qty);
      qty -= take;
      alloc.push({ lotId: l.id, lot: l.lot, qty: take, expiry: l.expiry, location: l.location });
    }
    return { alloc, missing: qty };
  };
  function consume(st, pid, wh, qty, now) {
    const { alloc, missing } = Q.allocate(st, pid, wh, qty, now);
    if (missing > 0) fail(`الكمية مش كفاية من ${Q.product(st, pid).shortAr} (التشغيلات المنتهية مش بتتحسب)`);
    alloc.forEach((a) => { st.lots.find((l) => l.id === a.lotId).qty -= a.qty; });
    return alloc;
  }
  function receive(st, ctx, pid, wh, qty, lotNo, expiry) {
    let l = st.lots.find((x) => x.productId === pid && x.warehouseId === wh && x.lot === lotNo);
    if (!l) { l = { id: U.uid('lot'), productId: pid, lot: lotNo, warehouseId: wh, qty: 0, expiry, received: U.dayISO(ctx.now), location: 'استلام' }; st.lots.push(l); }
    l.qty += qty;
  }

  const A = {};
  A.addMovement = (st, m, ctx) => {
    if (!MOVE_TYPES[m.type] || MOVE_TYPES[m.type].own) fail('نوع الإذن ده مش معروف');
    if (!Q.warehouse(st, m.warehouseId)) fail('المخزن ده مش موجود');
    if (m.type === 'transfer' && (!Q.warehouse(st, m.toWarehouseId) || m.toWarehouseId === m.warehouseId)) fail('اختار مخزنين مختلفين للتحويل');
    if (!Array.isArray(m.lines) || !m.lines.length) fail('ضيف صنف واحد على الأقل');
    const lines = [];
    for (const ln of m.lines) {
      const qty = Math.floor(+ln.qty);
      if (!Q.product(st, ln.productId) || !(qty > 0)) fail('فيه سطر مش مظبوط في الإذن');
      if (m.type === 'in' || m.type === 'return') {
        const lotNo = String(ln.lot || '').trim() || `LM${U.dayISO(ctx.now).slice(2, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 8999)}`;
        receive(st, ctx, ln.productId, m.warehouseId, qty, lotNo, ln.expiry || U.dayISO(U.addDays(ctx.now, 730)));
        lines.push({ productId: ln.productId, qty, lot: lotNo });
      } else {
        consume(st, ln.productId, m.warehouseId, qty, ctx.now).forEach((a) => {
          lines.push({ productId: ln.productId, qty: a.qty, lot: a.lot });
          if (m.type === 'transfer') receive(st, ctx, ln.productId, m.toWarehouseId, a.qty, a.lot, a.expiry);
        });
      }
    }
    const mv = { id: U.uid('mv'), type: m.type, no: nextNo(st, ctx, MOVE_TYPES[m.type].prefix, m.type), date: U.iso(ctx.now), warehouseId: m.warehouseId, toWarehouseId: m.type === 'transfer' ? m.toWarehouseId : null,
      party: String(m.party || ''), repId: m.repId || null, userId: ctx.userId, lines, note: String(m.note || '') };
    st.movements.unshift(mv);
    log(st, ctx, `أنشأ ${MOVE_TYPES[m.type].name} ${mv.no}`);
    return mv;
  };

  A.addCase = (st, c, ctx) => {
    const cust = ownCustomer(st, ctx, c.customerId);
    if (!c.items?.length) fail('العملية مفيهاش أصناف');
    const cs = { id: U.uid('cs'), no: nextNo(st, ctx, 'CS', 'cs'), status: 'scheduled', mrn: c.mrn || 'MRN-' + Math.floor(100000 + Math.random() * 899999),
      procedure: String(c.procedure), set: String(c.set || ''), customerId: cust.id, repId: cust.rep, surgeon: String(c.surgeon || ''), date: c.date,
      items: c.items.map((i) => ({ productId: i.productId, qty: Math.max(1, Math.floor(+i.qty)), used: null })) };
    st.cases.unshift(cs);
    log(st, ctx, `جدول عملية ${cs.procedure} — ${cust.name}`);
    return cs;
  };

  /** Advance a surgery case one step; issuing and settling create the matching stock movements / sales order. */
  A.advanceCase = (st, { id, used }, ctx) => {
    const c = st.cases.find((x) => x.id === id) || fail('العملية دي مش موجودة');
    if (ctx.user?.role === 'sales' && c.repId !== ctx.user.repId) fail('العملية دي مش باسمك');
    const s = CASE_STATUS[c.status];
    if (!s.next) fail('العملية اتسوّت خلاص');
    const cust = Q.customer(st, c.customerId);
    const result = {};
    if (c.status === 'scheduled') {
      result.movement = A.addMovement(st, { type: 'out', warehouseId: 'W1', party: cust.name, repId: c.repId, note: `صرف على عملية ${c.no}`, lines: c.items.map((i) => ({ productId: i.productId, qty: i.qty })) }, ctx);
    }
    if (c.status === 'done') {
      c.items.forEach((i) => (i.used = Math.max(0, Math.min(i.qty, Math.floor(+(used?.[i.productId] ?? i.qty))))));
      const back = c.items.filter((i) => i.qty - i.used > 0).map((i) => ({ productId: i.productId, qty: i.qty - i.used }));
      if (back.length) result.movement = A.addMovement(st, { type: 'return', warehouseId: 'W1', party: cust.name, repId: c.repId, note: `رد غير المستخدم من عملية ${c.no}`, lines: back }, ctx);
      const lines = c.items.filter((i) => i.used > 0).map((i) => ({ productId: i.productId, qty: i.used, price: Q.priceFor(st, i.productId, c.customerId) }));
      if (lines.length) result.order = A.addOrder(st, { customerId: c.customerId, lines, status: 'pending', note: `تلقائي من العملية ${c.no}`, system: true }, ctx);
    }
    c.status = s.next;
    log(st, ctx, `نقل العملية ${c.no} إلى «${CASE_STATUS[c.status].name}»`);
    result.case = c;
    return result;
  };

  A.addOrder = (st, o, ctx) => {
    const cust = o.system ? Q.customer(st, o.customerId) : ownCustomer(st, ctx, o.customerId);
    if (!o.lines?.length) fail('ضيف صنف واحد على الأقل');
    const status = o.status === 'draft' ? 'draft' : 'pending';
    // prices always come from the price list / contract, never from the client
    const lines = o.lines.map((l) => ({ productId: l.productId, qty: Math.max(1, Math.floor(+l.qty)), price: Q.priceFor(st, l.productId, cust.id) }));
    const so = { id: U.uid('so'), no: nextNo(st, ctx, 'SO', 'so'), date: U.iso(ctx.now), customerId: cust.id, repId: cust.rep, lines, status, note: String(o.note || '') };
    st.orders.unshift(so);
    log(st, ctx, `أنشأ أمر بيع ${so.no} — ${cust.name}`);
    return so;
  };

  A.setOrderStatus = (st, { id, status }, ctx) => {
    const o = st.orders.find((x) => x.id === id) || fail('أمر البيع ده مش موجود');
    const allowed = { draft: ['pending'], pending: ['approved', 'cancelled'], approved: ['delivered', 'cancelled'] }[o.status] || [];
    if (!allowed.includes(status)) fail('مينفعش تغيّر الحالة بالشكل ده');
    if (status !== 'pending' && ctx.user?.role !== 'admin') fail('الاعتماد والتسليم لمدير النظام بس');
    if (ctx.user?.role === 'sales' && o.repId !== ctx.user.repId) fail('الأمر ده مش باسمك');
    if (status === 'delivered' && !o.issuedMovementId) fail('لازم المخزن يجهّز ويصرف الأمر الأول قبل تسجيل التسليم');
    o.status = status;
    log(st, ctx, `غيّر حالة أمر البيع ${o.no} إلى «${ORDER_STATUS[status].name}»`);
    return o;
  };

  /** Return specific lots to the supplier (expired or near expiry). Picks lots by id, so expired stock can go back
      here — and only here; sales issues and transfers never take expired lots. */
  A.returnToSupplier = (st, r, ctx) => {
    const party = String(r.party || '').trim();
    if (party.length < 2) fail('اكتب اسم المورد');
    if (!Array.isArray(r.lines) || !r.lines.length) fail('اختار تشغيلة واحدة على الأقل');
    const wh = Q.warehouse(st, r.warehouseId) || fail('المخزن ده مش موجود');
    const lines = r.lines.map((ln) => {
      const l = st.lots.find((x) => x.id === ln.lotId) || fail('التشغيلة دي مش موجودة');
      const qty = Math.floor(+ln.qty);
      if (l.warehouseId !== wh.id) fail(`التشغيلة ${l.lot} مش في ${wh.name}`);
      if (!(qty > 0) || qty > l.qty) fail(`الكمية في التشغيلة ${l.lot} لازم تكون بين 1 و${l.qty}`);
      return { l, qty };
    });
    const ids = lines.map((x) => x.l.id);
    if (new Set(ids).size !== ids.length) fail('التشغيلة متكررة في المرتجع');
    lines.forEach(({ l, qty }) => { l.qty -= qty; });
    const mv = { id: U.uid('mv'), type: 'rts', no: nextNo(st, ctx, MOVE_TYPES.rts.prefix, 'rts'), date: U.iso(ctx.now), warehouseId: wh.id, toWarehouseId: null,
      party, repId: null, userId: ctx.userId, lines: lines.map(({ l, qty }) => ({ productId: l.productId, qty, lot: l.lot, expiry: l.expiry })), note: String(r.note || '') };
    st.movements.unshift(mv);
    log(st, ctx, `رجّع ${U.sum(mv.lines, (x) => x.qty)} وحدة للمورد ${party} بإذن ${mv.no}`);
    return mv;
  };

  /** Warehouse issues an approved sales order: one GIN from the main warehouse (FEFO), linked to the order so it can't go out twice.
      Delivery stays a separate admin step. */
  A.issueOrder = (st, { id }, ctx) => {
    const o = st.orders.find((x) => x.id === id) || fail('أمر البيع ده مش موجود');
    if (o.status !== 'approved') fail('مينفعش يتصرف غير أمر بيع معتمد');
    if (o.issuedMovementId) fail('الأمر ده اتصرف قبل كده');
    const cust = Q.customer(st, o.customerId);
    const mv = A.addMovement(st, { type: 'out', warehouseId: 'W1', party: cust.name, repId: o.repId, note: `صرف أمر بيع ${o.no}`, lines: o.lines.map((l) => ({ productId: l.productId, qty: l.qty })) }, ctx);
    o.issuedMovementId = mv.id;
    log(st, ctx, `جهّز وصرف أمر البيع ${o.no} بإذن ${mv.no}`);
    return { order: o, movement: mv };
  };

  A.addProduct = (st, f, ctx) => {
    const barcode = String(f.barcode || '').replace(/\D/g, '');
    if (!f.nameAr || barcode.length !== 13) fail('اكتب الاسم وباركود من 13 رقم');
    if (st.products.some((p) => p.barcode === barcode)) fail('الباركود ده متسجّل على صنف تاني');
    if (!CATEGORIES[f.category]) fail('الفئة دي مش معروفة');
    const n = st.products.length + 1;
    const price = Math.max(0, +f.price || 0);
    const p = { id: 'P' + String(n).padStart(3, '0') + U.uid('').slice(-3), sku: 'LMX-' + String(n).padStart(3, '0'), barcode, nameAr: f.nameAr, shortAr: f.shortAr || f.nameAr, nameEn: f.nameEn || '—', descEn: f.nameEn || '',
      category: f.category, brand: 'Life Medx', origin: '—', unit: 'قطعة', price, cost: Math.round(price * 0.62), minStock: Math.max(0, +f.minStock || 0), tracking: 'serial' };
    st.products.push(p);
    log(st, ctx, `أضاف صنف جديد: ${p.nameAr}`);
    return p;
  };

  A.toggleUser = (st, { id }, ctx) => {
    const u = Q.user(st, id) || fail('المستخدم ده مش موجود');
    if (u.id === ctx.userId) fail('مينفعش توقف حسابك');
    u.active = !u.active;
    log(st, ctx, `${u.active ? 'فعّل' : 'أوقف'} المستخدم ${u.name}`);
    return u;
  };
  A.setPerm = (st, { role, module, level }, ctx) => {
    if (!st.perms[role] || role === 'admin' || !MODULES.some((m) => m.key === module) || ![0, 1, 2].includes(+level)) fail('الصلاحية دي مش مظبوطة');
    st.perms[role][module] = +level;
    log(st, ctx, `عدّل صلاحية «${MODULES.find((m) => m.key === module).name}» لدور ${ROLES[role].name}`);
    return st.perms[role];
  };
  A.addUser = (st, f, ctx) => {
    if (!f.name || f.name.length < 3) fail('اكتب اسم المستخدم');
    if (!ROLES[f.role]) fail('الدور ده مش معروف');
    const u = { id: U.uid('U'), name: f.name, role: f.role, title: f.title || ROLES[f.role].name, email: f.email || '—', active: true };
    if (f.role === 'sales') { const r = { id: U.uid('R'), name: f.name, region: f.region || 'غير محدد', phone: '—', target: 300000 }; st.reps.push(r); u.repId = r.id; }
    st.users.push(u);
    log(st, ctx, `أضاف مستخدم جديد: ${u.name}`);
    return u;
  };
  A.addWarehouse = (st, f, ctx) => {
    if (!f.name || !f.code) fail('اكتب الاسم والكود');
    const w = { id: U.uid('W'), code: String(f.code).toUpperCase().slice(0, 4), name: f.name, city: f.city || '—', manager: 'U2', capacity: 300 };
    st.warehouses.push(w);
    log(st, ctx, `أضاف مخزن جديد: ${f.name}`);
    return w;
  };
  A.saveSettings = (st, f, ctx) => {
    Object.assign(st.settings, { company: String(f.company || st.settings.company), companyEn: String(f.companyEn || st.settings.companyEn), expiryWarnDays: +f.expiryWarnDays || 90, issuePolicy: f.issuePolicy === 'FIFO' ? 'FIFO' : 'FEFO', vat: +f.vat || 0 });
    log(st, ctx, 'حدّث إعدادات النظام');
    return st.settings;
  };

  /** module + minimum level each action needs (checked against state.perms for the caller's role) */
  const NEEDS = {
    addMovement: ['movements', 2], issueOrder: ['movements', 2], returnToSupplier: ['movements', 2], addCase: ['cases', 2], advanceCase: ['cases', 2], addOrder: ['orders', 2], setOrderStatus: ['orders', 2], addProduct: ['products', 2],
    toggleUser: ['admin', 2], setPerm: ['admin', 2], addUser: ['admin', 2], addWarehouse: ['admin', 2], saveSettings: ['admin', 2],
  };
  const canDo = (st, user, name) => {
    const need = NEEDS[name];
    if (!need || !user || !user.active) return false;
    return (st.perms[user.role]?.[need[0]] || 0) >= need[1];
  };

  /** Run an action on a copy of the state; the copy is returned only when the action succeeds. */
  function run(st, name, payload, ctx) {
    if (!A[name]) fail('العملية دي مش معروفة');
    const user = Q.user(st, ctx.userId);
    if (!canDo(st, user, name)) fail('مش مسموح لك تعمل العملية دي');
    const next = JSON.parse(JSON.stringify(st));
    const result = A[name](next, payload || {}, { ...ctx, user, now: ctx.now || new Date() });
    return { state: next, result: JSON.parse(JSON.stringify(result ?? null)) };
  }

  return { META: { CATEGORIES, MOVE_TYPES, CASE_STATUS, ORDER_STATUS, ROLES, MODULES }, DEFAULT_PERMS, seed, Q, actions: A, run, canDo, util: U };
});
