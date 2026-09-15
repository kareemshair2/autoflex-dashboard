/* ============================================================
 * AutoFlex Dashboard - أدوات مساعدة (تنسيق، تواريخ، أرقام، DOM)
 * ============================================================ */
(function () {
  'use strict';

  var C = window.APP_CONFIG;

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
        else if (k === 'checked' || k === 'disabled' || k === 'selected') node[k] = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /* ---------- أرقام ---------- */
  function toNumber(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[,\s\u066B\u066C]/g, '').trim();
    if (!s) return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function fmtNumber(n, decimals) {
    if (n == null || !isFinite(n)) return '0';
    var d = decimals == null ? 0 : decimals;
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  }

  function fmtMoney(n, decimals) {
    return fmtNumber(n, decimals) + ' ' + C.CURRENCY;
  }

  /* ---------- تواريخ ----------
     تدعم: Excel serial رقمي/نصي، ISO "2026-09-06"، ISO "2026-09-06T22:31:00" */
  function excelSerialToDate(serial) {
    var s = toNumber(serial);
    if (s <= 0) return null;
    // 25569 = الفرق بين 1899-12-30 (نقطة بداية Excel) و1970-01-01
    return new Date(Math.round((s - 25569) * 86400 * 1000));
  }

  function parseDateCell(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') return excelSerialToDate(v);
    var s = String(v).trim();
    if (!s) return null;
    // سلسلة ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      var d = new Date(s.replace(' ', 'T'));
      return isNaN(d.getTime()) ? null : d;
    }
    // رقم داخل نطاق serials المعقول (1968-2064 تقريبًا)
    if (/^\d+(\.\d+)?$/.test(s)) {
      var n = parseFloat(s);
      if (n >= 20000 && n < 60000) return excelSerialToDate(n);
      return null;
    }
    return null;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDate(d) {
    if (!d) return '—';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function fmtDateTime(d) {
    if (!d) return '—';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function monthKey(d) {
    if (!d) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function monthLabel(key) {
    if (!key) return '';
    var parts = key.split('-');
    var months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  /* ---------- نصوص ---------- */
  function normalizeText(v) {
    if (v == null) return '';
    return String(v).replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function phoneClean(v) {
    if (v == null) return '';
    return String(v).replace(/[^\d+]/g, '');
  }

  /* ---------- الخصم ----------
     يحوّل قيمة عمود Discount إلى كائن منظم:
     { kind: 'none'|'percent'|'amount'|'text', raw, value, label } */
  function parseDiscount(v) {
    var raw = normalizeText(v);
    var noneWords = ['no', 'لا', 'بدون', 'none', '0', '0%', '٠'];
    if (!raw) return { kind: 'none', raw: raw, value: 0, label: 'بدون خصم' };
    var low = raw.toLowerCase();
    if (noneWords.indexOf(low) !== -1) return { kind: 'none', raw: raw, value: 0, label: 'بدون خصم' };

    if (low.indexOf('%') !== -1 || raw.indexOf('٪') !== -1) {
      var p = parseFloat(raw.replace(/[^0-9.]/g, ''));
      return { kind: 'percent', raw: raw, value: isFinite(p) ? p : 0, label: p + '%' };
    }
    if (raw.indexOf('جنيه') !== -1) {
      var a = parseFloat(raw.replace(/[^\d.]/g, ''));
      return { kind: 'amount', raw: raw, value: isFinite(a) ? a : 0, label: fmtMoney(a) };
    }
    var t = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (isFinite(t) && t > 0) {
      return { kind: 'amount', raw: raw, value: t, label: fmtMoney(t) };
    }
    return { kind: 'text', raw: raw, value: 0, label: raw };
  }

  /* ---------- misc ---------- */
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function groupBy(list, keyFn) {
    var out = {};
    list.forEach(function (item) {
      var k = keyFn(item);
      if (k == null || k === '') k = '(بدون)';
      if (!out[k]) out[k] = 0;
      out[k]++;
    });
    return out;
  }

  function sumBy(list, valFn) {
    var total = 0;
    list.forEach(function (item) { total += toNumber(valFn(item)); });
    return total;
  }

  /* مكتبة المصغّرة للوصول العام */
  window.Utils = {
    $: $, $$: $$, el: el, pad2: pad2,
    toNumber: toNumber, fmtNumber: fmtNumber, fmtMoney: fmtMoney,
    excelSerialToDate: excelSerialToDate, parseDateCell: parseDateCell,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, monthKey: monthKey, monthLabel: monthLabel,
    normalizeText: normalizeText, escapeHtml: escapeHtml, phoneClean: phoneClean,
    parseDiscount: parseDiscount, debounce: debounce,
    groupBy: groupBy, sumBy: sumBy
  };
})();