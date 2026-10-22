/* Core helpers: formatting, icons, EAN-13 barcodes, SVG charts, overlays. */
window.App = window.App || {};
(function (App) {
  'use strict';

  /* ---------------- utils ---------------- */
  const U = App.util = {};
  U.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.num = (n) => Number(n || 0).toLocaleString('en-US');
  U.money = (n) => `${U.num(Math.round(n || 0))} <small>ج.م</small>`;
  U.moneyTxt = (n) => `${U.num(Math.round(n || 0))} ج.م`;
  U.compact = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return `${+(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)} م`;
    if (a >= 1e3) return `${+(n / 1e3).toFixed(0)} ألف`;
    return String(n);
  };
  const dtf = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
  const dtfShort = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
  const tf = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const mf = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'short' });
  U.date = (d) => (d ? dtf.format(new Date(d)) : '—');
  U.dateShort = (d) => (d ? dtfShort.format(new Date(d)) : '—');
  U.time = (d) => tf.format(new Date(d));
  U.month = (d) => mf.format(new Date(d));
  U.iso = (d) => new Date(d).toISOString();
  U.dayISO = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  U.ago = (d) => {
    const m = Math.round((Date.now() - new Date(d)) / 6e4);
    if (m < 1) return 'الآن';
    if (m < 60) return `منذ ${m} دقيقة`;
    const h = Math.round(m / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    const dd = Math.round(h / 24);
    return dd === 1 ? 'أمس' : `منذ ${dd} يوم`;
  };
  U.uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
  U.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  U.debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.initials = (name) => name.replace(/^(د\.|م\.)\s*/, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ');
  U.sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  U.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  U.norm = (s) => String(s || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْ]/g, '');
  U.match = (q, ...fields) => { const n = U.norm(q).trim(); return !n || fields.some((f) => U.norm(f).includes(n)); };
  // inside a sandboxed preview frame, printing / downloads / camera are blocked by the host
  let framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  App.framed = framed;
  App.blockedInFrame = (what) => { if (!App.framed) return false; App.ui.toast(`${what} متاح في النسخة المرفوعة على موقعكم — مش متاح في رابط المعاينة`, 'err'); return true; };
  U.csv = (filename, rows) => {
    if (App.blockedInFrame('التصدير')) return;
    const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const AV = ['#0f8b8d', '#3b5bdb', '#d97706', '#7c3aed', '#e11d48', '#0284c7', '#16a34a', '#475569'];
  U.avatarColor = (s) => AV[[...String(s)].reduce((h, c) => h + c.charCodeAt(0), 0) % AV.length];
  U.avatar = (name, cls = '') => `<span class="avatar ${cls}" style="background:${U.avatarColor(name)}">${U.esc(U.initials(name))}</span>`;

  /* ---------------- icons ---------------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/><path d="m7.5 5.5 9 5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    warehouse: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9"/><path d="M7 15h10M7 18h10"/>',
    swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
    in: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    out: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',
    barcode: '<path d="M3 5v14M6 5v14M10 5v14M12.5 5v14M16 5v14M18.5 5v14M21 5v14"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    hospital: '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><path d="M12 7v6M9 10h6"/><path d="M10 21v-4h4v4"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    truck: '<path d="M1 4h13v12H1zM14 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    up: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    down: '<path d="m3 7 6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h14v4"/><path d="M3 7v12a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="15" r="1.2"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    bone: '<path d="M17 10c.7-.7 1.6-.7 2.5-.7a2.5 2.5 0 1 0-2.5-2.5c0 .9 0 1.8-.7 2.5l-6.6 6.6c-.7.7-1.6.7-2.5.7a2.5 2.5 0 1 0 2.5 2.5c0-.9 0-1.8.7-2.5z"/>',
    hip: '<circle cx="12" cy="7" r="4"/><path d="M12 11v6"/><path d="M8 21l4-4 4 4"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    drop: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z"/>',
    puzzle: '<path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4z"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4M17 5h4"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    arrowL: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    minus: '<path d="M5 12h14"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    orders: '<path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 3h6v3H9z"/><path d="M8.5 11h7M8.5 15h7M8.5 19h4"/>',
  };
  App.icon = (name, size = 18, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.package}</svg>`;

  /* ---------------- EAN-13 ---------------- */
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  App.barcode = {
    checkDigit(code12) {
      const s = [...code12].reduce((acc, d, i) => acc + (+d) * (i % 2 ? 3 : 1), 0);
      return (10 - (s % 10)) % 10;
    },
    isValid(code) { return /^\d{13}$/.test(code) && this.checkDigit(code.slice(0, 12)) === +code[12]; },
    svg(code, { module = 2, height = 64, text = true } = {}) {
      code = String(code).replace(/\D/g, '');
      if (code.length !== 13) return `<span class="muted">الباركود مش سليم</span>`;
      const d = [...code].map(Number);
      const par = PAR[d[0]];
      let bits = '101';
      for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? L : G)[d[i]];
      bits += '01010';
      for (let i = 7; i <= 12; i++) bits += R[d[i]];
      bits += '101';
      const guard = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
      const q = 11 * module, W = bits.length * module + q * 2, H = height + (text ? 16 : 6);
      let rects = '';
      for (let i = 0; i < bits.length; i++) {
        if (bits[i] !== '1') continue;
        let w = 1; while (bits[i + w] === '1') w++;
        const long = guard.has(i);
        rects += `<rect x="${q + i * module}" y="0" width="${w * module}" height="${long ? height + 6 : height}"/>`;
        i += w - 1;
      }
      const t = text ? `<g font-family="'IBM Plex Mono',Consolas,monospace" font-size="${module * 6.5}" fill="#000" text-anchor="middle">
        <text x="${q - module * 5}" y="${H - 2}">${d[0]}</text>
        <text x="${q + module * 24}" y="${H - 2}" letter-spacing="${module * 1.6}">${code.slice(1, 7)}</text>
        <text x="${q + module * 71}" y="${H - 2}" letter-spacing="${module * 1.6}">${code.slice(7)}</text></g>` : '';
      return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="direction:ltr"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${rects}</g>${t}</svg>`;
    },
  };

  /* ---------------- charts (inline SVG, RTL time axis) ---------------- */
  const C = App.charts = {};
  const css = (v) => `var(${v})`;

  C.bars = ({ labels, series, height = 260, format = U.compact, tipFormat = U.moneyTxt, stacked = false }) => {
    const W = 720, H = height, padT = 14, padB = 30, padR = 52, padL = 8;
    const totals = labels.map((_, i) => (stacked ? U.sum(series, (s) => s.values[i]) : Math.max(...series.map((s) => s.values[i]))));
    const max = niceMax(Math.max(...totals, 1));
    const iw = W - padR - padL, ih = H - padT - padB;
    const n = labels.length, slot = iw / n;
    const groupW = Math.min(slot * 0.62, 46);
    const bw = stacked ? groupW : groupW / series.length;
    let g = '';
    const nt = tickN(max); for (let k = 0; k <= nt; k++) {
      const y = padT + ih - (ih * k) / nt;
      g += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/><text x="${W - padR + 8}" y="${y + 4}" text-anchor="start">${format((max * k) / nt)}</text>`;
    }
    labels.forEach((lab, i) => {
      // RTL: first label sits at the right edge
      const cx = W - padR - slot * (i + 0.5);
      let acc = 0;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        const h = (v / max) * ih;
        const x = stacked ? cx - bw / 2 : cx + groupW / 2 - bw * (si + 1);
        const y = stacked ? padT + ih - acc - h : padT + ih - h;
        const r = Math.min(6, bw / 2, h);
        g += `<path class="bar" fill="${s.color}" d="${roundTop(x, y, bw - (stacked ? 0 : 2), h, stacked && si < series.length - 1 ? 0 : r)}" data-tip="${U.esc(`${lab} · ${s.name}: ${tipFormat(v)}`)}"/>`;
        if (stacked) acc += h;
      });
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${U.esc(lab)}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  };

  C.area = ({ labels, values, color = css('--chart-1'), height = 220, format = U.compact, tipFormat = U.moneyTxt, id = 'a' + Math.random().toString(36).slice(2, 6) }) => {
    const W = 720, H = height, padT = 14, padB = 30, padR = 64, padL = 10;
    const max = niceMax(Math.max(...values, 1));
    const iw = W - padR - padL, ih = H - padT - padB;
    const step = iw / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [W - padR - step * i, padT + ih - (v / max) * ih]);
    let g = '';
    const nt = tickN(max); for (let k = 0; k <= nt; k++) {
      const y = padT + ih - (ih * k) / nt;
      g += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/><text x="${W - padR + 8}" y="${y + 4}">${format((max * k) / nt)}</text>`;
    }
    const line = smooth(pts);
    g += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
    g += `<path d="${line} L${pts[pts.length - 1][0]},${padT + ih} L${pts[0][0]},${padT + ih} Z" fill="url(#${id})"/>`;
    g += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
    pts.forEach(([x, y], i) => {
      g += `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="${css('--surface')}" stroke="${color}" stroke-width="2" data-tip="${U.esc(`${labels[i]}: ${tipFormat(values[i])}`)}"/>`;
      if (labels.length <= 14 || i % 2 === 0) g += `<text x="${x}" y="${H - 8}" text-anchor="middle">${U.esc(labels[i])}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  };

  C.donut = ({ segments, size = 180, thickness = 26, center = '', sub = '' }) => {
    const total = U.sum(segments, (s) => s.value) || 1;
    const r = (size - thickness) / 2, c = 2 * Math.PI * r;
    let off = 0, arcs = '';
    segments.forEach((s) => {
      const len = (s.value / total) * c;
      arcs += `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${Math.max(len - 2, 0)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})" data-tip="${U.esc(`${s.label}: ${s.tip || U.num(s.value)} (${Math.round((s.value / total) * 100)}%)`)}" style="cursor:pointer"/>`;
      off += len;
    });
    return `<div class="chart" style="width:${size}px;flex-shrink:0"><svg viewBox="0 0 ${size} ${size}"><circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>${arcs}
      <text x="50%" y="${size / 2 + 2}" text-anchor="middle" class="donut-center">${center}</text><text x="50%" y="${size / 2 + 22}" text-anchor="middle">${sub}</text></svg></div>`;
  };

  C.spark = (values, color = css('--chart-1'), w = 96, h = 34) => {
    const max = Math.max(...values), min = Math.min(...values);
    const pts = values.map((v, i) => [w - (i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${smooth(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
  };

  C.ring = (pct, size = 64, color = css('--primary'), stroke = 7) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(pct, 100));
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      <circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(p / 100) * c} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span class="ring-v">${Math.round(pct)}%</span></div>`;
  };

  function tickN(max) { const f = max / Math.pow(10, Math.floor(Math.log10(max))); return f === 5 || f === 2.5 ? 5 : 4; }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function roundTop(x, y, w, h, r) {
    if (h <= 0) return '';
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }
  function smooth(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], mx = (x0 + x1) / 2;
      d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  }

  // shared hover tooltip for any [data-tip]
  let tipEl;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (tipEl) tipEl.remove(), (tipEl = null); return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = t.getAttribute('data-tip');
  });
  document.addEventListener('mousemove', (e) => { if (tipEl) { tipEl.style.left = e.clientX + 'px'; tipEl.style.top = e.clientY + 'px'; } });

  /* ---------------- overlays ---------------- */
  const UI = App.ui = {};
  UI.modal = ({ title, icon, iconTint = 'tint-primary', body, foot = '', wide = false, drawer = false, onMount }) => {
    const ov = document.createElement('div');
    ov.className = 'overlay' + (drawer ? ' drawer-overlay' : '');
    ov.innerHTML = `<div class="${drawer ? 'drawer' : 'modal' + (wide ? ' wide' : '')}" role="dialog" aria-modal="true">
      <div class="grab" aria-hidden="true"></div>
      <div class="modal-head">${icon ? `<span class="k-ic ${iconTint}" style="display:grid;place-items:center">${App.icon(icon, 19)}</span>` : ''}
        <h3 class="grow">${title}</h3><button class="icon-btn xbtn" data-close aria-label="إغلاق">${App.icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    const appEl = document.querySelector('.app');
    const close = () => {
      ov.remove(); document.removeEventListener('keydown', onKey);
      if (!document.querySelector('.overlay .modal, .overlay .drawer')) appEl && appEl.classList.remove('sheet-open');
      if (ov._onClose) ov._onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    ov.addEventListener('mousedown', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    appEl && appEl.classList.add('sheet-open');
    // phones: drag the handle/header down to dismiss the sheet
    const sh = ov.firstElementChild;
    ov.querySelectorAll('.grab, .modal-head').forEach((h) => {
      let sy = null, dy = 0;
      h.addEventListener('pointerdown', (e) => {
        if (innerWidth > 900 || e.target.closest('button')) return;
        sy = e.clientY; dy = 0; sh.style.transition = 'none'; h.setPointerCapture(e.pointerId);
      });
      h.addEventListener('pointermove', (e) => { if (sy == null) return; dy = e.clientY - sy; sh.style.transform = `translateY(${dy > 0 ? dy : dy * 0.2}px)`; });
      const end = () => {
        if (sy == null) return; sy = null;
        if (dy > 110) { sh.style.transition = 'transform .35s var(--out)'; sh.style.transform = 'translateY(110%)'; setTimeout(close, 300); } else { sh.style.transition = ''; sh.style.transform = ''; }
      };
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
    const api = { el: ov, close, $: (s) => ov.querySelector(s), $$: (s) => [...ov.querySelectorAll(s)] };
    onMount && onMount(api);
    return api;
  };
  UI.drawer = (o) => UI.modal({ ...o, drawer: true });

  // medica toast: icon + title (+ optional line), shrinking bar, tap to dismiss; a new one replaces the old
  let toastTimer;
  UI.toast = (msg, type = 'ok', sub = '') => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const err = type === 'err';
    const col = err ? 'var(--neg)' : type === 'warn' ? 'var(--c3)' : 'var(--c5)';
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.setAttribute('role', err ? 'alert' : 'status');
    t.innerHTML = `<span class="lg" style="background:color-mix(in srgb,${col} 18%,transparent);color:${col}">${App.icon(err ? 'alert' : type === 'warn' ? 'bell' : 'check', 19, 2.2)}</span><div class="grow"><b>${msg}</b>${sub ? `<span class="t-s">${sub}</span>` : ''}</div><i class="tbar"${err ? ' style="animation-duration:5s"' : ''}></i>`;
    const bye = () => { t.classList.add('bye'); setTimeout(() => t.remove(), 400); };
    t.onclick = bye;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(bye, err ? 5000 : 3800);
  };

  /* ---------------- motion helpers ---------------- */
  // full motion unless the OS asks for less or the user picked "calm"
  App.full = () => !matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'calm';
  const fmtN = (v) => Math.round(+v || 0).toLocaleString('en-US');
  function buildOdo(el, str, start) {
    el.classList.add('od'); el.innerHTML = '<span class="sr"></span>';
    [...str].forEach((ch, i) => {
      if (/\d/.test(ch)) {
        el.insertAdjacentHTML('beforeend', `<span class="od-c" aria-hidden="true"><span class="od-s" style="transition-delay:${(str.length - i) * 40}ms;transform:translateY(-${(+(start || '')[i] || 0) * 10}%)">${'0123456789'.split('').map((d) => `<span>${d}</span>`).join('')}</span></span>`);
      } else el.insertAdjacentHTML('beforeend', `<span class="od-p" aria-hidden="true">${ch}</span>`);
    });
  }
  function setOdo(el, str) {
    const strips = el.querySelectorAll('.od-s'); let k = 0;
    el.querySelector('.sr').textContent = str;
    [...str].forEach((ch) => { if (/\d/.test(ch)) strips[k++].style.transform = `translateY(-${+ch * 10}%)`; });
  }
  /** Odometer: digits roll to the new value (plain text in calm mode); `from` lets a re-rendered number continue from its old value. */
  App.odo = (el, to, from) => {
    if (!el) return;
    const str = fmtN(to);
    if (!App.full()) { el.classList.remove('od'); el.textContent = str; el._o = null; return; }
    if (!el._o || el._o.length !== str.length) {
      const f = from != null ? fmtN(from) : null;
      buildOdo(el, str, f && f.length === str.length ? f : null);
      void el.offsetWidth;
      // read el._o when the frame fires: a quick second change must not be overwritten by this one
      requestAnimationFrame(() => requestAnimationFrame(() => { if (el._o && el._o.length === str.length) setOdo(el, el._o); }));
    } else setOdo(el, str);
    el._o = str;
  };
  /** A small "+N" that floats up and fades next to a number. */
  App.floatUp = (el, txt) => {
    if (!el || !App.full()) return;
    const host = el.closest('.hl-v') || el.parentElement;
    host.style.position = 'relative';
    const f = document.createElement('span'); f.className = 'fup'; f.textContent = txt;
    host.appendChild(f); setTimeout(() => f.remove(), 1500);
  };
  App.confetti = (delay = 500) => {
    const cols = ['#14b8a6', '#38bdf8', '#f59e0b', '#f43f5e', '#34d399', '#5eead4'];
    return Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--r:-${70 + (i % 3) * 22}px;--c:${cols[i % 6]};animation-delay:${delay + (i % 4) * 40}ms"></i>`).join('');
  };
  App.burst = (host) => {
    if (!host || !App.full()) return;
    host.style.position = 'relative';
    const c = document.createElement('span'); c.className = 'conf'; c.innerHTML = App.confetti(0);
    host.appendChild(c); setTimeout(() => c.remove(), 1600);
  };
  // ripple on the big buttons
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.big-cta,.ghost-cta,.pbtn,.apr .btns button,.more,.btn.primary');
    if (!b || b.disabled || !App.full()) return;
    const r = b.getBoundingClientRect(), sz = Math.max(r.width, r.height) * 2.2, rp = document.createElement('span');
    rp.className = 'rip';
    rp.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px`;
    b.appendChild(rp); setTimeout(() => rp.remove(), 650);
  });

  UI.confirm = (title, text, okLabel = 'تأكيد') => new Promise((res) => {
    let done = false;
    const m = UI.modal({
      title, icon: 'alert', iconTint: 'tint-warning', body: `<p style="margin:0">${text}</p>`,
      foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-ok>${okLabel}</button>`,
    });
    m.el._onClose = () => { if (!done) res(false); };
    m.$('[data-ok]').onclick = () => { done = true; m.close(); res(true); };
  });

  UI.popover = (anchor, html, { width } = {}) => {
    document.querySelectorAll('.popover').forEach((p) => p.remove());
    const p = document.createElement('div');
    p.className = 'popover';
    if (width) p.style.width = width + 'px';
    p.innerHTML = html;
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    const left = Math.max(16, Math.min(r.left, window.innerWidth - p.offsetWidth - 16));
    p.style.top = r.bottom + 8 + 'px';
    p.style.left = left + 'px';
    setTimeout(() => {
      const off = (e) => { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    });
    return p;
  };
})(window.App);
