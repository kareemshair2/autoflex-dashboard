/* ============================================================
 * AutoFlex Dashboard - طبقة الاتصال بالبيانات
 * - تحميل مرة واحدة وتخزينها في الذاكرة (window.DB)
 * - التعامل مع: API غير متاح، Network error، JSON خاطئ، Sheet فارغ
 * - عند عدم وجود API_URL أو فشله -> معاينة الملف الثابت
 * ============================================================ */
(function () {
  'use strict';

  var DB = null;

  function buildApiUrl() {
    var cfg = window.APP_CONFIG;
    if (!cfg.API_URL) return null;
    var sep = cfg.API_URL.indexOf('?') === -1 ? '?' : '&';
    return cfg.API_URL + sep + 'action=all&v=' + Date.now();
  }

  function validatePayload(json) {
    if (!json || json.ok !== true) throw new Error('API returned error');
    if (!Array.isArray(json.sheets) || json.sheets.length === 0) throw new Error('no sheets');
    var s = json.sheets[0];
    if (!Array.isArray(s.rows) || !Array.isArray(s.headers)) throw new Error('bad sheet shape');
    return true;
  }

  async function fetchJson(url) {
    var controller = null;
    var timeoutMs = 30000;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    }
    var opts = { method: 'GET', headers: { 'Accept': 'application/json' } };
    if (controller) opts.signal = controller.signal;
    try {
      var res = await fetch(url, opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var text = await res.text();
      var json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
      validatePayload(json);
      return json;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* تحميل البيانات الرئيسي (مرة واحدة عند فتح الصفحة) */
  async function loadData(prefs) {
    var apiUrl = buildApiUrl();
    var lastError = '';
    if (apiUrl) {
      try {
        DB = await fetchJson(apiUrl);
        DB.mode = 'api';
        return DB;
      } catch (err) {
        lastError = err && err.message ? err.message : String(err);
        if (!prefs || prefs.fallback === true) {
          return loadFallback('تعذر الاتصال بالبيانات الحية، جاري عرض المعاينة. (' + lastError + ')');
        }
        DB = null;
        throw new Error('تعذر تحميل البيانات، حاول التحديث مرة أخرى.');
      }
    }
    return loadFallback('');
  }

  async function loadFallback(notice) {
    var cfg = window.APP_CONFIG;
    try {
      var res = await fetch(cfg.MOCK_DATA_URL + '?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var json;
      try { json = await res.json(); } catch (e) { throw new Error('Invalid JSON'); }
      validatePayload(json);
      json.mode = 'preview';
      json.notice = notice || (cfg.MOCK_LABEL ? cfg.MOCK_LABEL : '');
      json.generatedAt = json.generatedAt || new Date().toISOString();
      DB = json;
      return DB;
    } catch (err) {
      DB = null;
      throw new Error('تعذر تحميل البيانات من أي مصدر. تأكد من وجود ملف المعاينة أو من صحة رابط API.');
    }
  }

  /* إعادة التحميل بواسطة زر "تحديث الآن" */
  async function refreshData(opts) {
    if (DB && DB.mode === 'api') {
      return loadData(opts); // يجلب نسخة جديدة من Google Sheets
    }
    // وضع المعاينة -> يعيد تحميل الملف الثابت فقط
    return loadData(opts);
  }

  function current() { return DB; }

  window.Api = {
    loadData: loadData,
    refreshData: refreshData,
    current: current,
    hasData: function () { return !!(DB && DB.sheets && DB.sheets.length); }
  };
})();