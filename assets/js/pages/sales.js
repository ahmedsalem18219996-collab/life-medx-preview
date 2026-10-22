/* Sales screens: surgery cases, sales orders, hospitals, reps. */
(function (App) {
  'use strict';
  const U = App.util, S = App.store, I = App.icon, M = App.meta, C = App.charts;
  const CS = M.CASE_STATUS, OS = M.ORDER_STATUS;
  const myFilter = (repField = 'repId') => (x) => { const r = S.myRepId(); return !r || x[repField] === r; };

  /* =============== Surgery cases =============== */
  const cf = { view: 'board', q: '' };
  const STEP_ICON = { scheduled: 'calendar', issued: 'out', done: 'pulse', closed: 'checkCircle' };
  App.pages.cases = {
    title: 'العمليات الجراحية',
    render() {
      const list = S.state.cases.filter(myFilter()).filter((c) => U.match(cf.q, c.no, c.procedure, c.surgeon, S.customer(c.customerId).name)).sort((a, b) => a.date.localeCompare(b.date));
      const canEdit = S.can('cases', 2);
      const flow = `<div class="card" style="padding:14px 18px;margin-bottom:18px"><div class="row wrap" style="gap:6px;justify-content:space-between">${Object.entries(CS).map(([k, s], i) => `<div class="row" style="gap:10px"><span class="k-ic" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb, ${s.color} 14%, transparent);color:${s.color}">${I(STEP_ICON[k], 18)}</span><div><div style="font-weight:700;font-size:13px">${i + 1}. ${s.name}</div><div class="small muted">${['حجز الطقم والأصناف', 'خروج الطقم بعهدة المندوب', 'تسجيل المستخدم فعلياً', 'رد الباقي وإنشاء أمر بيع'][i]}</div></div></div>${i < 3 ? `<span class="muted">${I('chevL', 18)}</span>` : ''}`).join('')}</div></div>`;
      const board = `<div class="kanban">${Object.entries(CS).map(([k, s]) => { const items = list.filter((c) => c.status === k); return `<div class="kcol"><div class="kcol-head"><span class="bullet" style="background:${s.color}"></span>${s.name}<span class="n">${items.length}</span></div>
        ${items.map((c) => caseCard(c, canEdit)).join('') || `<div class="empty small" style="padding:30px 10px">مفيش عمليات</div>`}</div>`; }).join('')}</div>`;
      const table = `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>رقم العملية</th><th>الموعد</th><th>العملية</th><th>المستشفى</th><th>الجراح</th><th>المندوب</th><th>الحالة</th></tr></thead><tbody>
        ${list.map((c) => `<tr class="click" data-case="${c.id}"><td class="mono"><b>${c.no}</b></td><td class="small nowrap">${U.date(c.date)}<div class="muted">${U.time(c.date)}</div></td><td><b class="small">${U.esc(c.procedure)}</b></td><td class="small">${U.esc(S.customer(c.customerId).name)}</td><td class="small nowrap">${U.esc(c.surgeon)}</td><td class="small nowrap">${U.esc(S.rep(c.repId).name)}</td><td>${App.badge(CS[c.status].badge, CS[c.status].name)}</td></tr>`).join('')}</tbody></table></div></div>`;
      return `${App.pageHead('العمليات الجراحية', 'متابعة أطقم المفاصل من الحجز لحد التسوية — ومربوطة أوتوماتيك بالمخزن والمبيعات',
        `<div class="input-icon" style="width:240px">${I('search', 17)}<input class="input" data-f="q" placeholder="بحث…" value="${U.esc(cf.q)}"></div><div class="seg"><button class="${cf.view === 'board' ? 'on' : ''}" data-view="board">${I('dashboard', 15)} لوحة</button><button class="${cf.view === 'list' ? 'on' : ''}" data-view="list">${I('menu', 15)} قائمة</button></div>${canEdit ? `<button class="btn primary" data-a="new">${I('plus', 17)} جدولة عملية</button>` : ''}`)}
        ${flow}${cf.view === 'board' ? board : table}`;
    },
    mount(el, r) {
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { cf.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      el.addEventListener('click', (e) => {
        const adv = e.target.closest('[data-adv]'); if (adv) { e.stopPropagation(); advance(adv.dataset.adv); return; }
        const v = e.target.closest('[data-view]'); if (v) { cf.view = v.dataset.view; App.refresh(); return; }
        const c = e.target.closest('[data-case]'); if (c) App.openCase(c.dataset.case);
        if (e.target.closest('[data-a="new"]')) newCase();
      });
      if (r.query.get('new') && S.can('cases', 2)) { history.replaceState(null, '', '#/cases'); newCase(); }
    },
  };

  function caseCard(c, canEdit) {
    const s = CS[c.status];
    const days = U.daysBetween(U.dayISO(new Date()), U.dayISO(c.date));
    const when = days === 0 ? 'اليوم' : days === 1 ? 'غداً' : days === -1 ? 'أمس' : days > 0 ? `بعد ${days} أيام` : `منذ ${-days} أيام`;
    return `<div class="kcard spot" data-case="${c.id}"><div class="row between"><span class="kc-no mono">${c.no}</span><span class="badge plain ${days === 0 ? 'b-danger' : 'b-muted'}">${when}</span></div>
      <div class="kc-t">${U.esc(c.procedure)}</div><div class="small muted">${U.esc(S.customer(c.customerId).name)}</div>
      <div class="kc-meta"><span>${I('calendar', 13)} ${U.dateShort(c.date)} · ${U.time(c.date)}</span><span>${I('user', 13)} ${U.esc(c.surgeon)}</span><span>${I('package', 13)} ${U.sum(c.items, (i) => i.qty)} وحدة</span></div>
      <div class="kc-foot"><div class="row" style="gap:6px">${U.avatar(S.rep(c.repId).name, 'sm')}<span class="small">${U.esc(S.rep(c.repId).name)}</span></div>
        ${s.next && canEdit ? `<button class="btn sm" data-adv="${c.id}" title="${s.action}">${I(STEP_ICON[s.next], 14)} ${s.next === 'issued' ? 'صرف' : s.next === 'done' ? 'تمت' : 'تسوية'}</button>` : c.status === 'closed' ? `<span style="color:var(--success)">${I('checkCircle', 18)}</span>` : ''}</div></div>`;
  }

  function advance(id, after) {
    const c = S.state.cases.find((x) => x.id === id);
    if (c.status === 'done') return settle(c, after);
    const s = CS[c.status];
    const isIssue = c.status === 'scheduled';
    App.ui.confirm(s.action, isIssue ? `هيتعمل إذن صرف أوتوماتيك من المخزن الرئيسي بعدد ${U.sum(c.items, (i) => i.qty)} وحدة للعملية <b>${c.no}</b> بعهدة ${U.esc(S.rep(c.repId).name)}.` : `تأكيد إجراء العملية <b>${c.no}</b> في ${U.esc(S.customer(c.customerId).name)}؟`, isIssue ? 'صرف الطقم' : 'تأكيد').then((ok) => {
      if (!ok) return;
      App.run('advanceCase', { id }, (res) => (res.movement ? `اتصرف — إذن ${res.movement.no}` : 'حالة العملية اتحدّثت')).then((res) => res && after && after());
    });
  }

  function settle(c, after) {
    const m = App.ui.modal({
      title: `تسوية العملية ${c.no}`, icon: 'checkCircle', iconTint: 'tint-success',
      body: `<div class="callout tint-info" style="margin-bottom:14px">${I('sparkles', 18)}<span>حدّد الكمية اللي اتستخدمت فعلاً. الباقي بيرجع المخزن بإذن مرتجع، وبيتعمل أمر بيع أوتوماتيك باللي اتستخدم بأسعار المستشفى.</span></div>
        <div class="card table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>المصروف</th><th>المستخدم فعلياً</th><th class="num">سعر المستشفى</th></tr></thead><tbody>
        ${c.items.map((i) => { const p = S.product(i.productId); return `<tr><td><div class="prod-cell" style="min-width:200px">${App.prodThumb(p, 32)}<span class="t small">${U.esc(p.shortAr)}</span></div></td><td><b>${i.qty}</b></td><td><input class="input" type="number" min="0" max="${i.qty}" value="${p.category === 'cement' ? Math.max(i.qty - 1, 1) : i.qty}" data-used="${i.productId}" style="width:80px;height:34px"></td><td class="num">${U.num(S.priceFor(i.productId, c.customerId))}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="row between" style="margin-top:14px"><span class="muted">قيمة أمر البيع المتوقع</span><b data-total style="font-size:18px"></b></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-ok>${I('check', 17)} تسوية وإنشاء أمر البيع</button>`,
    });
    const calc = () => { const t = U.sum(m.$$('[data-used]'), (x) => Math.min(+x.value, +x.max) * S.priceFor(x.dataset.used, c.customerId)); m.$('[data-total]').textContent = U.moneyTxt(t); };
    m.el.addEventListener('input', calc); calc();
    m.$('[data-ok]').onclick = () => {
      const used = Object.fromEntries(m.$$('[data-used]').map((x) => [x.dataset.used, Math.max(0, Math.min(+x.value || 0, +x.max))]));
      App.run('advanceCase', { id: c.id, used }, (res) => `اتسوّت العملية${res.order ? ` — أمر بيع ${res.order.no}` : ''}${res.movement ? ` ومرتجع ${res.movement.no}` : ''}`)
        .then((res) => { if (res) { m.close(); after && after(); } });
    };
  }

  App.openCase = (id) => {
    const c = S.state.cases.find((x) => x.id === id);
    const keys = Object.keys(CS), idx = keys.indexOf(c.status);
    const canEdit = S.can('cases', 2);
    const d = App.ui.drawer({
      title: `${U.esc(c.procedure)}`, icon: 'pulse', iconTint: 'tint-violet',
      body: `<div class="row wrap"><span class="mono muted">${c.no}</span>${App.badge(CS[c.status].badge, CS[c.status].name)}</div>
        <div class="row" style="margin:20px 0 6px;gap:0">${keys.map((k, i) => `<div class="grow" style="text-align:center;position:relative"><div style="height:3px;background:${i <= idx ? CS[k].color : 'var(--border)'};position:absolute;top:17px;left:0;right:0;${i === 0 ? 'right:50%' : ''}${i === keys.length - 1 ? 'left:50%' : ''}"></div><span style="position:relative;width:36px;height:36px;border-radius:50%;display:inline-grid;place-items:center;background:${i <= idx ? CS[k].color : 'var(--surface-3)'};color:${i <= idx ? '#fff' : 'var(--muted)'}">${I(STEP_ICON[k], 17)}</span><div class="small" style="margin-top:6px;font-weight:${i === idx ? 700 : 500}">${CS[k].name.split('—')[0]}</div></div>`).join('')}</div>
        <div class="section-title">${I('file', 16)} بيانات العملية</div>
        <dl class="kv"><dt>المستشفى</dt><dd>${U.esc(S.customer(c.customerId).name)}</dd><dt>الموعد</dt><dd>${U.date(c.date)} — ${U.time(c.date)}</dd><dt>الجراح</dt><dd>${U.esc(c.surgeon)}</dd><dt>رقم ملف المريض</dt><dd class="mono">${c.mrn}</dd><dt>المندوب</dt><dd>${U.esc(S.rep(c.repId).name)}</dd><dt>طقم الأدوات</dt><dd>${U.esc(c.set)}</dd></dl>
        <div class="section-title">${I('package', 16)} الأصناف المطلوبة</div>
        <div class="card table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>مطلوب</th><th>مستخدم</th><th>متاح بالمخزن</th></tr></thead><tbody>
          ${c.items.map((i) => { const p = S.product(i.productId); const av = S.stock(p.id, 'W1'); return `<tr><td><div class="prod-cell" style="min-width:200px">${App.prodThumb(p, 32)}<div><div class="t small">${U.esc(p.shortAr)}</div><div class="s mono">${p.barcode}</div></div></div></td><td><b>${i.qty}</b></td><td>${i.used ?? '—'}</td><td>${c.status === 'scheduled' ? `<b style="color:${av < i.qty ? 'var(--danger)' : 'var(--success)'}">${av}</b>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`,
      foot: CS[c.status].next && canEdit ? `<button class="btn" data-close>إغلاق</button><button class="btn primary" data-adv>${I(STEP_ICON[CS[c.status].next], 17)} ${CS[c.status].action}</button>` : '<button class="btn" data-close>إغلاق</button>',
    });
    const b = d.$('[data-adv]');
    if (b) b.onclick = () => { d.close(); advance(c.id); };
  };

  function newCase() {
    const st = S.state, rep = S.myRepId();
    const templates = [
      { name: 'تغيير مفصل ركبة كامل (أولي)', items: [['P001', 1], ['P003', 3]], set: 'طقم أدوات ركبة أولي' },
      { name: 'تغيير مفصل ركبة — حالة إعادة', items: [['P002', 1], ['P003', 3], ['P008', 1]], set: 'طقم أدوات ركبة إعادة' },
      { name: 'مفصل ركبة بجزع طويل', items: [['P004', 1], ['P003', 3]], set: 'طقم أدوات ركبة أولي' },
      { name: 'تغيير مفصل فخذ كامل غير أسمنتي', items: [['P020', 1], ['P023', 1]], set: 'طقم أدوات مفصل الفخذ' },
      { name: 'نصف مفصل فخذ ثنائي القطب', items: [['P019', 1], ['P003', 2]], set: 'طقم أدوات Bipolar' },
      { name: 'مفصل فخذ هجين', items: [['P025', 1], ['P003', 2]], set: 'طقم أدوات مفصل الفخذ' },
    ];
    const custs = st.customers.filter((c) => !rep || c.rep === rep);
    const tomorrow = U.addDays(new Date(), 2); tomorrow.setHours(10, 0, 0, 0);
    const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const m = App.ui.modal({
      title: 'جدولة عملية جراحية', icon: 'calendar', iconTint: 'tint-info',
      body: `<div class="form-grid"><div class="field full"><label>نوع العملية</label><select class="select" name="tpl">${templates.map((t, i) => `<option value="${i}">${t.name}</option>`).join('')}</select></div>
        <div class="field"><label>المستشفى</label><select class="select" name="cust">${custs.map((c) => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>الموعد</label><input class="input" type="datetime-local" name="date" value="${local}"></div>
        <div class="field"><label>الجراح</label><input class="input" name="surgeon" value="د. "></div>
        <div class="field"><label>رقم ملف المريض</label><input class="input mono" name="mrn" placeholder="اختياري"></div></div>
        <div class="section-title">${I('package', 16)} الأصناف المقترحة <span class="muted small" style="font-weight:400">— حسب نوع العملية</span></div><div data-items></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} جدولة وحجز الأصناف</button>`,
    });
    const draw = () => {
      const t = templates[+m.$('[name="tpl"]').value];
      m.$('[data-items]').innerHTML = `<div class="list">${t.items.map(([pid, q]) => { const p = S.product(pid); const av = S.stock(pid, 'W1') - S.reserved(pid); return `<div class="list-item">${App.prodThumb(p, 34)}<div class="grow"><div class="li-t small">${U.esc(p.shortAr)}</div><div class="li-s">متاح للحجز: <b style="color:${av < q ? 'var(--danger)' : 'var(--success)'}">${av}</b></div></div><b>× ${q}</b></div>`; }).join('')}</div><div class="small muted" style="margin-top:6px">${I('wrench', 13)} ${t.set}</div>`;
    };
    m.$('[name="tpl"]').onchange = draw; draw();
    m.$('[data-save]').onclick = () => {
      const t = templates[+m.$('[name="tpl"]').value];
      const cust = S.customer(m.$('[name="cust"]').value);
      const surgeon = m.$('[name="surgeon"]').value.trim();
      if (surgeon.length < 4) return App.ui.toast('اكتب اسم الجراح', 'err');
      App.run('addCase', { procedure: t.name, set: t.set + ' #1', customerId: cust.id, surgeon, date: U.iso(m.$('[name="date"]').value), mrn: m.$('[name="mrn"]').value.trim() || undefined, items: t.items.map(([pid, q]) => ({ productId: pid, qty: q })) },
        (cs) => `العملية ${cs.no} اتجدولت`).then((cs) => cs && m.close());
    };
  }

  /* =============== Sales orders =============== */
  const of = { status: 'all', q: '', rep: 'all' };
  App.pages.orders = {
    title: 'أوامر البيع',
    render() {
      const isAdmin = S.me().role === 'admin', canIssue = S.can('movements', 2), actCol = isAdmin || canIssue;
      const mine = S.state.orders.filter(myFilter());
      const list = mine.filter((o) => (of.status === 'all' || o.status === of.status) && (of.rep === 'all' || o.repId === of.rep) && U.match(of.q, o.no, S.customer(o.customerId).name, S.rep(o.repId).name)).sort((a, b) => b.date.localeCompare(a.date));
      const now = new Date();
      const month = mine.filter((o) => new Date(o.date).getMonth() === now.getMonth() && new Date(o.date).getFullYear() === now.getFullYear() && o.status !== 'cancelled');
      const by = (s) => mine.filter((o) => o.status === s);
      const shown = list.slice(0, 60);
      return `${App.pageHead('أوامر البيع', S.myRepId() ? 'أوامر البيع بتاعة مستشفياتك' : 'كل أوامر البيع من المناديب — مع دورة اعتماد',
        `<button class="btn" data-a="export">${I('download', 17)} تصدير</button>${S.can('orders', 2) ? `<button class="btn primary" data-a="new">${I('plus', 17)} أمر بيع جديد</button>` : ''}`)}
        <div class="grid g-4">
          ${App.kpi({ icon: 'cart', tint: 'tint-primary', label: 'مبيعات الشهر الحالي', value: U.money(U.sum(month, S.orderTotal)), foot: `${month.length} أمر بيع` })}
          ${App.kpi({ icon: 'clock', tint: 'tint-warning', label: 'مستني الاعتماد', value: by('pending').length, foot: U.moneyTxt(U.sum(by('pending'), S.orderTotal)) })}
          ${App.kpi({ icon: 'checkCircle', tint: 'tint-info', label: 'معتمد — لسه ما اتسلّمش', value: by('approved').length, foot: U.moneyTxt(U.sum(by('approved'), S.orderTotal)) })}
          ${App.kpi({ icon: 'truck', tint: 'tint-success', label: 'اتسلّم (آخر 12 شهر)', value: by('delivered').length, foot: U.moneyTxt(U.sum(by('delivered'), S.orderTotal)) })}
        </div>
        <div class="card mt"><div class="toolbar"><div class="input-icon">${I('search', 17)}<input class="input" data-f="q" placeholder="رقم الأمر أو المستشفى أو المندوب…" value="${U.esc(of.q)}"></div>
          ${!S.myRepId() ? `<select class="select" data-f="rep" style="width:auto"><option value="all">كل المناديب</option>${S.state.reps.map((r) => `<option value="${r.id}" ${of.rep === r.id ? 'selected' : ''}>${U.esc(r.name)}</option>`).join('')}</select>` : ''}<div class="grow"></div>
          <div class="seg"><button class="${of.status === 'all' ? 'on' : ''}" data-st="all">الكل</button>${Object.entries(OS).map(([k, s]) => `<button class="${of.status === k ? 'on' : ''}" data-st="${k}">${s.name}${k === 'pending' && by('pending').length ? ` <span class="badge b-warning plain" style="padding:0 6px">${by('pending').length}</span>` : ''}</button>`).join('')}</div></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>رقم الأمر</th><th>التاريخ</th><th>المستشفى</th><th>المندوب</th><th>الأصناف</th><th class="num">الإجمالي</th><th>الحالة</th>${actCol ? '<th></th>' : ''}</tr></thead><tbody>
            ${shown.map((o) => `<tr class="click" data-o="${o.id}"><td class="mono nowrap"><b>${o.no}</b></td><td class="small nowrap">${U.date(o.date)}</td><td class="small">${U.esc(S.customer(o.customerId).name)}</td><td><div class="row" style="gap:8px">${U.avatar(S.rep(o.repId).name, 'sm')}<span class="small nowrap">${U.esc(S.rep(o.repId).name)}</span></div></td>
              <td class="small">${o.lines.map((l) => U.esc(S.product(l.productId).shortAr) + ' ×' + l.qty).join('، ')}</td><td class="num"><b>${U.num(S.orderTotal(o))}</b></td><td><div class="stack" style="gap:4px;align-items:flex-start">${App.badge(OS[o.status].badge, OS[o.status].name)}${o.status === 'approved' ? `<span class="badge plain ${o.issuedMovementId ? 'b-success' : 'b-muted'}">${o.issuedMovementId ? 'اتصرف — مستني التسليم' : 'مستني صرف المخزن'}</span>` : ''}</div></td>
              ${actCol ? `<td class="nowrap">${isAdmin && o.status === 'pending' ? `<button class="btn sm" data-approve="${o.id}">${I('check', 14)} اعتماد</button>` : o.status === 'approved' ? (o.issuedMovementId ? (isAdmin ? `<button class="btn sm" data-deliver="${o.id}">${I('truck', 14)} تسليم</button>` : '<span class="badge plain b-success">اتصرف</span>') : canIssue ? `<button class="btn sm" data-issue="${o.id}">${I('out', 14)} صرف</button>` : '<span class="badge plain b-muted">مستني المخزن</span>') : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>
          <div class="table-foot"><span>عرض ${shown.length} من ${list.length} أمر</span><span>الإجمالي: <b>${U.moneyTxt(U.sum(list.filter((o) => o.status !== 'cancelled'), S.orderTotal))}</b></span></div></div>`;
    },
    mount(el, r) {
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { of.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      const rs = el.querySelector('[data-f="rep"]'); if (rs) rs.onchange = (e) => { of.rep = e.target.value; App.refresh(); };
      el.addEventListener('click', (e) => {
        const ap = e.target.closest('[data-approve]'); if (ap) { e.stopPropagation(); App.run('setOrderStatus', { id: ap.dataset.approve, status: 'approved' }, 'أمر البيع اتعتمد'); return; }
        const is = e.target.closest('[data-issue]'); if (is) { e.stopPropagation(); issue(is.dataset.issue); return; }
        const dv = e.target.closest('[data-deliver]'); if (dv) { e.stopPropagation(); App.run('setOrderStatus', { id: dv.dataset.deliver, status: 'delivered' }, 'التسليم اتسجّل'); return; }
        const s = e.target.closest('[data-st]'); if (s) { of.status = s.dataset.st; App.refresh(); return; }
        const o = e.target.closest('[data-o]'); if (o) openOrder(o.dataset.o);
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'new') newOrder();
        if (a === 'export') { U.csv('life-medx-orders.csv', [['رقم الأمر', 'التاريخ', 'المستشفى', 'المندوب', 'الإجمالي', 'الحالة'], ...S.state.orders.filter(myFilter()).map((x) => [x.no, x.date.slice(0, 10), S.customer(x.customerId).name, S.rep(x.repId).name, S.orderTotal(x), OS[x.status].name])]); App.ui.toast('اتصدّر الملف'); }
      });
      if (r.query.get('new') && S.can('orders', 2)) { history.replaceState(null, '', '#/orders'); newOrder(); }
    },
  };

  function openOrder(id) {
    const o = S.state.orders.find((x) => x.id === id);
    const isAdmin = S.me().role === 'admin';
    // issue (warehouse) and delivery (admin) are two separate steps
    const steps = ['draft', 'pending', 'approved', 'issued', 'delivered'];
    const stepName = (k) => (k === 'issued' ? 'اتصرف من المخزن' : OS[k].name);
    const idx = o.status === 'delivered' ? 4 : o.status === 'approved' && o.issuedMovementId ? 3 : steps.indexOf(o.status);
    const d = App.ui.drawer({
      title: `أمر بيع <span class="mono muted" style="font-size:14px">${o.no}</span>`, icon: 'cart', iconTint: 'tint-accent',
      body: `<div class="row wrap">${App.badge(OS[o.status].badge, OS[o.status].name)}${o.note ? `<span class="badge plain b-primary">${U.esc(o.note)}</span>` : ''}</div>
        ${o.status !== 'cancelled' ? `<div class="row" style="margin:18px 0 4px;gap:6px">${steps.map((s, i) => `<div class="grow"><div style="height:6px;border-radius:6px;background:${i <= idx ? 'var(--primary)' : 'var(--surface-3)'}"></div><div class="small ${i <= idx ? '' : 'muted'}" style="margin-top:6px">${stepName(s)}</div></div>`).join('')}</div>` : ''}
        <dl class="kv mt"><dt>المستشفى</dt><dd>${U.esc(S.customer(o.customerId).name)}</dd><dt>المندوب</dt><dd>${U.esc(S.rep(o.repId).name)}</dd><dt>التاريخ</dt><dd>${U.date(o.date)}</dd>${o.status === 'approved' || o.issuedMovementId ? `<dt>إذن الصرف</dt><dd>${o.issuedMovementId ? (() => { const mv = S.state.movements.find((x) => x.id === o.issuedMovementId); return mv ? `<a class="mono" href="javascript:void 0" data-mv="${mv.id}" style="color:var(--brand)">${mv.no}</a>` : '—'; })() : '<span class="muted">لسه ما اتصرفش من المخزن</span>'}</dd>` : ''}</dl>
        <div class="card table-wrap mt"><table class="table"><thead><tr><th>الصنف</th><th>الكمية</th><th class="num">السعر</th><th class="num">الإجمالي</th></tr></thead><tbody>
          ${o.lines.map((l) => { const p = S.product(l.productId); return `<tr><td><div class="prod-cell" style="min-width:180px">${App.prodThumb(p, 32)}<span class="t small">${U.esc(p.shortAr)}</span></div></td><td>${l.qty}</td><td class="num">${U.num(l.price)}</td><td class="num"><b>${U.num(l.qty * l.price)}</b></td></tr>`; }).join('')}</tbody></table></div>
        <div class="row between" style="margin-top:14px;font-size:16px"><span class="muted">الإجمالي</span><b>${U.moneyTxt(S.orderTotal(o))}</b></div>`,
      foot: `<button class="btn" data-close>إغلاق</button>${isAdmin && o.status === 'pending' ? `<button class="btn danger" data-s="cancelled">إلغاء الأمر</button><button class="btn primary" data-s="approved">${I('check', 17)} اعتماد</button>` : ''}${o.status === 'approved' && !o.issuedMovementId && S.can('movements', 2) ? `<button class="btn primary" data-issue>${I('out', 17)} جهّز واصرف من المخزن</button>` : ''}${isAdmin && o.status === 'approved' && o.issuedMovementId ? `<button class="btn primary" data-s="delivered">${I('truck', 17)} تسجيل التسليم</button>` : ''}${o.status === 'draft' && S.can('orders', 2) ? `<button class="btn primary" data-s="pending">إرسال للاعتماد</button>` : ''}`,
    });
    d.$$('[data-s]').forEach((b) => (b.onclick = () => App.run('setOrderStatus', { id: o.id, status: b.dataset.s }, `اتغيّرت الحالة: ${OS[b.dataset.s].name}`).then((r) => r && d.close())));
    const ib = d.$('[data-issue]'); if (ib) ib.onclick = () => { d.close(); issue(o.id); };
    const mvl = d.$('[data-mv]'); if (mvl) mvl.onclick = () => { d.close(); App.openMovement(mvl.dataset.mv); };
  }

  /** Post the issue voucher for an approved order (FEFO from the main warehouse); shows the lots first. */
  function issue(id) {
    const o = S.state.orders.find((x) => x.id === id);
    const rows = o.lines.flatMap((l) => { const p = S.product(l.productId), plan = S.allocate(l.productId, 'W1', l.qty); return [...plan.alloc.map((a) => `<li><b>${U.esc(p.shortAr)}</b> × ${a.qty} — تشغيلة <span class="mono">${a.lot}</span> · تنتهي ${U.date(a.expiry)} · ${U.esc(a.location || '')}</li>`), ...(plan.missing ? [`<li style="color:var(--danger)"><b>${U.esc(p.shortAr)}</b>: ناقص ${plan.missing}</li>`] : [])]; }).join('');
    App.ui.confirm('صرف أمر البيع من المخزن', `هيتعمل إذن صرف من المخزن الرئيسي للأمر <b>${o.no}</b> بالتشغيلات دي (الأقرب انتهاءً أولاً):<ul style="margin:10px 0 0;padding-inline-start:18px;line-height:1.9">${rows}</ul>`, 'اصرف').then((ok) => ok && App.run('issueOrder', { id }, (r) => `اتصرف بإذن ${r.movement.no}`));
  }

  /** New sales order (Medica sheet): hospital, repeat last order, steppers with live availability, swipe to send for approval.
      Prices shown come from the contract / price list; the backend recalculates them anyway. */
  function newOrder(presetCust) {
    const st = S.state, rep = S.myRepId();
    const custs = st.customers.filter((c) => !rep || c.rep === rep);
    if (!custs.length) return App.ui.toast('مفيش مستشفيات مسجلة باسمك', 'err');
    const prods = st.products.filter((p) => p.category !== 'power');
    const q = {};
    let cid = custs.some((c) => c.id === presetCust) ? presetCust : custs[0].id, find = '', sent = false;
    // usable (non-expired) stock in the main warehouse that isn't already booked for scheduled surgeries
    const avail = (pid) => Math.max(0, U.sum(S.allocate(pid, 'W1', 1e9).alloc, (a) => a.qty) - S.reserved(pid));
    const total = () => U.sum(Object.entries(q), ([pid, n]) => n * S.priceFor(pid, cid));
    const units = () => U.sum(Object.values(q));
    const lastOrder = () => st.orders.filter((o) => o.customerId === cid && o.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date))[0];
    const isContract = (pid) => st.contracts.some((c) => c.customerId === cid && c.productId === pid);
    const chip = (pid) => { const a = avail(pid), n = q[pid] || 0; return a === 0 ? '<span class="chipx r">خلصان</span>' : a < n ? `<span class="chipx w">موجود ${a} بس</span>` : `<span class="chipx g">متوفر ${a}</span>`; };
    const m = App.ui.modal({ title: 'طلب جديد', icon: 'cart', iconTint: 'tint-accent', body: '<div data-sb></div>' });
    const sb = m.$('[data-sb]');

    const items = () => prods.filter((p) => U.match(find, p.shortAr, p.nameAr, p.nameEn, p.sku, p.barcode)).map((p) => `<li data-pid="${p.id}"><div style="min-width:0;flex:1"><div class="n">${U.esc(p.shortAr)}</div>
      <div class="m"><span class="num">${U.num(S.priceFor(p.id, cid))} ج.م / ${U.esc(p.unit)}</span>${isContract(p.id) ? '<span class="chipx b">سعر تعاقد</span>' : ''}<span data-chip>${chip(p.id)}</span></div></div>
      <div class="stp"><button data-qty="-" aria-label="أقل">${I('minus', 18)}</button><b class="num" data-n>${q[p.id] || 0}</b><button data-qty="+" aria-label="أكتر">${I('plus', 18)}</button></div></li>`).join('') || `<li><div class="empty" style="padding:20px;width:100%">مفيش صنف بالاسم ده</div></li>`;
    const lastBox = () => { const lo = lastOrder(); return lo ? `<div class="last"><div><b>آخر طلب للمستشفى ده</b>${U.ago(lo.date)} · ${lo.lines.length} أصناف · ${U.moneyTxt(S.orderTotal(lo))}</div><button data-re>${I('repeat', 16)} كرّره</button></div>` : ''; };
    function draw() {
      sb.innerHTML = `<div class="field"><label>المستشفى</label><select class="select" name="cust">${custs.map((c) => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}</select></div>
        <div data-last style="margin-top:12px">${lastBox()}</div>
        <div class="input-icon" style="margin:4px 0 6px">${I('search', 17)}<input class="input" data-find placeholder="ابحث عن صنف أو امسح الباركود…" value="${U.esc(find)}"></div>
        <ul class="items" data-items>${items()}</ul>
        <div class="tot"><span>الإجمالي · <span data-units>${units()}</span> قطعة</span><b class="num"><span data-tot>${U.num(total())}</span> ج.م</b></div>
        <div class="slider${total() > 0 ? '' : ' dis'}" data-slider><span class="fill"></span><span class="lbl">اسحب عشان تبعت الطلب للاعتماد</span><button class="knob" aria-label="ابعت الطلب للاعتماد">${I('arrowL', 22, 2.2)}</button></div>
        <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" data-draft>${I('file', 15)} احفظه مسودة</button></div>`;
      bindSlider();
    }
    function upd() {
      sb.querySelectorAll('.items li[data-pid]').forEach((li) => {
        const pid = li.dataset.pid, b = li.querySelector('[data-n]');
        if (b._v !== (q[pid] || 0)) { b._v = q[pid] || 0; App.odo(b, b._v); }
        li.querySelector('[data-chip]').innerHTML = chip(pid);
      });
      App.odo(sb.querySelector('[data-tot]'), total());
      sb.querySelector('[data-units]').textContent = units();
      sb.querySelector('[data-slider]').classList.toggle('dis', total() <= 0);
    }
    function bindSlider() {
      const s = sb.querySelector('[data-slider]'), k = s.querySelector('.knob'), fill = s.querySelector('.fill');
      let sx = null, dx = 0, max = 0;
      k.addEventListener('pointerdown', (e) => { if (s.classList.contains('dis')) return; sx = e.clientX; max = s.clientWidth - 62; s.classList.add('drag'); k.setPointerCapture(e.pointerId); });
      k.addEventListener('pointermove', (e) => { if (sx == null) return; dx = Math.max(0, Math.min(max, sx - e.clientX)); k.style.transform = `translateX(${-dx}px)`; fill.style.width = `${62 + dx}px`; });
      const end = () => {
        if (sx == null) return;
        s.classList.remove('drag'); sx = null;
        if (dx > max * 0.82) { k.style.transform = `translateX(${-max}px)`; fill.style.width = '100%'; setTimeout(() => send('pending'), 260); }
        else { if (dx < 4) { k.style.transform = 'translateX(-34px)'; setTimeout(() => { k.style.transform = ''; }, 260); } else k.style.transform = ''; fill.style.width = ''; }
        dx = 0;
      };
      k.addEventListener('pointerup', end); k.addEventListener('pointercancel', end);
      k.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !s.classList.contains('dis')) { e.preventDefault(); send('pending'); } });
    }
    async function send(status) {
      if (sent) return;
      const lines = Object.entries(q).filter(([, n]) => n > 0).map(([productId, qty]) => ({ productId, qty }));
      if (!lines.length) return App.ui.toast('زوّد صنف واحد على الأقل', 'err');
      sent = true;
      let so;
      try { so = await S.act('addOrder', { customerId: cid, status, lines }); } catch (e) { sent = false; App.ui.toast(e.message, 'err'); draw(); return; }
      App.refresh();
      const hv = document.querySelector('.home .hero .hl-v [data-v]');
      if (hv && status === 'pending' && S.me().role === 'sales') setTimeout(() => App.floatUp(hv, `+${U.num(S.orderTotal(so))}`), 400);
      m.$('.modal-head h3').textContent = '';
      sb.innerHTML = `<div class="done"><div class="okc"><span class="wave"></span><span class="wave w2"></span><span class="core">${I('check', 34, 3)}</span><span class="conf">${App.confetti()}</span></div>
        <h4>${status === 'draft' ? 'اتحفظ كمسودة' : 'الطلب اتبعت للاعتماد'}</h4><div class="amount num">${U.num(S.orderTotal(so))}<small>ج.م</small></div>
        <p><span class="mono">${so.no}</span> · ${U.esc(S.customer(cid).name)}<br>${status === 'draft' ? 'تقدر تكمّله وتبعته من أوامر البيع' : 'المدير يعتمده، وبعدها المخزن يجهّزه بالتشغيلات الأقرب انتهاءً'}</p><button class="pbtn brand" data-close>تمام</button></div>`;
    }
    sb.addEventListener('click', (e) => {
      const b = e.target.closest('[data-qty]');
      if (b) { const pid = b.closest('li').dataset.pid; q[pid] = Math.max(0, (q[pid] || 0) + (b.dataset.qty === '+' ? 1 : -1)); if (!q[pid]) delete q[pid]; return upd(); }
      if (e.target.closest('[data-re]')) {
        const lo = lastOrder(), short = [];
        Object.keys(q).forEach((k) => delete q[k]);
        lo.lines.forEach((l) => { const a = avail(l.productId), n = Math.min(l.qty, a); if (n > 0) q[l.productId] = (q[l.productId] || 0) + n; if (a < l.qty) short.push(S.product(l.productId).shortAr); });
        upd();
        if (short.length) App.ui.toast('كرّرنا الطلب بالموجود بس', 'warn', `${short.join(' و ')} مش كفاية في المخزن`); else App.ui.toast('كرّرنا آخر طلب', 'ok', `${lo.lines.length} أصناف`);
        return;
      }
      if (e.target.closest('[data-draft]')) send('draft');
    });
    sb.addEventListener('change', (e) => { if (e.target.name === 'cust') { cid = e.target.value; draw(); } });
    sb.addEventListener('input', U.debounce((e) => {
      if (e.target.dataset.find === undefined) return;
      find = e.target.value;
      const exact = prods.find((p) => p.barcode === find.trim());
      if (exact) { q[exact.id] = (q[exact.id] || 0) + 1; find = ''; e.target.value = ''; App.ui.toast(`اتضاف ${exact.shortAr}`, 'ok'); }
      sb.querySelector('[data-items]').innerHTML = items();
      upd();
    }, 150));
    draw();
  }
  App.newOrder = newOrder;
  App.openOrder = (id) => openOrder(id);

  /* =============== Customers =============== */
  const cuf = { q: '', type: 'all' };
  const custSales = (cid) => U.sum(S.state.orders.filter((o) => o.customerId === cid && o.status !== 'cancelled' && o.status !== 'draft'), S.orderTotal);
  App.pages.customers = {
    title: 'المستشفيات والعملاء',
    render() {
      const all = S.state.customers.filter(myFilter('rep'));
      const types = [...new Set(all.map((c) => c.type))];
      const list = all.filter((c) => (cuf.type === 'all' || c.type === cuf.type) && U.match(cuf.q, c.name, c.city));
      const max = Math.max(...all.map((c) => custSales(c.id)), 1);
      return `${App.pageHead('المستشفيات والعملاء', `${all.length} مستشفى — حكومي وجامعي وخاص وتأمين صحي`, `<div class="input-icon" style="width:260px">${I('search', 17)}<input class="input" data-f="q" placeholder="ابحث باسم المستشفى أو المدينة…" value="${U.esc(cuf.q)}"></div>`)}
        <div class="seg" style="margin-bottom:16px"><button class="${cuf.type === 'all' ? 'on' : ''}" data-ty="all">الكل</button>${types.map((t) => `<button class="${cuf.type === t ? 'on' : ''}" data-ty="${t}">${t}</button>`).join('')}</div>
        <div class="grid g-3">${list.map((c) => { const v = custSales(c.id); const cases = S.state.cases.filter((x) => x.customerId === c.id).length; return `<div class="card" style="padding:18px;cursor:pointer" data-cust="${c.id}">
          <div class="row between"><span class="k-ic tint-primary" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${I('hospital', 22)}</span><div class="row" style="gap:6px">${c.contract ? '<span class="badge plain b-accent">تعاقد سنوي</span>' : ''}<span class="badge plain b-muted">${c.type}</span></div></div>
          <div style="font-weight:700;margin-top:12px;line-height:1.4">${U.esc(c.name)}</div><div class="small muted row" style="gap:4px;margin-top:2px">${I('pin', 13)} ${c.city} · ${c.contact}</div>
          <div class="row between" style="margin-top:14px"><span class="small muted">المبيعات (12 شهر)</span><b>${U.moneyTxt(v)}</b></div><div class="progress" style="margin-top:6px"><i style="width:${(v / max) * 100}%"></i></div>
          <div class="row between" style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)"><div class="row" style="gap:6px">${U.avatar(S.rep(c.rep).name, 'sm')}<span class="small">${U.esc(S.rep(c.rep).name)}</span></div><span class="small muted">${cases} عمليات</span></div></div>`; }).join('')}</div>`;
    },
    mount(el) {
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { cuf.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      el.addEventListener('click', (e) => { const t = e.target.closest('[data-ty]'); if (t) { cuf.type = t.dataset.ty; App.refresh(); return; } const c = e.target.closest('[data-cust]'); if (c) App.openCustomer(c.dataset.cust); });
    },
  };

  App.openCustomer = (id) => {
    const c = S.customer(id);
    const ms = App.monthlySales((o) => o.customerId === id);
    const orders = S.state.orders.filter((o) => o.customerId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const contract = S.state.contracts.filter((x) => x.customerId === id);
    const cases = S.state.cases.filter((x) => x.customerId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    App.ui.drawer({
      title: U.esc(c.name), icon: 'hospital',
      body: `<div class="row wrap"><span class="badge plain b-muted">${c.type}</span><span class="badge plain b-muted">${c.city}</span>${c.discount ? `<span class="badge plain b-success">خصم ${c.discount}% على سعر القائمة</span>` : ''}</div>
        <dl class="kv mt"><dt>المندوب المسؤول</dt><dd>${U.esc(S.rep(c.rep).name)}</dd><dt>جهة التواصل</dt><dd>${c.contact}</dd><dt>الهاتف</dt><dd class="ltr" style="text-align:right">${c.phone}</dd><dt>إجمالي المبيعات</dt><dd><b>${U.moneyTxt(U.sum(ms.total))}</b> — آخر 12 شهر</dd></dl>
        ${contract.length ? `<div class="section-title">${I('tag', 16)} قائمة أسعار التعاقد — من ملف المستشفى</div>
          <div class="card table-wrap"><table class="table"><thead><tr><th>البند</th><th class="num">2025</th><th class="num">2026</th><th>التغير</th></tr></thead><tbody>
          ${contract.map((x) => { const ch = x.p2026 ? Math.round(((x.p2026 - x.p2025) / x.p2025) * 100) : null; return `<tr><td class="small" style="line-height:1.5">${U.esc(x.name)}</td><td class="num">${U.num(x.p2025)}</td><td class="num">${x.p2026 ? `<b>${U.num(x.p2026)}</b>` : '<span class="badge b-warning">لسه ما اتسعّرش</span>'}</td><td>${ch !== null ? `<span class="trend ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch}%</span>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>
          <div class="small muted" style="margin-top:6px">أسعار 2025 تشمل الأسمنت، وأسعار 2026 بدونه حسب الملف.</div>` : ''}
        <div class="section-title">${I('chart', 16)} المبيعات الشهرية</div><div class="card" style="padding:10px">${C.area({ labels: ms.labels, values: ms.total, height: 200 })}</div>
        ${cases.length ? `<div class="section-title">${I('pulse', 16)} آخر العمليات</div><div class="list">${cases.map(App.caseItem).join('')}</div>` : ''}
        <div class="section-title">${I('cart', 16)} آخر أوامر البيع</div><div class="list">${orders.map((o) => `<div class="list-item"><span class="li-ic tint-accent">${I('cart', 16)}</span><div class="grow"><div class="li-t mono small">${o.no}</div><div class="li-s">${U.date(o.date)}</div></div><div class="stack" style="align-items:flex-end"><b>${U.moneyTxt(S.orderTotal(o))}</b>${App.badge(OS[o.status].badge, OS[o.status].name)}</div></div>`).join('')}</div>`,
      onMount(m) { m.el.addEventListener('click', (e) => { const x = e.target.closest('[data-case]'); if (x) { m.close(); App.openCase(x.dataset.case); } }); },
    });
  };

  /* =============== Reps =============== */
  App.pages.reps = {
    title: 'المناديب',
    render() {
      const reps = S.state.reps.map((r) => ({ r, v: App.repMonth(r.id) })).sort((a, b) => b.v / b.r.target - a.v / a.r.target);
      const totalT = U.sum(reps, (x) => x.r.target), totalV = U.sum(reps, (x) => x.v);
      const me = S.myRepId();
      return `${App.pageHead('مناديب المبيعات', 'التارجت والإنجاز والعهدة لكل مندوب — الشهر الحالي')}
        <div class="grid g-4">
          ${App.kpi({ icon: 'target', tint: 'tint-primary', label: 'تارجت الفريق', value: U.money(totalT), foot: `${reps.length} مناديب` })}
          ${App.kpi({ icon: 'up', tint: 'tint-success', label: 'اللي اتحقق لحد دلوقتي', value: U.money(totalV), foot: `${Math.round((totalV / totalT) * 100)}% من التارجت` })}
          ${App.kpi({ icon: 'pulse', tint: 'tint-violet', label: 'أطقم بالعهدة', value: S.state.cases.filter((c) => c.status === 'issued').length, foot: 'اتصرفت ولسه ما اتسوّتش' })}
          ${App.kpi({ icon: 'sparkles', tint: 'tint-warning', label: 'الأعلى إنجازاً', value: U.esc(reps[0].r.name.split(' ')[0]), foot: `${Math.round((reps[0].v / reps[0].r.target) * 100)}% من التارجت` })}
        </div>
        <div class="grid g-3 mt">${reps.map(({ r, v }, i) => { const pct = (v / r.target) * 100; const cust = S.state.customers.filter((c) => c.rep === r.id).length; const custody = S.state.cases.filter((c) => c.repId === r.id && c.status === 'issued').length; const cases = S.state.cases.filter((c) => c.repId === r.id && c.status === 'scheduled').length; return `<div class="card rep-card spot" style="cursor:pointer;${me === r.id ? 'border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-50)' : ''}" data-rep="${r.id}">
          <div class="rep-top">${U.avatar(r.name, 'lg')}<div class="grow"><div class="row" style="gap:8px"><b style="font-size:15px">${U.esc(r.name)}</b>${i < 3 ? `<span class="badge plain ${['b-warning', 'b-muted', 'b-danger'][i]}">#${i + 1}</span>` : ''}${me === r.id ? '<span class="badge plain b-primary">أنت</span>' : ''}</div><div class="small muted">${U.esc(r.region)}</div></div>${C.ring(pct, 62, pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : 'var(--warning)')}</div>
          <div class="row between" style="margin-top:14px"><span class="small muted">المحقق</span><span class="small"><b>${U.moneyTxt(v)}</b> <span class="muted">/ ${U.compact(r.target)}</span></span></div>
          <div class="rep-stats"><div class="rep-stat"><div class="v">${cust}</div><div class="l">مستشفى</div></div><div class="rep-stat"><div class="v">${cases}</div><div class="l">عمليات قادمة</div></div><div class="rep-stat"><div class="v">${custody}</div><div class="l">أطقم بالعهدة</div></div></div></div>`; }).join('')}</div>`;
    },
    mount(el) { el.addEventListener('click', (e) => { const r = e.target.closest('[data-rep]'); if (r) openRep(r.dataset.rep); }); },
  };

  function openRep(id) {
    const r = S.rep(id);
    const ms = App.monthlySales((o) => o.repId === id);
    const custody = S.state.cases.filter((c) => c.repId === id && c.status === 'issued');
    const items = U.groupBy(custody.flatMap((c) => c.items), (i) => i.productId);
    App.ui.drawer({
      title: U.esc(r.name), icon: 'user', iconTint: 'tint-warning',
      body: `<dl class="kv"><dt>المنطقة</dt><dd>${U.esc(r.region)}</dd><dt>الهاتف</dt><dd class="ltr" style="text-align:right">${r.phone}</dd><dt>التارجت الشهري</dt><dd>${U.moneyTxt(r.target)}</dd><dt>اللي اتحقق الشهر ده</dt><dd><b>${U.moneyTxt(App.repMonth(id))}</b></dd></dl>
        <div class="section-title">${I('chart', 16)} المبيعات — آخر 12 شهر</div><div class="card" style="padding:10px">${C.bars({ labels: ms.labels, series: [{ name: 'المبيعات', values: ms.total, color: 'var(--chart-2)' }], height: 220 })}</div>
        <div class="section-title">${I('briefcase', 16)} العهدة الحالية</div>${Object.keys(items).length ? `<div class="list">${Object.entries(items).map(([pid, arr]) => { const p = S.product(pid); return `<div class="list-item">${App.prodThumb(p, 34)}<div class="grow li-t small">${U.esc(p.shortAr)}</div><b>× ${U.sum(arr, (x) => x.qty)}</b></div>`; }).join('')}</div>` : '<div class="muted small">مفيش عهدة دلوقتي</div>'}
        <div class="section-title">${I('hospital', 16)} المستشفيات</div><div class="list">${S.state.customers.filter((c) => c.rep === id).map((c) => `<div class="list-item"><span class="li-ic tint-primary">${I('hospital', 16)}</span><div class="grow"><div class="li-t small">${U.esc(c.name)}</div><div class="li-s">${c.city}</div></div><b class="small">${U.moneyTxt(custSales(c.id))}</b></div>`).join('')}</div>`,
    });
  }
})(window.App);
