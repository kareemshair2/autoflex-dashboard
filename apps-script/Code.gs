/**
 * AutoFlex Dashboard - Google Apps Script API
 * =============================================
 * مصدر البيانات: تب "all" (جداول Google/FORM).
 * الاستخدام:
 *   GET  .../exec?action=sheets         -> قائمة التبويبات
 *   GET  .../exec?action=all            -> كل بيانات تب "all" كـ JSON
 *   GET  .../exec?action=all&sheet=NAME -> قراءة تبويب آخر بأي اسم
 *   GET  .../exec?refresh=1             -> تجاوز الكاش (Cache)
 *
 * ملاحظات التصميم:
 *  - أرقام تبقى أرقامًا (حتى لا نكسر قیم مثل "سعرها / المبلغ / السعر").
 *  - خلايا من نوع Date تتحول إلى ISO: "2026-09-06" أو "2026-09-06T22:31:00".
 *  - النصوص تُنظَّف من المسافات الزائدة فقط (بدون تعديل المحتوى).
 *  - القيم الفارغة تُشحن كسلسلة فارغة "".
 */

var CONFIG = {
  ALL_SHEET: 'all',
  CACHE_SECONDS: 60,
  MAX_ROWS: 50000 // سقف أمان لحجم الاستجابة
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params['action'] || 'all';
  var bypassCache = params['refresh'] === '1';

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'home') {
      return jsonOutput({ ok: true, message: 'AutoFlex Dashboard API.' });
    }

    if (action === 'sheets') {
      var names = ss.getSheets().map(function (s) { return { id: s.getSheetId(), name: s.getName() }; });
      return jsonOutput({ ok: true, sheets: names });
    }

    // action = 'all' (افتراضي) - مع دعم sheet=NAME
    var sheetName = params['sheet'] || CONFIG.ALL_SHEET;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonOutput({ ok: false, error: 'Sheet not found: ' + sheetName });
    }

    var key = 'autoflex_' + sheetName + '_v1';
    if (!bypassCache) {
      var cached = CacheService.getScriptCache().get(key);
      if (cached) {
        var parsed = JSON.parse(cached);
        parsed.fromCache = true;
        return jsonOutput(parsed);
      }
    }

    var lastRow = Math.min(sheet.getLastRow(), CONFIG.MAX_ROWS);
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) {
      return jsonOutput({ ok: true, source: 'sheet:' + sheetName, generatedAt: new Date().toISOString(), sheets: [] });
    }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = [];
    for (var c = 0; c < values[0].length; c++) {
      headers.push(cleanString(values[0][c]));
    }

    var rows = [];
    var actualCols = headers.length;
    for (var r = 1; r < values.length; r++) {
      var row = [];
      var empty = true;
      for (var c2 = 0; c2 < actualCols; c2++) {
        var raw = values[r][c2];
        var cell = normalizeCell(raw);
        row.push(cell);
        if (cell !== '') empty = false;
      }
      if (empty) continue; // تجاهل الصفوف الفارغة نهائيًا
      rows.push(row);
    }

    var payload = {
      ok: true,
      source: 'sheet:' + sheetName,
      generatedAt: new Date().toISOString(),
      sheets: [{ id: sheetName, name: sheetName, headers: headers, rows: rows }]
    };

    try {
      CacheService.getScriptCache().put(key, JSON.stringify(payload), CONFIG.CACHE_SECONDS);
    } catch (e) { /* كاش غير متاح -> نكمل بدون */ }

    return jsonOutput(payload);
  } catch (err) {
    return jsonOutput({ ok: false, error: 'فشل قراءة البيانات، حاول التحديث لاحقًا.' });
  }
}

/** تحويل الخلية إلى JSON-safe، مع الحفاظ على نوع الرقم وتحويل التواريخ لـ ISO. */
function normalizeCell(raw) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'number') {
    return isFinite(raw) ? raw : '';
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw instanceof Date) {
    var iso = toIso(raw);
    return (iso !== null) ? iso : '';
  }
  if (typeof raw === 'string') {
    return cleanString(raw);
  }
  return cleanString(String(raw));
}

function cleanString(s) {
  s = String(s);
  s = s.replace(/\s+/g, ' ').trim(); // توحيد المسافات وإزالة الزائدة
  return s;
}

function toIso(d) {
  if (isNaN(d.getTime())) return null;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var datePart = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  var hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0;
  if (hasTime) {
    return datePart + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  return datePart;
}

/* ---------- CORS-safe JSON ---------- */
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** صفحة توضيحية عند فتح URL مباشرة في المتصفح. */
function doGetHome() {
  return HtmlService.createHtmlOutput(
    '<h1>AutoFlex Dashboard API</h1>' +
    '<p>أضف بعنوان web app في <code>js/config.js</code> داخل <code>API_URL</code>.</p>' +
    '<p>مثال: <code>?action=all</code></p>'
  );
}