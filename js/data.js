/* ============================================================
 * AutoFlex Dashboard - طبقة البيانات
 * - تحويل الصفوف الخام (من API أو ملف المعاينة) إلى سجلات مرتّبة
 * - فلاتر + كل الحسابات المحلية (KPIs, charts data, quality)
 * ============================================================ */
(function () {
  'use strict';
  var U = window.Utils;
  var C = window.APP_CONFIG;

  var records = [];
  var rawAll = []; // صفوف تب "all" الخام
  var allHeaders = [];
  var returnsSheetInfo = null; // { headers, schemaMatched }

  /* ---------- بناء السجلات ---------- */
  function normalizeRow(rowArr, schema) {
    var out = {};
    var raw = {};
    schema.forEach(function (col, idx) {
      var v = rowArr[idx] != null ? rowArr[idx] : '';
      raw[col.key] = v;
      switch (col.type) {
        case 'currency':
          out[col.key] = U.toNumber(v);
          break;
        case 'date':
        case 'datetime':
          out[col.key] = U.parseDateCell(v);
          break;
        case 'image':
          out[col.key] = U.normalizeText(v);
          break;
        case 'phone':
          out[col.key] = U.normalizeText(v);
          break;
        case 'discount':
          out[col.key] = null; // يُملأ بعد اكتشاف نوع الفورم
          break;
        default:
          out[col.key] = U.normalizeText(v);
      }
    });
    return { out: out, raw: raw };
  }

  function detectFormType(rec) {
    var t = rec.out.formType;
    if (t && t !== '' && t !== 'غير محدد') {
      var low = t;
      if (low.indexOf('مصاريف') !== -1) return 'expense';
      if (low.indexOf('توريد') !== -1) return 'supply';
      if (low.indexOf('فواتير') !== -1) return 'invoice';
      if (low.indexOf('مرتجع') !== -1 || low.indexOf('استرجاع') !== -1) return 'return';
      return 'other';
    }
    var raw = rec.raw;
    if (raw.expensePrice != null && raw.expensePrice !== '' && U.toNumber(raw.expensePrice) > 0) return 'expense';
    if (raw.supplyAmount != null && raw.supplyAmount !== '' && U.toNumber(raw.supplyAmount) > 0) return 'supply';
    if (raw.invoicePrice != null && raw.invoicePrice !== '' && U.toNumber(raw.invoicePrice) > 0) return 'invoice';
    if (raw.returnPrice != null && raw.returnPrice !== '') return 'return';
    // ركن احتياطي: وجود خصائص حتى لو المبلغ 0
    if (raw.expenseType !== '' || raw.expenseDate) return 'expense';
    if (raw.supplyMethod !== '') return 'supply';
    if (raw.invoiceNumber !== '') return 'invoice';
    return 'other';
  }

  function matchReturnsTab(headers) {
    var joined = headers.join('|');
    return joined.indexOf('سبب المرتجع') !== -1 || joined.indexOf('مين استلم') !== -1;
  }

  function buildRecords() {
    records = [];
    rawAll = [];
    allHeaders = [];
    returnsSheetInfo = null;
    var db = window.Api.current();
    if (!db || !db.sheets) return;

    db.sheets.forEach(function (sheet, si) {
      var isPrimary = sheet.id === C.PRIMARY_SHEET || sheet.name === C.PRIMARY_SHEET;
      var isReturnsTab = sheet.id === C.RETURNS_SHEET || sheet.name === C.RETURNS_SHEET || matchReturnsTab(sheet.headers);

      if (isPrimary) {
        allHeaders = sheet.headers || [];
        rawAll = sheet.rows || [];
        rawAll.forEach(function (rowArr, ri) {
          var n = normalizeRow(rowArr, C.ALL_SCHEMA);
          var formType = detectFormType({ out: n.out, raw: n.raw });
          if (formType === 'other') return;
          if (formType === 'invoice') n.out.discount = U.parseDiscount(n.raw.discount);
          records.push({
            src: si, row: ri, formType: formType,
            f: n.out, raw: n.raw
          });
        });
      } else if (isReturnsTab) {
        // تبويب المرتجعات المستقل - mapping بالاسم
        var headers = (sheet.headers || []).map(function (h) { return U.normalizeText(h); });
        var schemaMap = [];
        C.RETURNS_TAB_SCHEMA.forEach(function (col) {
          var idx = -1;
          headers.forEach(function (h, i) {
            if (h.indexOf(col.headerMatch) !== -1) idx = i;
          });
          schemaMap.push({ idx: idx, col: col });
        });
        returnsSheetInfo = { headers: headers, schemaMap: schemaMap, rows: sheet.rows || [] };
        (sheet.rows || []).forEach(function (rowArr, ri) {
          var n = { out: {}, raw: {} };
          schemaMap.forEach(function (m) {
            var key = m.col.key, v = m.idx >= 0 && rowArr[m.idx] != null ? rowArr[m.idx] : '';
            n.raw[key] = v;
            if (m.col.type === 'currency') n.out[key] = U.toNumber(v);
            else if (m.col.type === 'date' || m.col.type === 'datetime') n.out[key] = U.parseDateCell(v);
            else n.out[key] = U.normalizeText(v);
          });
          var hasVal = false;
          Object.keys(n.raw).forEach(function (k) { if (String(n.raw[k]) !== '') hasVal = true; });
          if (!hasVal) return;
          records.push({
            src: si, row: ri, formType: 'return',
            f: n.out, raw: n.raw
          });
        });
      }
    });
  }

  /* ---------- التاريخ الفعّال ---------- */
  function effectiveDate(rec) {
    var key = C.DATE_BASIS[rec.formType];
    var d = rec.f[key];
    return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
  }

  function hasEffectiveDate(rec) {
    return !!effectiveDate(rec);
  }

  /* ---------- الفلترة ---------- */
  function filterRecords(list, st) {
    return list.filter(function (rec) {
      // الفورم
      if (st.formTypes.length && st.formTypes.indexOf(rec.formType) === -1) return false;
      // النطاق الزمني
      var d = effectiveDate(rec);
      if (st.dateFrom && d) {
        var f = new Date(st.dateFrom.getFullYear(), st.dateFrom.getMonth(), st.dateFrom.getDate());
        var day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (day < f) return false;
      }
      if (st.dateTo && d) {
        var t = new Date(st.dateTo.getFullYear(), st.dateTo.getMonth(), st.dateTo.getDate());
        var day2 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (day2 > t) return false;
      }
      // البحث النصي
      if (st.search) {
        var hay = '';
        Object.keys(rec.f).forEach(function (k) {
          var v = rec.f[k];
          if (v instanceof Date) hay += U.fmtDate(v) + ' ';
          else if (v != null) hay += String(v) + ' ';
        });
        if (hay.toLowerCase().indexOf(st.search.toLowerCase()) === -1) return false;
      }
      // أبعاد خاصة حسب النوع
      if (st.expenseTypes.length) {
        if (rec.formType !== 'expense') return false;
        var et = rec.f.expenseType;
        if (st.expenseTypes.indexOf(et) === -1) return false;
      }
      if (st.supplyMethods.length) {
        if (rec.formType !== 'supply') return false;
        if (st.supplyMethods.indexOf(rec.f.supplyMethod) === -1) return false;
      }
      if (st.salesPersons.length && st.salesPersons.indexOf(rec.f.salesPerson) === -1) return false;
      if (st.governorates.length && st.governorates.indexOf(rec.f.governorate) === -1) return false;
      if (st.docStatus.length) {
        var hasDoc = U.normalizeText(rec.f.docStatus) !== '';
        if (hasDoc && st.docStatus.indexOf('doc') === -1) return false;
        if (!hasDoc && st.docStatus.indexOf('noDoc') === -1) return false;
      }
      if (st.discountCategory) {
        if (rec.formType !== 'invoice') return false;
        var kind = rec.f.discount ? rec.f.discount.kind : 'none';
        if (st.discountCategory === 'any' && kind === 'none') return false;
        if (st.discountCategory === 'none' && kind !== 'none') return false;
      }
      return true;
    });
  }

  function newFilterState() {
    return {
      dateFrom: null, dateTo: null, search: '',
      formTypes: [], expenseTypes: [], supplyMethods: [],
      salesPersons: [], governorates: [], docStatus: [], discountCategory: ''
    };
  }

  /* ---------- تجميع مساعد ---------- */
  function moneyBy(list, keyFn, topN) {
    var map = {};
    list.forEach(function (rec) {
      var k = keyFn(rec);
      if (k == null || k === '') k = '(بدون)';
      if (!map[k]) map[k] = 0;
      map[k] += moneyOf(rec);
    });
    var arr = Object.keys(map).map(function (k) { return { label: k, value: map[k] }; });
    arr.sort(function (a, b) { return b.value - a.value; });
    return topN ? arr.slice(0, topN) : arr;
  }

  function countBy(list, keyFn, topN) {
    var map = {};
    list.forEach(function (rec) {
      var k = keyFn(rec);
      if (k == null || k === '') k = '(بدون)';
      if (!map[k]) map[k] = 0;
      map[k]++;
    });
    var arr = Object.keys(map).map(function (k) { return { label: k, value: map[k] }; });
    arr.sort(function (a, b) { return b.value - a.value; });
    return topN ? arr.slice(0, topN) : arr;
  }

  function moneyOf(rec) {
    switch (rec.formType) {
      case 'expense': return U.toNumber(rec.f.expensePrice);
      case 'supply': return U.toNumber(rec.f.supplyAmount);
      case 'invoice': return U.toNumber(rec.f.invoicePrice);
      case 'return': return U.toNumber(rec.f.returnPrice);
      default: return 0;
    }
  }

  /* ---------- KPIs ---------- */
  function statOf(list, money) {
    var m = list.map(money);
    var total = m.reduce(function (a, b) { return a + b; }, 0);
    return {
      count: list.length, total: total,
      avg: list.length ? total / list.length : 0,
      min: list.length ? Math.min.apply(null, m) : 0,
      max: list.length ? Math.max.apply(null, m) : 0
    };
  }

  function overallStats(recordsAll) {
    var groups = {};
    recordsAll.forEach(function (r) {
      groups[r.formType] = groups[r.formType] || [];
      groups[r.formType].push(r);
    });
    var expense = statOf(groups.expense || [], function (r) { return U.toNumber(r.f.expensePrice); });
    var supply = statOf(groups.supply || [], function (r) { return U.toNumber(r.f.supplyAmount); });
    var invoice = statOf(groups.invoice || [], function (r) { return U.toNumber(r.f.invoicePrice); });
    var returns = statOf(groups.return || [], function (r) { return U.toNumber(r.f.returnPrice); });
    var totalOps = recordsAll.length;
    var totalMoney = expense.total + supply.total + invoice.total - returns.total;
    return {
      totalOps: totalOps, totalMoney: totalMoney,
      expense: expense, supply: supply, invoice: invoice, returns: returns,
      groups: groups
    };
  }

  function invoiceStats(list) {
    var inv = list.filter(function (r) { return r.formType === 'invoice'; });
    var prices = inv.map(function (r) { return U.toNumber(r.f.invoicePrice); });
    var total = prices.reduce(function (a, b) { return a + b; }, 0);
    var count = inv.length;
    var avg = count ? total / count : 0;
    var min = count ? Math.min.apply(null, prices) : 0;
    var max = count ? Math.max.apply(null, prices) : 0;

    var withDiscount = 0, discountAmountTotal = 0, discountPercentTotal = 0, percentN = 0;
    inv.forEach(function (r) {
      var disc = r.f.discount;
      if (disc && disc.kind === 'amount') { withDiscount++; discountAmountTotal += disc.value; }
      else if (disc && disc.kind === 'percent') { withDiscount++; discountPercentTotal += disc.value; percentN++; }
    });

    var noDoc = inv.filter(function (r) { return U.normalizeText(r.f.docStatus) === ''; }).length;
    var noPhone = inv.filter(function (r) { return U.normalizeText(r.f.phone) === ''; }).length;
    var noNumber = inv.filter(function (r) { return U.normalizeText(r.f.invoiceNumber) === ''; }).length;
    var noDate = inv.filter(function (r) { return !(r.f.invoiceWorkDate instanceof Date); }).length;

    return {
      count: count, total: total, avg: avg, min: min, max: max,
      withDiscount: withDiscount, discountAmountTotal: discountAmountTotal,
      discountPercentTotal: discountPercentTotal, percentN: percentN,
      noDoc: noDoc, noPhone: noPhone, noNumber: noNumber, noDate: noDate
    };
  }

  function expenseStats(list) {
    var ex = list.filter(function (r) { return r.formType === 'expense'; });
    var vals = ex.map(function (r) { return U.toNumber(r.f.expensePrice); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    return {
      count: ex.length, total: total,
      avg: ex.length ? total / ex.length : 0,
      min: ex.length ? Math.min.apply(null, vals) : 0,
      max: ex.length ? Math.max.apply(null, vals) : 0
    };
  }

  function supplyStats(list) {
    var su = list.filter(function (r) { return r.formType === 'supply'; });
    var vals = su.map(function (r) { return U.toNumber(r.f.supplyAmount); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    return {
      count: su.length, total: total,
      avg: su.length ? total / su.length : 0,
      min: su.length ? Math.min.apply(null, vals) : 0,
      max: su.length ? Math.max.apply(null, vals) : 0
    };
  }

  function returnStats(list) {
    var re = list.filter(function (r) { return r.formType === 'return'; });
    var vals = re.map(function (r) { return U.toNumber(r.f.returnPrice); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    return {
      count: re.length, total: total,
      avg: re.length ? total / re.length : 0,
      reasons: countBy(re, function (r) { return r.f.returnReason; }),
      receivers: countBy(re, function (r) { return r.f.returnReceiver; }),
      governorates: countBy(re, function (r) { return r.f.governorate; })
    };
  }

  /* ---------- سلاسل زمنية ---------- */
  function monthlySeries(list) {
    var keys = {};
    list.forEach(function (rec) {
      var d = effectiveDate(rec);
      if (!d) return;
      var k = U.monthKey(d);
      if (!keys[k]) keys[k] = { invoice: 0, expense: 0, supply: 0, return: 0, ops: 0 };
      var m = moneyOf(rec);
      if (rec.formType === 'invoice') keys[k].invoice += m;
      else if (rec.formType === 'expense') keys[k].expense += m;
      else if (rec.formType === 'supply') keys[k].supply += m;
      else if (rec.formType === 'return') keys[k].return += m;
      keys[k].ops++;
    });
    var months = Object.keys(keys).sort();
    return {
      labels: months.map(function (k) { return U.monthLabel(k); }),
      full: months.map(function (k) { return k; }),
      invoice: months.map(function (k) { return keys[k].invoice; }),
      expense: months.map(function (k) { return keys[k].expense; }),
      supply: months.map(function (k) { return keys[k].supply; }),
      returns: months.map(function (k) { return keys[k].return; }),
      ops: months.map(function (k) { return keys[k].ops; })
    };
  }

  /* ---------- جودة البيانات ---------- */
  function qualityReport() {
    var issues = [];
    var totalRecords = records.length;
    var emptySkipped = rawAll.length - records.length;

    function push(sev, section, label, detail, count, examples) {
      issues.push({ sev: sev, section: section, label: label, detail: detail, count: count || 0, examples: (examples || []).slice(0, 6) });
    }

    if (totalRecords === 0) {
      push('high', 'عام', 'لا توجد بيانات', 'الجدول فارغ أو لم يُحمَّل.', 0, []);
      return { totalRecords: totalRecords, emptySkipped: emptySkipped, allHeaders: allHeaders, issues: issues };
    }

    // 1) اكتمال الأعمدة حسب المجموعات المستخدمة
    var colsToCheck = C.ALL_SCHEMA.filter(function (c) {
      return records.some(function (r) { return r.formType === c.group; });
    });
    colsToCheck.forEach(function (col) {
      var relevant = records.filter(function (r) { return r.formType === col.group; });
      if (!relevant.length) return;
      if (col.type === 'datetime' || col.type === 'date') return; // نُغطيها في أخطاء التواريخ
      var missing = relevant.filter(function (r) {
        var v = r.f[col.key];
        return v == null || v === '' || (typeof v === 'number' && isNaN(v));
      });
      if (missing.length) {
        push('medium', 'النقص', col.label, 'قيمة ناقصة في ' + missing.length + ' من ' + relevant.length, missing.length);
      }
    });

    // 2) أخطاء التواريخ
    C.ALL_SCHEMA.slice(0, 29).forEach(function (col) {
      if (col.type !== 'date' && col.type !== 'datetime') return;
      var relevant = records.filter(function (r) {
        return r.formType === col.group && r.raw[col.key] != null && String(r.raw[col.key]) !== '';
      });
      var bad = relevant.filter(function (r) { return !(r.f[col.key] instanceof Date); });
      if (bad.length) {
        push('medium', 'التواريخ', col.label, 'قيم لا يمكن قراءتها كتاريخ', bad.length,
          bad.map(function (r) { return String(r.raw[col.key]); }));
      }
    });

    // 3) أخطاء الأرقام
    C.ALL_SCHEMA.slice(0, 29).forEach(function (col) {
      if (col.type !== 'currency' && col.type !== 'discount') return;
      var relevant = records.filter(function (r) {
        return r.formType === col.group && r.raw[col.key] != null && String(r.raw[col.key]) !== '';
      });
      var bad = [];
      relevant.forEach(function (r) {
        var raw = String(r.raw[col.key]).trim();
        var clean = raw.replace(/[^\d.\-%]/g, '');
        if (raw !== '' && (clean === '' || isNaN(parseFloat(clean)))) bad.push(raw);
      });
      if (bad.length) {
        push('high', 'الأرقام', col.label, 'قيم غير رقمية يمكن أن تشوّه الحسابات', bad.length, bad);
      }
    });

    // 4) تكرار Timestamp
    var tsSeen = {};
    var dups = 0;
    records.forEach(function (r) {
      var k = String(r.raw.timestamp);
      if (!k) return;
      if (tsSeen[k]) dups++;
      else tsSeen[k] = 1;
    });
    if (dups) push('medium', 'التكرار', 'Timestamp', 'صفوف لها نفس وقت التسجيل', dups);

    // 5) فواتير ناقصة
    var inv = records.filter(function (r) { return r.formType === 'invoice'; });
    if (inv.length) {
      var noNum = inv.filter(function (r) { return U.normalizeText(r.f.invoiceNumber) === ''; });
      var noDoc = inv.filter(function (r) { return U.normalizeText(r.f.docStatus) === ''; });
      var noPhone = inv.filter(function (r) { return U.normalizeText(r.f.phone) === ''; });
      var noDate = inv.filter(function (r) { return !(r.f.invoiceWorkDate instanceof Date); });
      var noOwner = inv.filter(function (r) { return U.normalizeText(r.f.invoiceOwner) === ''; });
      if (noNum.length) push('medium', 'الفواتير', 'فاتورة بدون رقم', '', noNum.length);
      if (noDoc.length) push('high', 'الفواتير', 'فاتورة بدون توثيق', 'عمود "توثيق" فارغ في الداتا الحالية بالكامل', noDoc.length);
      if (noPhone.length) push('medium', 'الفواتير', 'فاتورة بدون رقم هاتف', '', noPhone.length);
      if (noDate.length) push('high', 'الفواتير', 'فاتورة بدون تاريخ عمل', '', noDate.length);
      if (noOwner.length) push('medium', 'الفواتير', 'فاتورة بدون صاحب فاتورة', '', noOwner.length);
    }

    // 6) خصم غير منتظم
    var weirdDiscounts = [];
    inv.forEach(function (r) {
      var d = r.f.discount;
      if (d && d.kind === 'text') weirdDiscounts.push(d.raw);
    });
    if (weirdDiscounts.length) {
      push('high', 'الخصم', 'خصم بصيغة غير موحدة',
        'نصوص غير قابلة للحساب (غالبًا "No" أو نصوص مفتوحة). يُعرض مع "بدون خصم" فقط لأغراض العد.',
        weirdDiscounts.length, weirdDiscounts);
    }

    // 7) محافظات مشبوهة
    var govs = {};
    inv.forEach(function (r) { var g = U.normalizeText(r.f.governorate); if (g) govs[g] = (govs[g] || 0) + 1; });
    var suspectGov = Object.keys(govs).filter(function (g) { return g.length < 3 || /^[وو]$/.test(g); });
    if (suspectGov.length) {
      push('high', 'الفواتير', 'محافظات مشبوهة', 'قيم مقطوعة أو غير مكتملة', suspectGov.length, suspectGov);
    }
    // تهجئات متغيرة (مثالان معروفان)
    var variantGov = Object.keys(govs).filter(function (g) {
      return g.indexOf('المنوفيه') !== -1 || g.indexOf('المنوفية') !== -1 || g.indexOf('الجيزه') !== -1;
    });
    if (variantGov.length > 1) {
      push('low', 'الفواتير', 'تهجئات متغيرة للمحافظة', 'نفس المحافظة بتهجئات مختلفة', variantGov.length, variantGov);
    }

    // 8) توريد بدون طريقة دفع
    var sup = records.filter(function (r) { return r.formType === 'supply'; });
    var supNoMethod = sup.filter(function (r) { return U.normalizeText(r.f.supplyMethod) === ''; });
    if (supNoMethod.length) push('medium', 'التوريد', 'توريد بدون طريقة دفع', '', supNoMethod.length);

    // 9) مرتجعات
    if (returnsSheetInfo) {
      push('low', 'المرتجعات', 'تبويب المرتجعات الحالي',
        'يوجد تبويب مرتجعات منفصل جاهز لكنه فارغ حاليًا (0 صف). تُقرأ المرتجعات من ("all" أعمدة 22-29) عند توفرها.',
        returnsSheetInfo.rows.length, []);
    }

    // 10) عمود غير معروف
    var c19 = records.filter(function (r) { return String(r.raw.column19) !== ''; });
    if (c19.length) {
      push('low', 'عام', 'Column 19', 'عمود غير معروف يحوي قيمًا؛ يجب مراجعة معناه', c19.length,
        c19.map(function (r) { return String(r.raw.column19); }));
    }

    return { totalRecords: totalRecords, emptySkipped: emptySkipped, allHeaders: allHeaders, issues: issues };
  }

  /* ---------- الواجهة العامة ---------- */
  window.Data = {
    buildRecords: buildRecords,
    records: function () { return records; },
    rawAll: function () { return rawAll; },
    allHeaders: function () { return allHeaders; },
    returnsSheetInfo: function () { return returnsSheetInfo; },
    effectiveDate: effectiveDate,
    filterRecords: filterRecords,
    newFilterState: newFilterState,
    moneyOf: moneyOf,
    moneyBy: moneyBy,
    countBy: countBy,
    overallStats: overallStats,
    invoiceStats: invoiceStats,
    expenseStats: expenseStats,
    supplyStats: supplyStats,
    returnStats: returnStats,
    monthlySeries: monthlySeries,
    qualityReport: qualityReport,
    formLabel: function (ft) { return C.FORM_LABELS[ft] || ft; }
  };
})();