/* Admin panel + coming-soon modules. */
(function (App) {
  'use strict';
  const U = App.util, S = App.store, I = App.icon, M = App.meta;
  const af = { tab: 'users' };

  App.pages.admin = {
    title: 'لوحة الإدارة',
    render() {
      const st = S.state;
      const today = st.activity.filter((a) => U.dayISO(a.at) === U.dayISO(new Date())).length;
      const tabs = [['users', 'المستخدمون', 'users'], ['perms', 'الأدوار والصلاحيات', 'shield'], ['wh', 'المخازن والفروع', 'warehouse'], ['log', 'سجل النشاط', 'history'], ['settings', 'الإعدادات', 'sliders']];
      const body = { users, perms, wh, log, settings }[af.tab]();
      return `${App.pageHead('لوحة الإدارة', 'المستخدمين والصلاحيات والمخازن وإعدادات النظام في مكان واحد')}
        <div class="grid g-4">
          ${App.kpi({ icon: 'users', tint: 'tint-primary', label: 'المستخدمون', value: st.users.length, foot: `${st.users.filter((u) => u.active).length} نشط · ${Object.keys(M.ROLES).length} أدوار` })}
          ${App.kpi({ icon: 'warehouse', tint: 'tint-accent', label: 'المخازن', value: st.warehouses.length, foot: st.warehouses.map((w) => w.code).join(' · ') })}
          ${App.kpi({ icon: 'history', tint: 'tint-violet', label: 'نشاط اليوم', value: today, foot: `${st.activity.length} عملية مسجلة` })}
          ${App.kpi({ icon: 'package', tint: 'tint-warning', label: 'حجم البيانات', value: `${Math.round(JSON.stringify(st).length / 1024)} <small>KB</small>`, foot: `${st.products.length} صنف · ${st.orders.length} أمر بيع` })}
        </div>
        <div class="card mt"><div class="tabs">${tabs.map(([k, n, ic]) => `<button class="tab ${af.tab === k ? 'on' : ''}" data-tab="${k}"><span class="row" style="gap:7px">${I(ic, 16)} ${n}</span></button>`).join('')}</div>${body}</div>`;
    },
    mount(el) {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { af.tab = t.dataset.tab; App.refresh(); return; }
        const a = e.target.closest('[data-a]'); if (!a) return;
        const act = a.dataset.a, id = a.dataset.id;
        if (act === 'add-user') addUser();
        if (act === 'toggle-user') App.run('toggleUser', { id });
        if (act === 'password') setPassword(id);
        if (act === 'as' && S.mode === 'local') { S.login(id); document.getElementById('root').innerHTML = ''; App.go('#/dashboard'); App.refresh(); App.ui.toast(`أنت الآن تشاهد النظام كـ ${S.user(id).name}`); }
        if (act === 'perm') { const [role, module, level] = id.split(':'); App.run('setPerm', { role, module, level: +level }, 'اتحفظت الصلاحية — وبتتطبق على طول'); }
        if (act === 'add-wh') addWarehouse();
        if (act === 'reset') {
          const txt = S.mode === 'server' ? 'هتتمسح كل البيانات على السيرفر لكل المستخدمين وترجع بيانات العرض الأصليةة. يُنصح بتنزيل نسخة احتياطية أولاً.' : 'هتتمسح كل التعديلات على المتصفح ده وترجع البيانات الأصلية.';
          App.ui.confirm('إعادة ضبط البيانات', txt, 'إعادة الضبط').then((ok) => { if (ok) { const me = S.session(); S.reset().then(() => { if (S.mode === 'local') S.login(me); App.refresh(); App.ui.toast('تمت إعادة ضبط البيانات'); }).catch((e) => App.ui.toast(e.message, 'err')); } });
        }
        if (act === 'backup' && !App.blockedInFrame('تنزيل النسخة الاحتياطية')) { const b = new Blob([JSON.stringify(S.state)], { type: 'application/json' }); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = `life-medx-backup-${U.dayISO(new Date())}.json`; l.click(); App.ui.toast('النسخة الاحتياطية نزلت'); }
        if (act === 'restore') el.querySelector('[data-restore]').click();
        if (act === 'save-settings') {
          const f = Object.fromEntries([...el.querySelectorAll('[data-set]')].map((i) => [i.dataset.set, i.value]));
          App.run('saveSettings', f, 'اتحفظت الإعدادات');
        }
      });
      const rf = el.querySelector('[data-restore]');
      if (rf) rf.onchange = async () => {
        try {
          const s = JSON.parse(await rf.files[0].text());
          const me = S.session();
          await S.restore(s);
          if (S.mode === 'local') S.login(me);
          App.refresh(); App.ui.toast('النسخة الاحتياطية رجعت');
        } catch (e) { App.ui.toast(e instanceof SyntaxError ? 'الملف مش سليم' : e.message, 'err'); }
      };
    },
  };

  function users() {
    const st = S.state;
    const server = S.mode === 'server';
    return `<div class="toolbar"><b>كل المستخدمين</b><div class="grow"></div><button class="btn primary sm" data-a="add-user">${I('plus', 15)} مستخدم جديد</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>المستخدم</th><th>الدور</th>${server ? '<th>اسم الدخول</th>' : ''}<th>البريد</th><th>آخر نشاط</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${st.users.map((u) => { const last = st.activity.find((a) => a.userId === u.id); const r = M.ROLES[u.role]; return `<tr><td><div class="row">${U.avatar(u.name)}<div><div style="font-weight:600">${U.esc(u.name)}</div><div class="small muted">${U.esc(u.title)}</div></div></div></td>
        <td><span class="badge plain ${{ admin: 'b-primary', warehouse: 'b-accent', sales: 'b-warning' }[u.role]}">${I(r.icon, 13)} ${r.name}</span></td>${server ? `<td class="mono small">${S.accounts?.[u.id] ? U.esc(S.accounts[u.id]) : '<span class="badge b-warning">بدون حساب</span>'}</td>` : ''}<td class="small ltr" style="text-align:right">${U.esc(u.email)}</td><td class="small muted">${last ? U.ago(last.at) : '—'}</td>
        <td><label class="switch"><input type="checkbox" ${u.active ? 'checked' : ''} data-a="toggle-user" data-id="${u.id}" ${u.id === S.session() ? 'disabled' : ''}><span></span></label></td>
        <td>${server ? `<button class="btn sm ghost" data-a="password" data-id="${u.id}">${I('lock', 14)} ${S.accounts?.[u.id] ? 'كلمة المرور' : 'إنشاء حساب'}</button>` : u.id !== S.session() && u.active ? `<button class="btn sm ghost" data-a="as" data-id="${u.id}">${I('eye', 14)} الدخول كـ</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  }

  function perms() {
    const P = S.state.perms;
    const lv = [['0', 'لا شيء'], ['1', 'عرض'], ['2', 'تعديل']];
    return `<div class="callout tint-info" style="margin:16px">${I('shield', 18)}<span>حدّد كل دور يشوف إيه ويعدّل إيه. التغيير بيتطبق على طول على القائمة الجانبية والشاشات — جرّب إلغاء «لوحة التحكم» للمندوب ثم ادخل كمندوب.</span></div>
      <div class="table-wrap"><table class="table perm-table"><thead><tr><th>الشاشة</th>${Object.entries(M.ROLES).map(([k, r]) => `<th><span class="row" style="justify-content:center;gap:6px">${I(r.icon, 15)} ${r.name}</span></th>`).join('')}</tr></thead><tbody>
      ${M.MODULES.map((m) => `<tr><td><b>${m.name}</b></td>${Object.keys(M.ROLES).map((role) => `<td>${role === 'admin' ? '<span class="badge b-success plain">' + I('lock', 12) + ' تحكم كامل</span>' : `<div class="seg">${lv.map(([v, n]) => `<button class="${String(P[role][m.key] || 0) === v ? 'on' : ''}" data-a="perm" data-id="${role}:${m.key}:${v}">${n}</button>`).join('')}</div>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function wh() {
    const st = S.state;
    return `<div class="toolbar"><b>المخازن والفروع</b><div class="grow"></div><button class="btn primary sm" data-a="add-wh">${I('plus', 15)} مخزن جديد</button></div>
      <div class="card-body"><div class="grid g-3">${st.warehouses.map((w) => { const lots = st.lots.filter((l) => l.warehouseId === w.id && l.qty > 0); const units = U.sum(lots, (l) => l.qty); return `<div class="card" style="padding:18px">
        <div class="row between"><span class="k-ic tint-accent" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${I('warehouse', 22)}</span><span class="badge plain b-muted mono">${w.code}</span></div>
        <div style="font-weight:700;margin-top:12px">${U.esc(w.name)}</div><div class="small muted">${I('pin', 12)} ${w.city} · المسؤول: ${U.esc(S.user(w.manager).name)}</div>
        <div class="rep-stats"><div class="rep-stat"><div class="v">${units}</div><div class="l">وحدة</div></div><div class="rep-stat"><div class="v">${lots.length}</div><div class="l">تشغيلة</div></div><div class="rep-stat"><div class="v">${U.compact(U.sum(lots, (l) => l.qty * S.product(l.productId).cost))}</div><div class="l">القيمة ج.م</div></div></div></div>`; }).join('')}</div></div>`;
  }

  function log() {
    return `<div class="card-body"><div class="list">${S.state.activity.slice(0, 40).map((a) => { const u = S.user(a.userId); return `<div class="list-item">${U.avatar(u?.name || '?', 'sm')}<div class="grow"><div class="li-t" style="font-weight:500"><b>${U.esc(u?.name || '')}</b> ${U.esc(a.text)}</div><div class="li-s">${U.ago(a.at)} · ${U.date(a.at)} ${U.time(a.at)}</div></div><span class="badge plain b-muted">${M.ROLES[u?.role]?.name || ''}</span></div>`; }).join('')}</div></div>`;
  }

  function settings() {
    const s = S.state.settings;
    return `<div class="card-body"><div class="grid g-2"><div>
      <div class="section-title" style="margin-top:4px">${I('sliders', 16)} بيانات الشركة والمخزن</div>
      <div class="form-grid"><div class="field full"><label>اسم الشركة</label><input class="input" data-set="company" value="${U.esc(s.company)}"></div>
        <div class="field full"><label>الاسم بالإنجليزية</label><input class="input ltr" data-set="companyEn" value="${U.esc(s.companyEn)}"></div>
        <div class="field"><label>تنبيه الصلاحية قبل (يوم)</label><input class="input" type="number" data-set="expiryWarnDays" value="${s.expiryWarnDays}"></div>
        <div class="field"><label>سياسة الصرف</label><select class="select" data-set="issuePolicy"><option value="FEFO" ${s.issuePolicy === 'FEFO' ? 'selected' : ''}>FEFO — الأقرب انتهاءً أولاً</option><option value="FIFO" ${s.issuePolicy === 'FIFO' ? 'selected' : ''}>FIFO — الأقدم استلاماً أولاً</option></select></div>
        <div class="field"><label>ضريبة القيمة المضافة %</label><input class="input" type="number" data-set="vat" value="${s.vat}"></div>
        <div class="field"><label>العملة</label><input class="input" value="جنيه مصري (EGP)" disabled></div></div>
      <button class="btn primary mt" data-a="save-settings">${I('check', 17)} حفظ الإعدادات</button></div>
      <div><div class="section-title" style="margin-top:4px">${I('download', 16)} النسخ الاحتياطي والبيانات</div>
        <div class="list">
          <div class="list-item"><span class="li-ic tint-primary">${I('download', 17)}</span><div class="grow"><div class="li-t">تنزيل نسخة احتياطية</div><div class="li-s">ملف JSON بكل بيانات النظام — لنقلها لجهاز آخر</div></div><button class="btn sm" data-a="backup">تنزيل</button></div>
          <div class="list-item"><span class="li-ic tint-accent">${I('refresh', 17)}</span><div class="grow"><div class="li-t">استرجاع نسخة احتياطية</div><div class="li-s">استيراد ملف JSON سبق تنزيله</div></div><button class="btn sm" data-a="restore">استيراد</button><input type="file" accept=".json" data-restore class="hidden"></div>
          <div class="list-item"><span class="li-ic tint-danger">${I('trash', 17)}</span><div class="grow"><div class="li-t">إعادة ضبط البيانات التجريبية</div><div class="li-s">الرجوع لبيانات العرض الأصلية</div></div><button class="btn sm danger" data-a="reset">إعادة الضبط</button></div>
        </div>
        ${S.mode === 'server'
          ? `<div class="callout tint-success" style="margin-top:16px">${I('shield', 18)}<span>متصل بالسيرفر المحلي${S.serverInfo?.name ? ` (${U.esc(S.serverInfo.name)})` : ''} — قاعدة بيانات مركزية، وكل تعديل يظهر لكل المستخدمين لحظياً. السيرفر يحفظ نسخة احتياطية تلقائية يومياً في مجلد <span class="mono">server/data/backups</span>.</span></div>`
          : `<div class="callout tint-warning" style="margin-top:16px">${I('alert', 18)}<span>النسخة دي شغالة من غير سيرفر، فالبيانات بتتحفظ على متصفح كل مستخدم. شغّل السيرفر المحلي (start-server.bat) ليعمل الفريق على نفس البيانات لحظياً.</span></div>`}</div></div></div>`;
  }

  /** server mode: create the login for a user, or reset its password */
  function setPassword(userId) {
    const u = S.user(userId);
    const existing = S.accounts?.[userId];
    const m = App.ui.modal({
      title: `${existing ? 'تغيير كلمة المرور' : 'إنشاء حساب دخول'} — ${U.esc(u.name)}`, icon: 'lock',
      body: `<div class="form-grid"><div class="field full"><label for="acUser">اسم الدخول</label><input class="input ltr" id="acUser" value="${U.esc(existing || u.email.split('@')[0] || '')}" ${existing ? 'disabled' : ''} autocomplete="off" style="text-align:right"></div>
        <div class="field full"><label for="acPass">كلمة المرور الجديدة</label><input class="input ltr" id="acPass" type="password" autocomplete="new-password" style="text-align:right"><span class="small muted">8 أحرف على الأقل. سلّمها للمستخدم بشكل مباشر.</span></div></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} حفظ</button>`,
    });
    m.$('[data-save]').onclick = async () => {
      const username = m.$('#acUser').value.trim(), password = m.$('#acPass').value;
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return App.ui.toast('اسم الدخول: حروف إنجليزية وأرقام فقط (3 أحرف على الأقل)', 'err');
      if (password.length < 8) return App.ui.toast('كلمة المرور لازم تكون 8 حروف على الأقل', 'err');
      try {
        const j = await S.api('admin/account', { userId, username, password });
        S.accounts = j.accounts; m.close(); App.refresh(); App.ui.toast('اتحفظت بيانات الدخول');
      } catch (e) { App.ui.toast(e.message, 'err'); }
    };
  }

  function addUser() {
    const m = App.ui.modal({
      title: 'مستخدم جديد', icon: 'user',
      body: `<div class="form-grid"><div class="field full"><label>الاسم</label><input class="input" name="name"></div><div class="field"><label>الدور</label><select class="select" name="role">${Object.entries(M.ROLES).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('')}</select></div>
        <div class="field"><label>المسمى الوظيفي</label><input class="input" name="title"></div><div class="field full"><label>البريد الإلكتروني</label><input class="input ltr" name="email" placeholder="name@lifemedx.eg"></div>
        <div class="field full" data-repfields><label>منطقة المندوب</label><input class="input" name="region" placeholder="مثال: القاهرة — شمال"></div></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} إضافة</button>`,
    });
    const sync = () => m.$('[data-repfields]').classList.toggle('hidden', m.$('[name="role"]').value !== 'sales');
    m.$('[name="role"]').onchange = sync; sync();
    m.$('[data-save]').onclick = () => {
      const f = Object.fromEntries(m.$$('[name]').map((i) => [i.name, i.value.trim()]));
      if (f.name.length < 3) return App.ui.toast('اكتب اسم المستخدم', 'err');
      App.run('addUser', f, S.mode === 'server' ? 'تمت إضافة المستخدم — أنشئ له حساب دخول' : 'تمت إضافة المستخدم').then((u) => {
        if (!u) return;
        m.close();
        if (S.mode === 'server') setPassword(u.id);
      });
    };
  }

  function addWarehouse() {
    const m = App.ui.modal({
      title: 'مخزن جديد', icon: 'warehouse', iconTint: 'tint-accent',
      body: `<div class="form-grid"><div class="field full"><label>اسم المخزن</label><input class="input" name="name" placeholder="مثال: فرع المنصورة"></div><div class="field"><label>الكود</label><input class="input mono ltr" name="code" maxlength="4" placeholder="MNS"></div><div class="field"><label>المدينة</label><input class="input" name="city"></div></div>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${I('check', 17)} إضافة</button>`,
    });
    m.$('[data-save]').onclick = () => {
      const f = Object.fromEntries(m.$$('[name]').map((i) => [i.name, i.value.trim()]));
      if (!f.name || !f.code) return App.ui.toast('اكتب الاسم والكود', 'err');
      App.run('addWarehouse', f, 'تمت إضافة المخزن').then((w) => w && m.close());
    };
  }

  /* ---------- coming soon ---------- */
  const SOON = {
    accounts: { title: 'الحسابات العامة', icon: 'wallet', items: [['دليل الحسابات', 'شجرة حسابات متوافقة مع المعايير المصرية'], ['القيود اليومية', 'قيود آلية من حركات المخزن والمبيعات'], ['القوائم المالية', 'ميزان المراجعة وقائمة الدخل والميزانية']] },
    invoices: { title: 'الفواتير والتحصيل', icon: 'receipt', items: [['الفاتورة الإلكترونية', 'ربط مع منظومة الضرائب المصرية (ETA)'], ['أعمار الديون', 'متابعة مستحقات المستشفيات والتأمين'], ['التحصيل', 'شيكات وتحويلات وتسويات المناديب']] },
    hr: { title: 'الموارد البشرية', icon: 'briefcase', items: [['ملفات الموظفين', 'بيانات وعقود ومستندات'], ['العمولات', 'حساب عمولة المناديب تلقائياً من التارجت'], ['الحضور والإجازات', 'متابعة الحضور والمأموريات']] },
  };
  App.pages.soon = {
    title: 'قريباً',
    render(r) {
      const s = SOON[r.arg] || SOON.accounts;
      return `<div class="card soon-hero"><div class="art">${I(s.icon, 50, 1.4)}</div><span class="badge b-primary plain">المرحلة الثانية</span><h1 style="margin:12px 0 6px">${s.title}</h1>
        <p class="muted" style="max-width:520px;margin:0 auto">الجزء ده في خطة التطوير الجاية، وهيبقى مربوط على طول بالمخزن والمبيعات الحالية بدون إدخال بيانات مرتين.</p>
        <div class="roadmap">${s.items.map(([t, d]) => `<div class="card" style="padding:16px"><div class="row" style="gap:8px;margin-bottom:6px"><span style="color:var(--primary)">${I('checkCircle', 18)}</span><b>${t}</b></div><div class="small muted">${d}</div></div>`).join('')}</div></div>`;
    },
  };
})(window.App);
