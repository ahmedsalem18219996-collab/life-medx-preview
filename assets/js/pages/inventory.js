/* Warehouse screens: products, inventory & lots, stock movements, barcode labels. */
(function (App) {
  'use strict';
  const U = App.util, S = App.store, I = App.icon, M = App.meta;
  const CAT = M.CATEGORIES;

  const expiryBadge = (lot) => {
    const d = S.daysToExpiry(lot);
    const cls = d <= 0 ? 'b-danger' : d <= S.state.settings.expiryWarnDays ? 'b-danger' : d <= 365 ? 'b-warning' : 'b-success';
    return App.badge(cls, d <= 0 ? 'منتهية' : d > 365 ? `${(d / 365).toFixed(1)} سنة` : `${d} يوم`);
  };
  const stockCell = (p) => {
    const q = S.stock(p.id), st = S.stockStatus(p);
    const pct = Math.min(100, (q / (p.minStock * 3)) * 100);
    return `<div class="stack" style="gap:5px"><span><b>${q}</b> <span class="muted small">${p.unit}</span></span><span class="stock-bar"><i style="width:${pct}%;background:${st.color}"></i></span></div>`;
  };

  /* =============== Products =============== */
  const pf = { q: '', cat: 'all', status: 'all', view: 'table' };
  App.pages.products = {
    title: 'الأصناف',
    render() {
      const all = S.state.products;
      const list = all.filter((p) => (pf.cat === 'all' || p.category === pf.cat) && (pf.status === 'all' || S.stockStatus(p).key === pf.status) && U.match(pf.q, p.nameAr, p.shortAr, p.nameEn, p.barcode, p.sku, p.brand));
      const cats = Object.entries(CAT).map(([k, c]) => `<button class="${pf.cat === k ? 'on' : ''}" data-cat="${k}">${c.name} <span class="muted">${all.filter((p) => p.category === k).length}</span></button>`).join('');
      const body = !list.length ? `<div class="empty">${I('package', 40)}<div>مفيش أصناف بالبحث ده</div></div>` : pf.view === 'table' ? `<div class="table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>الباركود (GTIN)</th><th>الفئة</th><th>العلامة / المنشأ</th><th>الرصيد</th><th class="num">سعر البيع</th><th>الحالة</th></tr></thead><tbody>
        ${list.map((p) => { const st = S.stockStatus(p); return `<tr class="click" data-p="${p.id}"><td><div class="prod-cell">${App.prodThumb(p)}<div class="grow"><div class="t">${U.esc(p.shortAr)}</div><div class="s truncate" style="max-width:300px">${U.esc(p.nameEn)}</div></div></div></td>
          <td><span class="mono ltr">${p.barcode}</span></td><td><span class="badge plain b-muted">${CAT[p.category].name}</span></td><td><div class="stack" style="gap:0"><span class="small ltr nowrap" style="font-weight:600">${U.esc(p.brand)}</span><span class="small muted">${U.esc(p.origin === '—' ? 'مصر' : p.origin)}</span></div></td>
          <td>${stockCell(p)}</td><td class="num"><b>${U.num(p.price)}</b> <span class="muted small">ج.م</span></td><td>${App.badge(st.badge, st.name)}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="card-body"><div class="grid g-3">${list.map((p) => { const st = S.stockStatus(p); return `<div class="card" style="padding:16px;cursor:pointer" data-p="${p.id}"><div class="row between">${App.prodThumb(p, 46)}${App.badge(st.badge, st.name)}</div>
          <div style="font-weight:700;margin-top:12px;line-height:1.4">${U.esc(p.shortAr)}</div><div class="small muted ltr" style="text-align:right">${U.esc(p.nameEn)}</div>
          <div style="margin:12px -4px 4px" class="barcode-box">${App.barcode.svg(p.barcode, { module: 1.6, height: 40 })}</div>
          <div class="row between" style="margin-top:10px"><span>${stockCell(p)}</span><b>${U.moneyTxt(p.price)}</b></div></div>`; }).join('')}</div></div>`;
      return `${App.pageHead('الأصناف', `${all.length} صنف متسجّل بباركود GTIN — من ملف الأصناف`,
        `<button class="btn" data-a="export">${I('download', 17)} تصدير Excel</button>${S.can('products', 2) ? `<button class="btn primary" data-a="new">${I('plus', 17)} صنف جديد</button>` : ''}`)}
        <div class="card"><div class="toolbar"><div class="input-icon">${I('search', 17)}<input class="input" data-f="q" placeholder="ابحث بالاسم أو الباركود أو الكود…" value="${U.esc(pf.q)}"></div>
          <div class="seg"><button class="${pf.cat === 'all' ? 'on' : ''}" data-cat="all">الكل <span class="muted">${all.length}</span></button>${cats}</div>
          <div class="grow"></div>
          <select class="select" data-f="status" style="width:auto"><option value="all">كل الحالات</option><option value="ok" ${pf.status === 'ok' ? 'selected' : ''}>متوفر</option><option value="low" ${pf.status === 'low' ? 'selected' : ''}>تحت حد الطلب</option><option value="out" ${pf.status === 'out' ? 'selected' : ''}>نفد المخزون</option></select>
          <div class="seg"><button class="${pf.view === 'table' ? 'on' : ''}" data-view="table" title="جدول">${I('menu', 16)}</button><button class="${pf.view === 'grid' ? 'on' : ''}" data-view="grid" title="بطاقات">${I('dashboard', 16)}</button></div></div>
          ${body}<div class="table-foot"><span>عرض ${list.length} من ${all.length} صنف</span><span>إجمالي قيمة البيع للمعروض: <b>${U.moneyTxt(U.sum(list, (p) => p.price * S.stock(p.id)))}</b></span></div></div>`;
    },
    mount(el) {
      const rerender = () => { const pos = el.querySelector('[data-f="q"]').selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); };
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { pf.q = e.target.value; rerender(); }, 200));
      el.querySelector('[data-f="status"]').onchange = (e) => { pf.status = e.target.value; App.refresh(); };
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]'); if (c) { pf.cat = c.dataset.cat; App.refresh(); return; }
        const v = e.target.closest('[data-view]'); if (v) { pf.view = v.dataset.view; App.refresh(); return; }
        const p = e.target.closest('[data-p]'); if (p) App.openProduct(p.dataset.p);
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'export') exportProducts();
        if (a === 'new') newProduct();
      });
    },
  };

  function exportProducts() {
    U.csv('life-medx-products.csv', [['الكود', 'الباركود', 'الاسم العربي', 'الاسم الإنجليزي', 'الفئة', 'العلامة', 'المنشأ', 'الوحدة', 'الرصيد', 'حد الطلب', 'سعر البيع', ...(S.seesCost() ? ['التكلفة'] : [])],
      ...S.state.products.map((p) => [p.sku, p.barcode, p.nameAr, p.nameEn, CAT[p.category].name, p.brand, p.origin, p.unit, S.stock(p.id), p.minStock, p.price, ...(S.seesCost() ? [p.cost] : [])])]);
    App.ui.toast('اتصدّر ملف الأصناف — بيفتح على Excel على طول');
  }

  function newProduct() {
    const m = App.ui.modal({
      title: 'إضافة صنف جديد', icon: 'package',
      body: `<div class="form-grid">
        <div class="field full"><label>الاسم العربي</label><input class="input" name="nameAr" placeholder="مثال: مفصل كتف صناعي كامل"></div>
        <div class="field"><label>الاسم المختصر</label><input class="input" name="shortAr"></div>
        <div class="field"><label>الاسم الإنجليزي</label><input class="input ltr" name="nameEn"></div>
        <div class="field"><label>الباركود GTIN (13 رقم)</label><input class="input mono ltr" name="barcode" maxlength="13" placeholder="200000000…"><span class="small" data-bc></span></div>
        <div class="field"><label>الفئة</label><select class="select" name="category">${Object.entries(CAT).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>سعر البيع (ج.م)</label><input class="input" type="number" name="price" value="0"></div>
        <div class="field"><label>حد الطلب</label><input class="input" type="number" name="minStock" value="5"></div>
        <div class="full" data-prev></div></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} حفظ الصنف</button>`,
      onMount(m) {
        const bc = m.$('[name="barcode"]');
        bc.oninput = () => {
          const v = bc.value.replace(/\D/g, ''); bc.value = v;
          if (v.length === 12) { m.$('[data-bc]').innerHTML = `<span class="muted">رقم التحقق المقترح: <b class="mono">${App.barcode.checkDigit(v)}</b></span>`; }
          else if (v.length === 13) { const ok = App.barcode.isValid(v); m.$('[data-bc]').innerHTML = ok ? '<span style="color:var(--success)">✓ باركود صالح</span>' : '<span style="color:var(--warning)">رقم التحقق غير مطابق لمعيار EAN-13</span>'; m.$('[data-prev]').innerHTML = `<div class="barcode-box">${App.barcode.svg(v)}</div>`; }
          else { m.$('[data-bc]').textContent = ''; m.$('[data-prev]').innerHTML = ''; }
        };
      },
    });
    m.$('[data-save]').onclick = () => {
      const f = Object.fromEntries(m.$$('[name]').map((i) => [i.name, i.value.trim()]));
      if (!f.nameAr || f.barcode.length !== 13) return App.ui.toast('اكتب الاسم وباركود من 13 رقم', 'err');
      if (S.state.products.some((p) => p.barcode === f.barcode)) return App.ui.toast('الباركود ده متسجّل على صنف تاني', 'err');
      App.run('addProduct', f, 'تمت إضافة الصنف').then((p) => p && m.close());
    };
  }

  /* product drawer */
  App.openProduct = (id) => {
    const p = S.product(id);
    const st = S.stockStatus(p);
    const total = S.stock(p.id), reserved = S.reserved(p.id);
    const lots = S.lotsOf(p.id).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const contract = S.state.contracts.filter((c) => c.productId === p.id);
    const moves = S.state.movements.filter((m) => m.lines.some((l) => l.productId === p.id)).slice(0, 6);
    const valid = App.barcode.isValid(p.barcode);
    App.ui.drawer({
      title: U.esc(p.shortAr), icon: CAT[p.category].icon, iconTint: CAT[p.category].tint,
      body: `<div style="font-weight:600;line-height:1.5">${U.esc(p.nameAr)}</div><div class="small muted ltr" style="text-align:right;margin-top:2px">${U.esc(p.nameEn)}</div>
        <div class="row wrap" style="margin-top:10px">${App.badge(st.badge, st.name)}<span class="badge plain b-muted">${CAT[p.category].name}</span><span class="badge plain b-primary">${p.tracking === 'serial' ? 'تتبع بالسيريال والتشغيلة' : 'تتبع بالتشغيلة'}</span></div>
        <div class="grid g-4 mt" style="gap:10px">${[['الرصيد الكلي', total], ['محجوز لعمليات', reserved], ['المتاح', Math.max(total - reserved, 0)], ['التشغيلات', lots.length]].map(([l, v]) => `<div class="rep-stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
        <div class="section-title">${I('barcode', 16)} الباركود</div>
        <div class="barcode-box">${App.barcode.svg(p.barcode, { module: 2.4, height: 70 })}<div class="row" style="margin-top:8px;gap:14px;font-size:12px;color:#334">${valid ? '<span style="color:#16a34a">✓ رقم تحقق صحيح (EAN-13)</span>' : '<span style="color:#d97706">⚠ رقم التحقق غير مطابق</span>'}<span>GTIN · ${p.sku}</span></div></div>
        <div class="section-title">${I('file', 16)} بيانات الصنف</div>
        <dl class="kv"><dt>كود الصنف</dt><dd class="mono">${p.sku}</dd><dt>العلامة التجارية</dt><dd><span class="ltr">${U.esc(p.brand)}</span></dd><dt>بلد المنشأ</dt><dd>${U.esc(p.origin === '—' ? 'مصر' : p.origin)}</dd><dt>وحدة القياس</dt><dd>${p.unit}</dd>
          <dt>سعر البيع</dt><dd>${U.moneyTxt(p.price)}</dd>${S.seesCost() ? `<dt>سعر التكلفة</dt><dd>${U.moneyTxt(p.cost)}</dd>` : ''}<dt>حد الطلب</dt><dd>${p.minStock} ${p.unit}</dd>
          <dt>الوصف الفني</dt><dd class="small ltr" style="text-align:right;line-height:1.6">${U.esc(p.descEn)}</dd></dl>
        <div class="section-title">${I('warehouse', 16)} الرصيد حسب المخزن</div>
        <div class="list">${S.state.warehouses.map((w) => `<div class="list-item"><span class="li-ic tint-accent">${I('warehouse', 16)}</span><div class="grow li-t">${U.esc(w.name)}</div><b>${S.stock(p.id, w.id)}</b></div>`).join('')}</div>
        <div class="section-title">${I('layers', 16)} التشغيلات (الأقرب انتهاءً أولاً)</div>
        ${lots.length ? `<div class="card table-wrap"><table class="table"><thead><tr><th>التشغيلة</th><th>المخزن</th><th>الموقع</th><th>الصلاحية</th><th>الكمية</th></tr></thead><tbody>${lots.map((l) => `<tr><td class="mono">${l.lot}</td><td class="small">${U.esc(S.warehouse(l.warehouseId).code)}</td><td class="mono small">${l.location}</td><td><div class="stack" style="gap:2px"><span class="small">${U.date(l.expiry)}</span>${expiryBadge(l)}</div></td><td><b>${l.qty}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="callout tint-danger">' + I('alert', 18) + ' مفيش رصيد دلوقتي — الأحسن تعمل طلب شراء.</div>'}
        ${contract.length ? `<div class="section-title">${I('tag', 16)} أسعار التعاقد</div><div class="card table-wrap"><table class="table"><thead><tr><th>المستشفى</th><th class="num">2025</th><th class="num">2026</th></tr></thead><tbody>${contract.map((c) => `<tr><td class="small">${U.esc(S.customer(c.customerId).name)}</td><td class="num">${U.num(c.p2025)}</td><td class="num">${c.p2026 ? `<b>${U.num(c.p2026)}</b>` : '<span class="badge b-warning">لسه ما اتسعّرش</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${moves.length ? `<div class="section-title">${I('history', 16)} آخر الحركات</div><div class="card table-wrap">${App.movementsTable(moves, p.id)}</div>` : ''}`,
      foot: `<a class="btn" href="#/barcodes?p=${p.id}" data-close>${I('printer', 17)} طباعة ملصقات</a>${S.can('movements', 2) ? `<a class="btn primary" href="#/movements?new=in&p=${p.id}" data-close>${I('in', 17)} استلام كمية</a>` : ''}`,
      onMount(m) { m.el.addEventListener('click', (e) => { const mv = e.target.closest('[data-mv]'); if (mv) App.openMovement(mv.dataset.mv); }); },
    });
  };

  /* =============== Inventory =============== */
  const inv = { tab: 'items', wh: 'all', q: '' };
  App.pages.inventory = {
    title: 'المخزون والتشغيلات',
    render() {
      const st = S.state;
      const whs = st.warehouses;
      const lotsAll = st.lots.filter((l) => l.qty > 0 && (inv.wh === 'all' || l.warehouseId === inv.wh));
      const exp = S.expiringLots();
      const kp = [
        App.kpi({ icon: 'layers', tint: 'tint-primary', label: 'إجمالي الوحدات', value: U.num(U.sum(lotsAll, (l) => l.qty)), foot: inv.wh === 'all' ? 'كل المخازن' : U.esc(S.warehouse(inv.wh).name) }),
        S.seesCost() ? App.kpi({ icon: 'wallet', tint: 'tint-accent', label: 'قيمة المخزون', value: U.money(U.sum(lotsAll, (l) => l.qty * S.product(l.productId).cost)), foot: 'بسعر التكلفة' })
          : App.kpi({ icon: 'package', tint: 'tint-accent', label: 'أصناف ليها رصيد', value: new Set(lotsAll.map((l) => l.productId)).size, foot: `من ${st.products.length} صنف` }),
        App.kpi({ icon: 'tag', tint: 'tint-violet', label: 'تشغيلات فيها رصيد', value: lotsAll.length, foot: `الصرف بنظام ${st.settings.issuePolicy} — الأقرب انتهاءً يخرج الأول` }),
        App.kpi({ icon: 'clock', tint: 'tint-danger', label: `تنتهي خلال ${st.settings.expiryWarnDays} يوم`, value: exp.length, foot: S.seesCost() ? U.moneyTxt(U.sum(exp, (l) => l.qty * S.product(l.productId).cost)) + ' معرّضة للخسارة' : `${U.num(U.sum(exp, (l) => l.qty))} وحدة لازم تتصرّف` }),
      ];
      let body;
      if (inv.tab === 'items') {
        const rows = st.products.filter((p) => U.match(inv.q, p.nameAr, p.shortAr, p.nameEn, p.barcode));
        body = `<div class="table-wrap"><table class="table"><thead><tr><th>الصنف</th>${whs.map((w) => `<th class="num">${w.code}</th>`).join('')}<th class="num">الإجمالي</th><th class="num">محجوز</th><th class="num">متاح</th><th>حد الطلب</th><th>الحالة</th></tr></thead><tbody>
          ${rows.map((p) => { const s = S.stockStatus(p); const t = S.stock(p.id), r = S.reserved(p.id); return `<tr class="click" data-p="${p.id}"><td><div class="prod-cell">${App.prodThumb(p, 36)}<div><div class="t">${U.esc(p.shortAr)}</div><div class="s mono">${p.barcode}</div></div></div></td>
            ${whs.map((w) => { const q = S.stock(p.id, w.id); return `<td class="num ${q ? '' : 'muted'}">${q || '—'}</td>`; }).join('')}<td class="num"><b>${t}</b></td><td class="num">${r || '—'}</td><td class="num" style="color:${t - r < 0 ? 'var(--danger)' : 'inherit'}"><b>${t - r}</b></td><td>${p.minStock}</td><td>${App.badge(s.badge, s.name)}</td></tr>`; }).join('')}</tbody></table></div>`;
      } else {
        const rows = lotsAll.filter((l) => { const p = S.product(l.productId); return U.match(inv.q, p.nameAr, p.shortAr, l.lot, p.barcode); }).sort((a, b) => a.expiry.localeCompare(b.expiry));
        body = `<div class="table-wrap"><table class="table"><thead><tr><th>رقم التشغيلة</th><th>الصنف</th><th>المخزن</th><th>موقع التخزين</th><th>تاريخ الاستلام</th><th>تاريخ الصلاحية</th><th>المتبقي</th><th class="num">الكمية</th></tr></thead><tbody>
          ${rows.map((l) => { const p = S.product(l.productId); const d = S.daysToExpiry(l); const pct = Math.max(4, Math.min(100, (d / 1095) * 100)); return `<tr class="click" data-p="${p.id}"><td class="mono"><b>${l.lot}</b></td><td><div class="prod-cell" style="min-width:200px">${App.prodThumb(p, 32)}<span class="t small">${U.esc(p.shortAr)}</span></div></td><td class="small">${U.esc(S.warehouse(l.warehouseId).name)}</td><td class="mono small">${l.location}</td><td class="small">${U.date(l.received)}</td>
            <td><div class="stack" style="gap:5px"><span class="small">${U.date(l.expiry)}</span><span class="stock-bar" style="width:110px"><i style="width:${pct}%;background:${d <= st.settings.expiryWarnDays ? 'var(--danger)' : d <= 365 ? 'var(--warning)' : 'var(--success)'}"></i></span></div></td><td>${expiryBadge(l)}</td><td class="num"><b>${l.qty}</b></td></tr>`; }).join('')}</tbody></table></div>`;
      }
      return `${App.pageHead('المخزون والتشغيلات', 'رصيد كل صنف في كل مخزن لحظة بلحظة، ومعاه التشغيلات وتواريخ الصلاحية',
        `<button class="btn" data-a="export">${I('download', 17)} تصدير الجرد</button>${S.can('movements', 2) ? `<a class="btn primary" href="#/movements?new=transfer">${I('swap', 17)} تحويل بين المخازن</a>` : ''}`)}
        <div class="grid g-4">${kp.join('')}</div>
        <div class="card mt"><div class="tabs"><button class="tab ${inv.tab === 'items' ? 'on' : ''}" data-tab="items">الأرصدة حسب الصنف</button><button class="tab ${inv.tab === 'lots' ? 'on' : ''}" data-tab="lots">التشغيلات والصلاحية <span class="badge b-danger plain">${exp.length}</span></button></div>
          <div class="toolbar"><div class="input-icon">${I('search', 17)}<input class="input" data-f="q" placeholder="${inv.tab === 'lots' ? 'ابحث برقم التشغيلة أو الصنف…' : 'ابحث بالصنف أو الباركود…'}" value="${U.esc(inv.q)}"></div><div class="grow"></div>
            <div class="seg"><button class="${inv.wh === 'all' ? 'on' : ''}" data-wh="all">كل المخازن</button>${whs.map((w) => `<button class="${inv.wh === w.id ? 'on' : ''}" data-wh="${w.id}">${U.esc(w.name.split('—')[0].trim())}</button>`).join('')}</div></div>
          ${body}</div>`;
    },
    mount(el) {
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { inv.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { inv.tab = t.dataset.tab; App.refresh(); return; }
        const w = e.target.closest('[data-wh]'); if (w) { inv.wh = w.dataset.wh; App.refresh(); return; }
        const p = e.target.closest('[data-p]'); if (p) App.openProduct(p.dataset.p);
        if (e.target.closest('[data-a="export"]')) {
          U.csv('life-medx-stock.csv', [['الصنف', 'الباركود', 'التشغيلة', 'المخزن', 'الموقع', 'الصلاحية', 'الكمية'], ...S.state.lots.filter((l) => l.qty > 0).map((l) => { const p = S.product(l.productId); return [p.shortAr, p.barcode, l.lot, S.warehouse(l.warehouseId).name, l.location, l.expiry, l.qty]; })]);
          App.ui.toast('اتصدّر ملف الجرد');
        }
      });
    },
  };

  /* =============== Movements =============== */
  App.movementsTable = (list, focusPid) => `<table class="table"><thead><tr><th>رقم الإذن</th><th>النوع</th><th>التاريخ</th><th>المخزن</th><th>الجهة</th><th>الأصناف</th><th>بواسطة</th></tr></thead><tbody>
    ${list.map((m) => { const t = M.MOVE_TYPES[m.type]; const units = U.sum(m.lines.filter((l) => !focusPid || l.productId === focusPid), (l) => l.qty); return `<tr class="click" data-mv="${m.id}"><td class="mono nowrap"><b>${m.no}</b></td><td>${App.badge(t.badge, t.name)}</td><td class="nowrap small">${U.date(m.date)}<div class="muted">${U.time(m.date)}</div></td>
      <td class="small nowrap">${S.warehouse(m.warehouseId).code}${m.toWarehouseId ? ` ← ${S.warehouse(m.toWarehouseId).code}` : ''}</td><td class="small" style="max-width:240px">${U.esc(m.party || (m.type === 'transfer' ? 'تحويل داخلي' : '—'))}</td>
      <td class="nowrap"><b>${units}</b> <span class="muted small">وحدة · ${m.lines.length} سطر</span></td><td><div class="row" style="gap:8px">${U.avatar(S.user(m.userId).name, 'sm')}<span class="small nowrap">${U.esc(S.user(m.userId).name)}</span></div></td></tr>`; }).join('')}</tbody></table>`;

  const mf = { type: 'all', q: '' };
  App.pages.movements = {
    title: 'حركات المخزن',
    render() {
      const all = S.state.movements;
      const list = all.filter((m) => (mf.type === 'all' || m.type === mf.type) && U.match(mf.q, m.no, m.party, ...m.lines.map((l) => S.product(l.productId).shortAr), ...m.lines.map((l) => l.lot)));
      const counts = U.groupBy(all, (m) => m.type);
      const canEdit = S.can('movements', 2);
      return `${App.pageHead('حركات المخزن', 'أذون الإضافة والصرف والتحويل والمرتجع — كل حركة مربوطة بالتشغيلة واللي عملها',
        canEdit ? Object.entries(M.MOVE_TYPES).filter(([, t]) => !t.own).map(([k, t]) => `<button class="btn ${k === 'in' ? 'primary' : ''}" data-new="${k}">${I(t.icon, 17)} ${t.name}</button>`).join('') + `<button class="btn danger" data-a="rts">${I('ret', 17)} مرتجع للمورد</button>` : '')}
        <div class="grid g-4">${Object.entries(M.MOVE_TYPES).filter(([, t]) => !t.own).map(([k, t]) => App.kpi({ icon: t.icon, tint: { in: 'tint-success', out: 'tint-accent', transfer: 'tint-violet', return: 'tint-warning' }[k], label: t.name, value: (counts[k] || []).length, foot: `${U.num(U.sum(counts[k] || [], (m) => U.sum(m.lines, (l) => l.qty)))} وحدة — آخر 75 يوم` })).join('')}</div>
        <div class="card mt"><div class="toolbar"><div class="input-icon">${I('search', 17)}<input class="input" data-f="q" placeholder="ابحث برقم الإذن أو الجهة أو الصنف أو التشغيلة…" value="${U.esc(mf.q)}"></div><div class="grow"></div>
          <div class="seg"><button class="${mf.type === 'all' ? 'on' : ''}" data-type="all">الكل</button>${Object.entries(M.MOVE_TYPES).map(([k, t]) => `<button class="${mf.type === k ? 'on' : ''}" data-type="${k}">${t.name}</button>`).join('')}</div></div>
          <div class="table-wrap">${list.length ? App.movementsTable(list) : `<div class="empty">${I('swap', 40)}<div>مفيش حركات</div></div>`}</div>
          <div class="table-foot"><span>${list.length} حركة</span></div></div>`;
    },
    mount(el, r) {
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { mf.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-type]'); if (t) { mf.type = t.dataset.type; App.refresh(); return; }
        const n = e.target.closest('[data-new]'); if (n) newMovement(n.dataset.new);
        if (e.target.closest('[data-a="rts"]')) App.supplierReturn();
        const mv = e.target.closest('[data-mv]'); if (mv) App.openMovement(mv.dataset.mv);
      });
      const q = r.query;
      if (q.get('new') && S.can('movements', 2)) { history.replaceState(null, '', '#/movements'); if (q.get('new') === 'rts') App.supplierReturn(); else newMovement(q.get('new'), q.get('p')); }
    },
  };

  /* new movement modal */
  function newMovement(type = 'in', presetPid) {
    const st = S.state;
    const lines = [];
    const camOK = !App.framed && 'BarcodeDetector' in window && navigator.mediaDevices;
    const m = App.ui.modal({
      title: 'إذن مخزني جديد', icon: M.MOVE_TYPES[type].icon, wide: true,
      body: `<div class="seg" data-types style="margin-bottom:16px">${Object.entries(M.MOVE_TYPES).filter(([, t]) => !t.own).map(([k, t]) => `<button class="${k === type ? 'on' : ''}" data-t="${k}">${I(t.icon, 15)} ${t.name}</button>`).join('')}</div>
        <div class="form-grid">
          <div class="field"><label data-whl>المخزن</label><select class="select" name="wh">${st.warehouses.map((w) => `<option value="${w.id}">${U.esc(w.name)}</option>`).join('')}</select></div>
          <div class="field" data-show="transfer"><label>إلى المخزن</label><select class="select" name="to">${st.warehouses.map((w, i) => `<option value="${w.id}" ${i === 1 ? 'selected' : ''}>${U.esc(w.name)}</option>`).join('')}</select></div>
          <div class="field" data-show="in"><label>المورد</label><input class="input" name="supplier" list="suppliers" value="DemoOrtho Supplies — Demo"><datalist id="suppliers"><option>DemoOrtho Supplies — Demo</option><option>DemoMed Supplies — Demo</option><option>مصنع تجريبي — مدينة تجريبية</option></datalist></div>
          <div class="field" data-show="out return"><label>المستشفى / العميل</label><select class="select" name="cust">${st.customers.map((c) => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</select></div>
          <div class="field" data-show="out return"><label>المندوب المسؤول</label><select class="select" name="rep">${st.reps.map((r) => `<option value="${r.id}">${U.esc(r.name)}</option>`).join('')}</select></div>
        </div>
        <div class="section-title">${I('scan', 16)} الأصناف</div>
        <div class="scan-box"><span style="color:var(--primary)">${I('barcode', 26)}</span><input class="input" data-scan placeholder="امسح الباركود بالجهاز أو اكتبه ودوس Enter" autocomplete="off">
          <select class="select" data-pick style="max-width:260px"><option value="">أو اختار صنف…</option>${st.products.map((p) => `<option value="${p.id}">${U.esc(p.shortAr)}</option>`).join('')}</select>
          ${camOK ? `<button class="btn" data-cam>${I('camera', 17)} كاميرا</button>` : ''}</div>
        <div data-video></div>
        <div class="card table-wrap" style="margin-top:12px"><table class="table lines-table"><thead><tr><th>الصنف</th><th data-col="avail">المتاح</th><th>الكمية</th><th data-col="lot">رقم التشغيلة</th><th data-col="lot">الصلاحية</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
        <div class="field" style="margin-top:14px"><label>ملاحظات</label><textarea class="input" name="note" rows="2" placeholder="مثال: صرف على عملية بمستشفى…"></textarea></div>`,
      foot: `<span class="grow small muted" data-sum></span><button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} حفظ وترحيل الإذن</button>`,
    });
    const $ = m.$;
    const sync = () => {
      m.$$('[data-show]').forEach((x) => x.classList.toggle('hidden', !x.dataset.show.split(' ').includes(type)));
      const incoming = type === 'in' || type === 'return';
      m.$$('[data-col="lot"]').forEach((x) => x.classList.toggle('hidden', type !== 'in'));
      m.$$('[data-col="avail"]').forEach((x) => x.classList.toggle('hidden', incoming));
      $('[data-whl]').textContent = type === 'transfer' ? 'من المخزن' : incoming ? 'المخزن المستلِم' : 'المخزن الصارف';
      m.$('.modal-head h3').textContent = M.MOVE_TYPES[type].name + ' جديد';
      drawLines();
    };
    const drawLines = () => {
      const wh = $('[name="wh"]').value;
      $('[data-lines]').innerHTML = lines.length ? lines.map((l, i) => { const p = S.product(l.productId); const av = S.stock(p.id, wh); const over = type !== 'in' && type !== 'return' && l.qty > av; return `<tr><td><div class="prod-cell" style="min-width:220px">${App.prodThumb(p, 32)}<div><div class="t small">${U.esc(p.shortAr)}</div><div class="s mono">${p.barcode}</div></div></div></td>
        <td class="${type === 'in' || type === 'return' ? 'hidden' : ''}"><b style="color:${over ? 'var(--danger)' : 'inherit'}">${av}</b></td><td><input class="input" type="number" min="1" value="${l.qty}" data-q="${i}" style="width:84px;height:34px;${over ? 'border-color:var(--danger)' : ''}"></td>
        <td class="${type === 'in' ? '' : 'hidden'}"><input class="input mono" data-lot="${i}" value="${U.esc(l.lot || '')}" placeholder="تلقائي" style="width:140px;height:34px"></td><td class="${type === 'in' ? '' : 'hidden'}"><input class="input" type="date" data-exp="${i}" value="${l.expiry || ''}" style="width:150px;height:34px"></td>
        <td><button class="icon-btn" style="width:32px;height:32px" data-rm="${i}">${I('trash', 15)}</button></td></tr>`; }).join('') : `<tr><td colspan="6"><div class="empty" style="padding:26px">${I('scan', 32)}<div>امسح باركود أي صنف لإضافته — جرّب: <span class="mono">2000000000015</span></div></div></td></tr>`;
      $('[data-sum]').textContent = lines.length ? `${lines.length} صنف · ${U.sum(lines, (l) => l.qty)} وحدة` : '';
    };
    const add = (pid) => {
      const ex = lines.find((l) => l.productId === pid);
      if (ex) ex.qty++; else lines.push({ productId: pid, qty: 1, expiry: U.dayISO(U.addDays(new Date(), 1095)) });
      drawLines();
    };
    const scan = (code) => {
      const p = S.state.products.find((x) => x.barcode === code.trim() || x.sku.toLowerCase() === code.trim().toLowerCase());
      if (!p) return App.ui.toast(`الباركود ${U.esc(code)} غير مسجل`, 'err');
      add(p.id); App.ui.toast(`تمت إضافة: ${U.esc(p.shortAr)}`);
    };
    m.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]'); if (t) { type = t.dataset.t; m.$$('[data-t]').forEach((b) => b.classList.toggle('on', b === t)); sync(); }
      const rm = e.target.closest('[data-rm]'); if (rm) { lines.splice(+rm.dataset.rm, 1); drawLines(); }
      if (e.target.closest('[data-cam]')) startCamera(m, scan);
    });
    m.el.addEventListener('input', (e) => {
      const q = e.target.dataset.q, lot = e.target.dataset.lot, ex = e.target.dataset.exp;
      if (q !== undefined) lines[+q].qty = Math.max(1, +e.target.value || 1);
      if (lot !== undefined) lines[+lot].lot = e.target.value.trim();
      if (ex !== undefined) lines[+ex].expiry = e.target.value;
    });
    m.el.addEventListener('change', (e) => { if (e.target.dataset.q !== undefined || e.target.name === 'wh') drawLines(); });
    $('[data-scan]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.target.value.trim()) scan(e.target.value); e.target.value = ''; } });
    $('[data-pick]').onchange = (e) => { if (e.target.value) { add(e.target.value); e.target.value = ''; } };
    $('[data-save]').onclick = () => {
      if (!lines.length) return App.ui.toast('ضيف صنف واحد على الأقل', 'err');
      const wh = $('[name="wh"]').value, to = $('[name="to"]').value;
      if (type === 'transfer' && wh === to) return App.ui.toast('اختار مخزنين مختلفين للتحويل', 'err');
      const cust = S.customer($('[name="cust"]').value);
      const btn = $('[data-save]'); btn.disabled = true;
      App.run('addMovement', { type, warehouseId: wh, toWarehouseId: type === 'transfer' ? to : null, party: type === 'in' ? $('[name="supplier"]').value : type === 'transfer' ? '' : cust.name, repId: type === 'out' || type === 'return' ? $('[name="rep"]').value : null, note: $('[name="note"]').value, lines },
        (mv) => `اترحّل ${M.MOVE_TYPES[type].name} ${mv.no} والأرصدة اتحدّثت`).then((mv) => {
        btn.disabled = false;
        if (mv) { m.close(); App.openMovement(mv.id); }
      });
    };
    if (presetPid) add(presetPid);
    sync();
    setTimeout(() => $('[data-scan]').focus(), 50);
  }
  App.newMovement = newMovement;

  async function startCamera(m, onCode) {
    const box = m.$('[data-video]');
    if (box.innerHTML) { box.innerHTML = ''; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      box.innerHTML = '<video class="video-scan" autoplay playsinline muted></video>';
      const v = box.querySelector('video'); v.srcObject = stream;
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });
      let last = '';
      const stop = () => stream.getTracks().forEach((t) => t.stop());
      m.el._onClose = stop;
      const loop = async () => {
        if (!document.body.contains(v)) return stop();
        try { const r = await det.detect(v); if (r[0] && r[0].rawValue !== last) { last = r[0].rawValue; onCode(last); setTimeout(() => (last = ''), 2000); } } catch (e) { /* frame not ready */ }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { App.ui.toast('تعذر فتح الكاميرا', 'err'); }
  }

  /* movement voucher */
  /** Supplier return: pick expired / near-expiry lots (expired ones first and preselected), quantities, supplier. */
  App.supplierReturn = () => {
    const st = S.state, warn = st.settings.expiryWarnDays;
    let wh = st.warehouses[0].id;
    const suppliers = [...new Set(st.movements.filter((x) => (x.type === 'in' || x.type === 'rts') && x.party).map((x) => x.party))];
    const pick = {};
    const lotsOf = () => st.lots.filter((l) => l.qty > 0 && l.warehouseId === wh && S.daysToExpiry(l) <= warn).sort((a, b) => a.expiry.localeCompare(b.expiry));
    const m = App.ui.modal({
      title: 'مرتجع للمورد', icon: 'ret', iconTint: 'tint-danger', wide: true,
      body: `<div class="callout tint-warning" style="margin-bottom:14px">${I('alert', 18)}<span>ده المسار الوحيد اللي التشغيلات المنتهية بتخرج منه. البيع والتحويل ما بيصرفوش أي تشغيلة منتهية.</span></div>
        <div class="form-grid"><div class="field"><label>المخزن</label><select class="select" name="wh">${st.warehouses.map((w) => `<option value="${w.id}">${U.esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label>المورد</label><input class="input" name="party" list="rtsSup" placeholder="اسم المورد" value="${U.esc(suppliers[0] || '')}"><datalist id="rtsSup">${suppliers.map((x) => `<option>${U.esc(x)}</option>`).join('')}</datalist></div>
        <div class="field full"><label>ملاحظات</label><input class="input" name="note" placeholder="مثلاً: منتهي الصلاحية — طلب استبدال"></div></div>
        <div class="section-title">${I('clock', 16)} التشغيلات المنتهية أو اللي فاضل لها ${warn} يوم أو أقل</div><div data-lots></div>`,
      foot: `<span class="small muted grow" data-sum></span><button class="btn" data-close>إلغاء</button><button class="btn primary" data-ok>${I('check', 17)} رحّل المرتجع</button>`,
    });
    const draw = () => {
      const lots = lotsOf();
      lots.forEach((l) => { if (pick[l.id] === undefined) pick[l.id] = S.daysToExpiry(l) < 0 ? l.qty : 0; });
      m.$('[data-lots]').innerHTML = lots.length ? `<div class="card table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>التشغيلة</th><th>الصلاحية</th><th class="num">الرصيد</th><th>يرجع</th></tr></thead><tbody>
        ${lots.map((l) => { const p = S.product(l.productId), d = S.daysToExpiry(l); return `<tr><td><div class="prod-cell" style="min-width:180px">${App.prodThumb(p, 32)}<span class="t small">${U.esc(p.shortAr)}</span></div></td><td class="mono small">${l.lot}</td><td>${d < 0 ? `<span class="chipx r">منتهية من ${-d} يوم</span>` : `<span class="chipx w">فاضل ${d} يوم</span>`}</td><td class="num">${l.qty}</td>
          <td><input class="input" type="number" min="0" max="${l.qty}" value="${pick[l.id]}" data-lot="${l.id}" style="width:84px;min-height:38px"></td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="empty">${I('checkCircle', 34)}<div>مفيش تشغيلات منتهية أو قربت تنتهي في المخزن ده</div></div>`;
      sum();
    };
    const lines = () => lotsOf().filter((l) => pick[l.id] > 0).map((l) => ({ lotId: l.id, qty: Math.min(pick[l.id], l.qty) }));
    const sum = () => { const ls = lines(); m.$('[data-sum]').textContent = ls.length ? `${ls.length} تشغيلة · ${U.sum(ls, (x) => x.qty)} وحدة` : 'اختار الكميات اللي هترجع'; };
    m.$('[name="wh"]').onchange = (e) => { wh = e.target.value; draw(); };
    m.el.addEventListener('input', (e) => { const id = e.target.dataset.lot; if (!id) return; pick[id] = Math.max(0, Math.min(+e.target.max, Math.floor(+e.target.value || 0))); sum(); });
    m.$('[data-ok]').onclick = () => {
      const ls = lines();
      if (!ls.length) return App.ui.toast('اختار كمية من تشغيلة واحدة على الأقل', 'err');
      App.run('returnToSupplier', { warehouseId: wh, party: m.$('[name="party"]').value, note: m.$('[name="note"]').value, lines: ls }, (mv) => `اترحّل المرتجع ${mv.no}`, 'الكميات اتخصمت من التشغيلات دي بس')
        .then((mv) => { if (mv) { m.close(); App.openMovement(mv.id); } });
    };
    draw();
  };

  App.openMovement = (id) => {
    const mv = S.state.movements.find((x) => x.id === id);
    const t = M.MOVE_TYPES[mv.type];
    const st = S.state;
    const val = U.sum(mv.lines, (l) => l.qty * S.product(l.productId).cost);
    App.ui.modal({
      title: `${t.name} <span class="mono muted" style="font-size:14px">${mv.no}</span>`, icon: t.icon, wide: true,
      body: `<div class="row between wrap" style="margin-bottom:18px"><div class="brand" style="padding:0"><span class="brand-mark" style="width:38px;height:38px">${I('pulse', 20, 2.2)}</span><div><div style="font-weight:700">${st.settings.company}</div><div class="small muted ltr">${st.settings.companyEn}</div></div></div>
          <div class="barcode-box" style="padding:6px 10px">${code128ish(mv.no)}</div></div>
        <dl class="kv kv4"><dt>التاريخ</dt><dd>${U.date(mv.date)} — ${U.time(mv.date)}</dd><dt>المخزن</dt><dd>${U.esc(S.warehouse(mv.warehouseId).name)}${mv.toWarehouseId ? ' ← ' + U.esc(S.warehouse(mv.toWarehouseId).name) : ''}</dd>
          <dt>${mv.type === 'in' || mv.type === 'rts' ? 'المورد' : 'الجهة'}</dt><dd>${U.esc(mv.party || 'تحويل داخلي')}</dd><dt>المندوب</dt><dd>${mv.repId ? U.esc(S.rep(mv.repId).name) : '—'}</dd><dt>أنشأه</dt><dd>${U.esc(S.user(mv.userId).name)}</dd><dt>ملاحظات</dt><dd>${U.esc(mv.note || '—')}</dd></dl>
        <div class="card table-wrap" style="margin-top:18px"><table class="table"><thead><tr><th>#</th><th>الصنف</th><th>الباركود</th><th>التشغيلة</th><th class="num">الكمية</th>${S.seesCost() ? '<th class="num">القيمة (تكلفة)</th>' : ''}</tr></thead><tbody>
          ${mv.lines.map((l, i) => { const p = S.product(l.productId); return `<tr><td>${i + 1}</td><td><b class="small">${U.esc(p.shortAr)}</b></td><td class="mono small">${p.barcode}</td><td class="mono small">${l.lot}</td><td class="num"><b>${l.qty}</b></td>${S.seesCost() ? `<td class="num">${U.num(l.qty * p.cost)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
        <div class="row between" style="margin-top:12px"><span class="muted small">إجمالي الوحدات: <b>${U.sum(mv.lines, (l) => l.qty)}</b></span>${S.seesCost() ? `<span>الإجمالي: <b>${U.moneyTxt(val)}</b></span>` : ''}</div>
        <div class="grid g-3" style="margin-top:34px;text-align:center">${['أمين المخزن', 'المستلم', 'المراجعة'].map((s) => `<div><div style="border-top:1px dashed var(--border-strong);padding-top:8px" class="small muted">${s}</div></div>`).join('')}</div>`,
      foot: `<button class="btn" data-close>إغلاق</button><button class="btn primary" data-print>${I('printer', 17)} طباعة الإذن</button>`,
      onMount(m) { m.$('[data-print]').onclick = () => printNode(m.$('.modal-body').innerHTML, `${t.name} ${mv.no}`); },
    });
  };
  // compact visual barcode for document numbers (decorative Code-128 style stripes)
  function code128ish(text) {
    let x = 0, bars = '';
    [...text].forEach((ch) => { const c = ch.charCodeAt(0); [1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 1) % 3), 1].forEach((w, k) => { if (k % 2 === 0) bars += `<rect x="${x}" width="${w}" height="34"/>`; x += w + 1; }); });
    return `<svg viewBox="0 0 ${x} 48" width="${Math.min(x * 1.4, 220)}" height="48" style="direction:ltr"><g fill="#000">${bars}</g><text x="${x / 2}" y="46" font-size="9" text-anchor="middle" font-family="monospace">${text}</text></svg>`;
  }
  function printNode(html, title) {
    if (App.blockedInFrame('الطباعة')) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return App.ui.toast('اسمح بالنوافذ المنبثقة للطباعة', 'err');
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${new URL('assets/css/app.css', location.href)}"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body data-theme="light" style="background:#fff;padding:30px">${html}<script>setTimeout(()=>print(),600)<\/script></body></html>`);
    w.document.close();
  }
  App.printNode = printNode;

  /* =============== Barcode labels =============== */
  const bl = { sel: {}, q: '' };
  App.pages.barcodes = {
    title: 'طباعة الباركود',
    render(r) {
      const pre = r.query.get('p');
      if (pre && !bl.sel[pre]) bl.sel = { [pre]: 4 };
      const st = S.state;
      const list = st.products.filter((p) => U.match(bl.q, p.nameAr, p.shortAr, p.barcode, p.nameEn));
      const chosen = Object.entries(bl.sel).filter(([, n]) => n > 0);
      const labels = chosen.flatMap(([pid, n]) => Array(n).fill(S.product(pid)));
      return `${App.pageHead('طباعة ملصقات الباركود', 'اختار الأصناف وعدد النسخ — ملصقات EAN-13 جاهزة لطابعات الملصقات أو ورق A4',
        `<button class="btn" data-a="clear">${I('x', 17)} مسح التحديد</button><button class="btn primary" data-a="print" ${labels.length ? '' : 'disabled'}>${I('printer', 17)} طباعة ${labels.length || ''} ملصق</button>`)}
        <div class="grid" style="grid-template-columns:minmax(0,380px) minmax(0,1fr)" data-bgrid>
          <div class="card no-print"><div class="toolbar"><div class="input-icon" style="width:100%">${I('search', 17)}<input class="input" data-f="q" placeholder="ابحث عن صنف…" value="${U.esc(bl.q)}"></div></div>
            <div style="max-height:640px;overflow-y:auto;padding:4px 16px">${list.map((p) => `<div class="list-item"><input type="checkbox" data-chk="${p.id}" ${bl.sel[p.id] ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">${App.prodThumb(p, 32)}<div class="grow"><div class="li-t small truncate">${U.esc(p.shortAr)}</div><div class="li-s mono">${p.barcode}</div></div><input class="input" type="number" min="0" data-n="${p.id}" value="${bl.sel[p.id] || 0}" style="width:64px;height:32px"></div>`).join('')}</div></div>
          <div class="card"><div class="card-head no-print"><h3>معاينة الملصقات</h3><span class="sub">${labels.length} ملصق</span></div><div class="card-body">
            ${labels.length ? `<div class="labels">${labels.map((p) => `<div class="label"><div class="l-name">${U.esc(p.shortAr)}</div>${App.barcode.svg(p.barcode, { module: 2, height: 52 })}<div class="l-meta"><span>${p.sku}</span><span>LIFE MEDX</span><span>${U.esc(p.origin === '—' ? 'EGYPT' : p.origin.toUpperCase())}</span></div></div>`).join('')}</div>`
              : `<div class="empty">${I('barcode', 44)}<div>اختار صنف من القائمة عشان تشوف الملصقات</div></div>`}</div></div></div>`;
    },
    mount(el) {
      if (window.innerWidth < 980) el.querySelector('[data-bgrid]').style.gridTemplateColumns = '1fr';
      el.querySelector('[data-f="q"]').addEventListener('input', U.debounce((e) => { bl.q = e.target.value; const pos = e.target.selectionStart; App.refresh(); const i = document.querySelector('[data-f="q"]'); i.focus(); i.setSelectionRange(pos, pos); }, 200));
      el.addEventListener('change', (e) => {
        const c = e.target.dataset.chk, n = e.target.dataset.n;
        if (c) bl.sel[c] = e.target.checked ? Math.max(bl.sel[c] || 0, 3) : 0;
        if (n) bl.sel[n] = Math.max(0, +e.target.value || 0);
        if (c || n) { history.replaceState(null, '', '#/barcodes'); App.refresh(); }
      });
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'print' && !App.blockedInFrame('الطباعة')) window.print();
        if (a === 'clear') { bl.sel = {}; history.replaceState(null, '', '#/barcodes'); App.refresh(); }
      });
    },
  };
})(window.App);
