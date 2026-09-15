/* ============================================================
 * AutoFlex Dashboard - المحرّك الرئيسي
 * تحميل -> تطبيع -> فلاتر -> عرض الأقسام -> تحديث تلقائي
 * ============================================================ */
(function () {
  'use strict';
  var U = window.Utils;
  var C = window.APP_CONFIG;
  var D = window.Data;
  var F = window.Filters;
  var Ch = window.Charts;
  var Tb = window.Tables;
  var $ = U.$;

  var activeTab = 'overview';
  var autoTimer = null;
  var currentFiltered = [];

  window.App = {
    currentFilteredCount: 0,
    openLightbox: openLightbox
  };

  /* ============ التهيئة ============ */
  function init() {
    bindBrand();
    bindHeader();
    bindTabs();
    bindRefresh();
    bindAutoRefresh();
    load();
  }

  /* ============ هوية الصفحة ============ */
  function bindBrand() {
    var b = C.BRAND;
    setText('#brand-name', b.name);
    setText('#brand-sub', b.subtitle);
    setText('#owner-line', b.owner + ' — ' + b.ownerTitle);
    document.title = b.name + ' — ' + b.subtitle;
  }

  function setText(sel, txt) { var n = $(sel); if (n) n.textContent = txt || ''; }

  /* ============ الهيدر ============ */
  function bindHeader() {
    var sel = $('#auto-refresh-select');
    if (sel) {
      C.AUTO_REFRESH_OPTIONS.forEach(function (o) {
        sel.appendChild(U.el('option', { value: String(o.value), text: o.label }));
      });
      sel.value = String(C.AUTO_REFRESH_DEFAULT);
    }
  }

  /* ============ التبويبات ============ */
  function bindTabs() {
    U.$$('#nav-tabs .tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    U.$$('#nav-tabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    U.$$('.section').forEach(function (s) {
      s.classList.toggle('active', s.id === 'tab-' + tab);
    });
    renderActiveCharts();
  }

  /* ============ تحميل البيانات ============ */
  async function load() {
    showLoading(true);
    try {
      await Api.loadData({ fallback: true });
      D.buildRecords();
      afterDataReady();
    } catch (err) {
      console.error('[AutoFlex] فشل التحميل:', err);
      showFatal(err && err.message ? err.message : 'تعذر تحميل البيانات.');
    }
  }

  function afterDataReady() {
    showLoading(false);
    showFatal(false);
    updateHeaderStatus();
    var bar = $('#filters-bar');
    if (!F.initialized) {
      F.init(bar, function () { renderAll(); });
      F.initialized = true;
    } else {
      F.reset();
      F.closePanels();
    }
    renderAll();
    switchTab('overview');
  }

  /* ============ التحديث اليدوي ============ */
  function bindRefresh() {
    var btn = $('#refresh-btn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var prev = Api.current();
      btn.classList.add('spinning');
      btn.disabled = true;
      try {
        await Api.refreshData({ fallback: true });
        D.buildRecords();
        afterDataReady();
      } catch (err) {
        showNotice(err && err.message ? err.message : 'تعذر التحديث، جرب لاحقًا.', 'error');
        // إبقاء البيانات القديمة للعرض
        if (prev) {
          Api.loadData({ fallback: true }).then(function () {
            D.buildRecords();
            afterDataReady();
          });
        }
      } finally {
        btn.classList.remove('spinning');
        btn.disabled = false;
      }
    });
  }

  /* ============ تحديث تلقائي ============ */
  function bindAutoRefresh() {
    var sel = $('#auto-refresh-select');
    if (!sel) return;
    sel.addEventListener('change', function () { scheduleAutoRefresh(); });
    scheduleAutoRefresh();
  }

  function scheduleAutoRefresh() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var sel = $('#auto-refresh-select');
    var v = sel ? sel.value : 'off';
    if (v === 'off' || !v) return;
    var minutes = parseInt(v, 10);
    if (!minutes || minutes <= 0) return;
    autoTimer = setInterval(function () {
      Api.refreshData({ fallback: true }).then(function () {
        D.buildRecords();
        afterDataReady();
      }).catch(function () { /* صامت - السطر القادم يحاول مرة أخرى */ });
    }, minutes * 60 * 1000);
  }

  /* ============ حالات الواجهة ============ */
  function showLoading(on) { toggle('#app-loading', on); }
  function showFatal(msg) {
    var box = $('#app-error');
    if (!box) return;
    if (typeof msg === 'string' && msg) {
      $('#app-error-msg').textContent = msg;
      toggle(box, true);
    } else {
      toggle(box, false);
    }
  }
  function showNotice(msg, kind) {
    var box = $('#app-notice');
    if (!box) return;
    box.textContent = msg;
    box.className = 'notice visible ' + (kind || 'info');
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.classList.remove('visible'); }, 6000);
  }
  function toggle(sel, on) {
    var n = typeof sel === 'string' ? $(sel) : sel;
    if (n) n.style.display = on ? '' : 'none';
  }

  function updateHeaderStatus() {
    var db = Api.current();
    var up = $('#last-updated-text');
    if (up && db) {
      var d = new Date(db.generatedAt);
      up.textContent = 'آخر تحديث: ' + (isNaN(d.getTime()) ? '—' : U.fmtDateTime(d));
    }
    var badge = $('#conn-badge');
    if (badge) {
      var mode = db ? db.mode : null;
      if (mode === 'api') {
        badge.textContent = 'بيانات حية';
        badge.className = 'conn-badge ok';
      } else if (mode === 'preview') {
        badge.textContent = 'وضع المعاينة';
        badge.className = 'conn-badge preview';
      } else {
        badge.textContent = 'غير متصل';
        badge.className = 'conn-badge bad';
      }
    }
    var notice = $('#mode-notice');
    if (notice) {
      if (mode === 'preview' && db.notice) notice.textContent = db.notice;
      else notice.textContent = '';
      toggle(notice, notice.textContent !== '');
    }
  }

  /* ============ العرض الكامل ============ */
  function renderAll() {
    var state = F.getState();
    currentFiltered = D.filterRecords(D.records(), state);
    window.App.currentFilteredCount = currentFiltered.length;
    F.mark();
    renderOverview(currentFiltered);
    renderInvoice(currentFiltered);
    renderExpense(currentFiltered);
    renderSupply(currentFiltered);
    renderReturn(currentFiltered);
    renderQuality();
    renderActiveCharts();
  }

  /* ---------- بطاقات KPI ---------- */
  function kpiGrid(container, items, colSpan) {
    var grid = U.el('div', { class: 'kpi-grid' + (colSpan ? ' kpi-grid-' + colSpan : '') });
    items.forEach(function (item) {
      var card = U.el('div', { class: 'kpi' + (item.hl ? ' kpi-hl' : '') });
      var lbl = U.el('span', { class: 'kpi-label', text: item.label });
      var val = U.el('span', { class: 'kpi-value', text: String(item.value) });
      if (item.sub) val.appendChild(U.el('small', { class: 'kpi-sub', text: item.sub }));
      card.appendChild(lbl);
      card.appendChild(val);
      if (item.note) card.appendChild(U.el('span', { class: 'kpi-note', text: item.note }));
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  function chartPanel(container, id, title, chartType) {
    var panel = U.el('div', { class: 'panel chart-panel', 'data-chart-for': id });
    var h = U.el('h3', { class: 'panel-title', text: title });
    if (chartType) h.appendChild(U.el('span', { class: 'chart-type', text: chartType }));
    panel.appendChild(h);
    panel.appendChild(U.el('div', { class: 'chart-box' }, U.el('canvas', { id: id })));
    container.appendChild(panel);
    return panel;
  }

  /* ============ قسم نظرة عامة ============ */
  function renderOverview(list) {
    var root = $('#tab-overview');
    if (!root) return;
    var overall = D.overallStats(list);

    var top = U.el('div', { class: 'section-block' });
    kpiGrid(top, [
      { label: 'إجمالي العمليات', value: U.fmtNumber(overall.totalOps), sub: 'من كل الفورم' },
      { label: 'إجمالي التوريد', value: U.fmtMoney(overall.supply.total), sub: overall.supply.count + ' عملية توريد', hl: true },
      { label: 'إجمالي المبيعات', value: U.fmtMoney(overall.invoice.total), sub: overall.invoice.count + ' فاتورة' },
      { label: 'إجمالي المصروفات', value: U.fmtMoney(overall.expense.total), sub: overall.expense.count + ' مصروف' },
      { label: 'عدد الفواتير', value: U.fmtNumber(overall.invoice.count), sub: 'بمتوسط ' + U.fmtMoney(overall.invoice.avg) },
      { label: 'صافي القيمة', value: U.fmtMoney(overall.totalMoney), sub: 'فواتير + توريد − مصروفات − مرتجعات' }
    ], 3);
    root.innerHTML = '';
    root.appendChild(top);

    var charts = U.el('div', { class: 'charts-grid charts-grid-2' });
    root.appendChild(charts);
    chartPanel(charts, 'ov-dist', 'توزيع العمليات حسب النوع', '');
    chartPanel(charts, 'ov-monthly', 'النشاط الشهري (عدد العمليات)', '');

    var tblRow = U.el('div', { class: 'section-block' });
    root.appendChild(tblRow);
    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'أحدث العمليات المسجلة' }));
    tblRow.appendChild(pnl);

    var recent = list.slice()
      .sort(function (a, b) {
        var ta = a.f.timestamp instanceof Date ? a.f.timestamp.getTime() : 0;
        var tb = b.f.timestamp instanceof Date ? b.f.timestamp.getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);
    Tb.create({
      container: pnl,
      rows: recent,
      pageSize: 8,
      columns: [
        { col: 'timestamp', label: 'وقت التسجيل', type: 'datetime' },
        { col: 'formType', label: 'النوع' },
        { col: 'detail', label: 'التفاصيل' },
        { col: 'money', label: 'القيمة' }
      ],
      customRender: function (rec, col) {
        if (col.col === 'detail') return U.escapeHtml(detailOf(rec));
        if (col.col === 'money') return U.fmtMoney(D.moneyOf(rec));
        if (col.col === 'formType') return U.escapeHtml(D.formLabel(rec.formType));
        return U.escapeHtml(U.fmtDateTime(rec.f.timestamp));
      }
    });
  }

  function detailOf(rec) {
    switch (rec.formType) {
      case 'expense': return rec.f.expenseType || '';
      case 'supply': return (rec.f.supplyMethod || '') ;
      case 'invoice': return (rec.f.invoiceOwner || '') + ' | ' + (rec.f.salesPerson || '');
      case 'return': return (rec.f.returnOwner || '') + ' | ' + (rec.f.returnReason || '');
      default: return '';
    }
  }

  /* ============ قسم الفواتير ============ */
  function renderInvoice(list) {
    var root = $('#tab-invoice');
    if (!root) return;
    var st = D.invoiceStats(list);
    var byPerson = D.moneyBy(list.filter(function (r) { return r.formType === 'invoice'; }), function (r) { return r.f.salesPerson; });
    var byGov = D.moneyBy(list.filter(function (r) { return r.formType === 'invoice'; }), function (r) { return r.f.governorate; }, 8);

    var block = U.el('div', { class: 'section-block' });
    kpiGrid(block, [
      { label: 'إجمالي الفواتير', value: U.fmtMoney(st.total), sub: '', hl: true },
      { label: 'عدد الفواتير', value: U.fmtNumber(st.count) },
      { label: 'متوسط قيمة الفاتورة', value: U.fmtMoney(st.avg) },
      { label: 'أعلى فاتورة', value: U.fmtMoney(st.max) },
      { label: 'بخصم', value: U.fmtNumber(st.withDiscount), sub: st.percentN ? st.percentN + ' نسبة مئوية' : '' },
      { label: 'بدون توثيق', value: U.fmtNumber(st.noDoc), sub: 'بدون هاتف: ' + st.noPhone, note: 'التوثيق فارغ في الداتا الحالية' }
    ], 3);
    root.innerHTML = '';
    root.appendChild(block);

    var charts = U.el('div', { class: 'charts-grid charts-grid-2' });
    root.appendChild(charts);
    chartPanel(charts, 'inv-trend', 'المبيعات عبر الزمن (بالشهر)', 'خط زمني');
    chartPanel(charts, 'inv-person', 'المبيعات حسب Sales Person', 'أفقي');
    chartPanel(charts, 'inv-gov', 'المبيعات حسب المحافظة (أعلى 8)', 'أفقي');
    chartPanel(charts, 'inv-disc', 'حالة الخصم', '');

    var tblBlock = U.el('div', { class: 'section-block' });
    root.appendChild(tblBlock);
    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'جدول الفواتير' }));
    tblBlock.appendChild(pnl);
    Tb.create({
      container: pnl,
      rows: list.filter(function (r) { return r.formType === 'invoice'; }),
      pageSize: 10,
      columns: C.TABLES.invoice
    });

    if (!list.some(function (r) { return r.formType === 'invoice'; })) {
      root.appendChild(emptyState('لا توجد فواتير مطابقة للفلاتر الحالية.'));
    }
    // بيانات إضافية للرسوم(المحفوظة للاستخدام)
    window.__invData = { byPerson: byPerson, byGov: byGov };
  }

  /* ============ قسم المصاريف ============ */
  function renderExpense(list) {
    var root = $('#tab-expense');
    if (!root) return;
    var st = D.expenseStats(list);
    var ex = list.filter(function (r) { return r.formType === 'expense'; });
    var byType = D.moneyBy(ex, function (r) { return r.f.expenseType; }, 12);

    var block = U.el('div', { class: 'section-block' });
    kpiGrid(block, [
      { label: 'إجمالي المصروفات', value: U.fmtMoney(st.total), hl: true },
      { label: 'عدد المصروفات', value: U.fmtNumber(st.count) },
      { label: 'متوسط المصروف', value: U.fmtMoney(st.avg) },
      { label: 'أعلى مصروف', value: U.fmtMoney(st.max) },
      { label: 'أقل مصروف', value: U.fmtMoney(st.min) },
      { label: 'أنواع المصروفات', value: U.fmtNumber(byType.length), sub: 'قيمة مختلفة' }
    ], 3);
    root.innerHTML = '';
    root.appendChild(block);

    var charts = U.el('div', { class: 'charts-grid charts-grid-2' });
    root.appendChild(charts);
    chartPanel(charts, 'xp-top', 'أعلى أنواع المصروفات (12)', 'أفقي');
    chartPanel(charts, 'xp-trend', 'المصروفات عبر الزمن (بالشهر)', 'خط زمني');

    var tblBlock = U.el('div', { class: 'section-block' });
    root.appendChild(tblBlock);
    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'جدول المصاريف' }));
    tblBlock.appendChild(pnl);
    Tb.create({ container: pnl, rows: ex, pageSize: 10, columns: C.TABLES.expense });

    if (!ex.length) root.appendChild(emptyState('لا توجد مصاريف مطابقة للفلاتر الحالية.'));
    window.__xpData = { byType: byType };
  }

  /* ============ قسم التوريد ============ */
  function renderSupply(list) {
    var root = $('#tab-supply');
    if (!root) return;
    var st = D.supplyStats(list);
    var su = list.filter(function (r) { return r.formType === 'supply'; });
    var byMethod = D.moneyBy(su, function (r) { return r.f.supplyMethod; });

    var block = U.el('div', { class: 'section-block' });
    kpiGrid(block, [
      { label: 'إجمالي التوريد', value: U.fmtMoney(st.total), hl: true },
      { label: 'عدد العمليات', value: U.fmtNumber(st.count) },
      { label: 'متوسط التوريد', value: U.fmtMoney(st.avg) },
      { label: 'أكبر عملية', value: U.fmtMoney(st.max) },
      { label: 'أصغر عملية', value: U.fmtMoney(st.min) },
      { label: 'طرق الدفع', value: U.fmtNumber(byMethod.length) }
    ], 3);
    root.innerHTML = '';
    root.appendChild(block);

    var charts = U.el('div', { class: 'charts-grid charts-grid-2' });
    root.appendChild(charts);
    chartPanel(charts, 'sp-method', 'التوريد حسب طريقة الدفع', '');
    chartPanel(charts, 'sp-trend', 'التوريد عبر الزمن (بالشهر)', 'خط زمني');

    var tblBlock = U.el('div', { class: 'section-block' });
    root.appendChild(tblBlock);
    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'جدول التوريد' }));
    tblBlock.appendChild(pnl);
    Tb.create({ container: pnl, rows: su, pageSize: 10, columns: C.TABLES.supply });

    if (!su.length) root.appendChild(emptyState('لا توجد توريدات مطابقة للفلاتر الحالية.'));
    window.__spData = { byMethod: byMethod };
  }

  /* ============ قسم المرتجعات ============ */
  function renderReturn(list) {
    var root = $('#tab-return');
    if (!root) return;
    var st = D.returnStats(list);
    var re = list.filter(function (r) { return r.formType === 'return'; });
    root.innerHTML = '';

    if (!re.length) {
      root.appendChild(emptyState(
        'لا توجد بيانات مرتجعات حالياً.',
        'التبويب "المرتجعات" جاهز لاستقبال الحالات (من تب "all" أو تبويب "المرتجعات" المنفصل).' +
        (D.returnsSheetInfo() ? ' — تم رصد تبويب مرتجعات منفصل وقراءته تلقائيًا عند توفر البيانات.' : '') +
        ' الحقول المدعومة: رقم الفاتورة، القيمة، التاريخ، صاحب الفاتورة، السبب، الجهة المستلمة.'
      ));
      if (D.returnsSheetInfo()) {
        var info = D.returnsSheetInfo();
        var card = U.el('div', { class: 'panel return-schema-panel' });
        card.appendChild(U.el('h3', { class: 'panel-title', text: 'بنية تبويب المرتجعات (جاهزة)' }));
        var ul = U.el('ul', { class: 'schema-list' });
        C.RETURNS_TAB_SCHEMA.forEach(function (col) {
          ul.appendChild(U.el('li', {}, U.el('span', { class: 'schema-key', text: col.label })));
        });
        card.appendChild(ul);
        root.appendChild(card);
      }
      return;
    }

    var block = U.el('div', { class: 'section-block' });
    kpiGrid(block, [
      { label: 'عدد المرتجعات', value: U.fmtNumber(st.count), hl: true },
      { label: 'إجمالي قيمة المرتجعات', value: U.fmtMoney(st.total) },
      { label: 'متوسط قيمة المرتجع', value: U.fmtMoney(st.avg) }
    ]);
    root.appendChild(block);

    var charts = U.el('div', { class: 'charts-grid charts-grid-2' });
    root.appendChild(charts);
    chartPanel(charts, 'rt-reason', 'أسباب المرتجع', 'أفقي');
    chartPanel(charts, 'rt-receiver', 'الجهة المستلمة للمرتجع', 'أفقي');

    var tblBlock = U.el('div', { class: 'section-block' });
    root.appendChild(tblBlock);
    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'جدول المرتجعات' }));
    tblBlock.appendChild(pnl);
    Tb.create({ container: pnl, rows: re, pageSize: 10, columns: C.TABLES.return });
    window.__rtData = { reasons: st.reasons, receivers: st.receivers };
  }

  /* ============ قسم جودة البيانات ============ */
  function renderQuality() {
    var root = $('#tab-quality');
    if (!root) return;
    var q = D.qualityReport();
    root.innerHTML = '';

    var block = U.el('div', { class: 'section-block' });
    kpiGrid(block, [
      { label: 'عدد السجلات المحمّلة', value: U.fmtNumber(q.totalRecords) },
      { label: 'صفوف فارغة متجاهلة', value: U.fmtNumber(q.emptySkipped) },
      { label: 'مشاكل', value: U.fmtNumber(q.issues.length) },
      { label: 'مشاكل عالية', value: U.fmtNumber(q.issues.filter(function (i) { return i.sev === 'high'; }).length) },
      { label: 'مشاكل متوسطة', value: U.fmtNumber(q.issues.filter(function (i) { return i.sev === 'medium'; }).length) }
    ]);
    root.appendChild(block);

    var pnl = U.el('div', { class: 'panel' });
    pnl.appendChild(U.el('h3', { class: 'panel-title', text: 'تقرير المشاكل (' + q.issues.length + ')' }));
    if (!q.issues.length) {
      pnl.appendChild(U.el('p', { class: 'quality-empty', text: 'لا توجد مشاكل جوهرية في البيانات الحالية.' }));
    } else {
      var table = U.el('table', { class: 'quality-table' });
      var thead = U.el('thead', {}, U.el('tr', {}, [
        U.el('th', { text: 'الأولوية' }), U.el('th', { text: 'المجموعة' }),
        U.el('th', { text: 'الوصف' }), U.el('th', { text: 'التفاصيل' }),
        U.el('th', { text: 'العدد' }), U.el('th', { text: 'أمثلة' })
      ]));
      table.appendChild(thead);
      var tbody = U.el('tbody');
      q.issues.forEach(function (iss) {
        var tr = U.el('tr');
        var levels = { high: 'عالي', medium: 'متوسط', low: 'منخفض' };
        tr.appendChild(U.el('td', {}, U.el('span', { class: 'qlv qlv-' + iss.sev, text: levels[iss.sev] || iss.sev })));
        tr.appendChild(U.el('td', { text: iss.section }));
        tr.appendChild(U.el('td', { text: iss.label }));
        tr.appendChild(U.el('td', { text: iss.detail || '—' }));
        tr.appendChild(U.el('td', { text: U.fmtNumber(iss.count) }));
        tr.appendChild(U.el('td', { text: (iss.examples || []).join('، ') || '—' }));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      pnl.appendChild(table);
    }
    root.appendChild(pnl);

    var note = U.el('p', { class: 'quality-note',
      text: 'الداشبورد يعرض فقط ولا يعدّل البيانات الأصلية. أي مشكلة من المفترض معالجتها من مصدر البيانات (Google Sheets).' });
    root.appendChild(note);
  }

  function emptyState(title, sub) {
    var box = U.el('div', { class: 'empty-state' });
    box.appendChild(U.el('h3', { class: 'empty-title', text: title }));
    if (sub) box.appendChild(U.el('p', { class: 'empty-sub', text: sub }));
    return box;
  }

  /* ============ الرسوم ============ */
  function renderActiveCharts() {
    var pal = Ch.palette();
    switch (activeTab) {
      case 'overview':
        renderDist();
        renderMonthly();
        break;
      case 'invoice':
        renderInvTrend();
        renderInvPerson();
        renderInvGov();
        renderInvDisc();
        break;
      case 'expense':
        renderXpTop();
        renderXpTrend();
        break;
      case 'supply':
        renderSpMethod();
        renderSpTrend();
        break;
      case 'return':
        renderRtCharts();
        break;
    }
  }

  function renderDist() {
    var arr = D.countBy(currentFiltered, function (r) { return D.formLabel(r.formType); });
    var pal = Ch.palette();
    Ch.render('ov-dist', {
      type: 'doughnut',
      data: {
        labels: arr.map(function (a) { return a.label; }),
        datasets: [{
          data: arr.map(function (a) { return a.value; }),
          backgroundColor: arr.map(function (_, i) { return pal[i % pal.length]; }),
          borderWidth: 2, borderColor: C.COLORS.cream
        }]
      },
      options: Ch.baseOptions({ cutout: '62%', plugins: { legend: { position: 'right' } } })
    });
  }

  function renderMonthly() {
    var s = D.monthlySeries(currentFiltered);
    Ch.render('ov-monthly', {
      type: 'bar',
      data: {
        labels: s.labels,
        datasets: [Ch.barDataset('عمليات', s.ops, C.COLORS.blue)]
      },
      options: Ch.baseOptions({ scales: { y: { beginAtZero: true, grid: { color: C.COLORS.line }, ticks: { precision: 0 } } } })
    });
  }

  function renderInvTrend() {
    var s = D.monthlySeries(currentFiltered);
    Ch.render('inv-trend', {
      type: 'line',
      data: {
        labels: s.labels,
        datasets: [Ch.lineDataset('المبيعات', s.invoice, C.COLORS.blue)]
      },
      options: Ch.baseOptions({ scales: { y: { beginAtZero: true, grid: { color: C.COLORS.line } } } })
    });
  }

  function renderInvPerson() {
    var arr = (window.__invData && window.__invData.byPerson) || [];
    if (!arr.length) { Ch.destroy('inv-person'); return; }
    Ch.render('inv-person', {
      type: 'bar',
      data: { labels: arr.map(function (a) { return a.label; }), datasets: [Ch.barDataset('القيمة', arr.map(function (a) { return a.value; }), C.COLORS.orange)] },
      options: Ch.baseOptions({ indexAxis: 'y', scales: { x: { grid: { color: C.COLORS.line } } } })
    });
  }

  function renderInvGov() {
    var arr = (window.__invData && window.__invData.byGov) || [];
    if (!arr.length) { Ch.destroy('inv-gov'); return; }
    Ch.render('inv-gov', {
      type: 'bar',
      data: { labels: arr.map(function (a) { return a.label; }), datasets: [Ch.barDataset('القيمة', arr.map(function (a) { return a.value; }), C.COLORS.blueSoft)] },
      options: Ch.baseOptions({ indexAxis: 'y', scales: { x: { grid: { color: C.COLORS.line } } } })
    });
  }

  function renderInvDisc() {
    var inv = currentFiltered.filter(function (r) { return r.formType === 'invoice'; });
    var counts = { none: 0, percent: 0, amount: 0, text: 0 };
    inv.forEach(function (r) { counts[r.f.discount ? r.f.discount.kind : 'none']++; });
    var labels = { none: 'بدون خصم', percent: 'نسبة مئوية', amount: 'مبلغ ثابت', text: 'غير محدد' };
    var keys = Object.keys(counts);
    Ch.render('inv-disc', {
      type: 'doughnut',
      data: {
        labels: keys.map(function (k) { return labels[k]; }),
        datasets: [{
          data: keys.map(function (k) { return counts[k]; }),
          backgroundColor: [C.COLORS.blue, C.COLORS.orange, C.COLORS.good, C.COLORS.bad],
          borderWidth: 2, borderColor: C.COLORS.cream
        }]
      },
      options: Ch.baseOptions({ cutout: '62%', plugins: { legend: { position: 'right' } } })
    });
  }

  function renderXpTop() {
    var arr = (window.__xpData && window.__xpData.byType) || [];
    if (!arr.length) { Ch.destroy('xp-top'); return; }
    Ch.render('xp-top', {
      type: 'bar',
      data: { labels: arr.map(function (a) { return a.label; }), datasets: [Ch.barDataset('القيمة', arr.map(function (a) { return a.value; }), C.COLORS.orange)] },
      options: Ch.baseOptions({ indexAxis: 'y', scales: { x: { grid: { color: C.COLORS.line } } } })
    });
  }

  function renderXpTrend() {
    var s = D.monthlySeries(currentFiltered);
    Ch.render('xp-trend', {
      type: 'line',
      data: { labels: s.labels, datasets: [Ch.lineDataset('المصروفات', s.expense, C.COLORS.orangeDark)] },
      options: Ch.baseOptions({ scales: { y: { beginAtZero: true, grid: { color: C.COLORS.line } } } })
    });
  }

  function renderSpMethod() {
    var arr = (window.__spData && window.__spData.byMethod) || [];
    if (!arr.length) { Ch.destroy('sp-method'); return; }
    var pal = Ch.palette();
    Ch.render('sp-method', {
      type: 'doughnut',
      data: {
        labels: arr.map(function (a) { return a.label; }),
        datasets: [{
          data: arr.map(function (a) { return a.value; }),
          backgroundColor: arr.map(function (_, i) { return pal[i % pal.length]; }),
          borderWidth: 2, borderColor: C.COLORS.cream
        }]
      },
      options: Ch.baseOptions({ cutout: '62%', plugins: { legend: { position: 'right' } } })
    });
  }

  function renderSpTrend() {
    var s = D.monthlySeries(currentFiltered);
    Ch.render('sp-trend', {
      type: 'line',
      data: { labels: s.labels, datasets: [Ch.lineDataset('التوريد', s.supply, C.COLORS.blue)] },
      options: Ch.baseOptions({ scales: { y: { beginAtZero: true, grid: { color: C.COLORS.line } } } })
    });
  }

  function renderRtCharts() {
    var rt = window.__rtData;
    if (!rt || !rt.reasons.length) { Ch.destroy('rt-reason'); Ch.destroy('rt-receiver'); return; }
    Ch.render('rt-reason', {
      type: 'bar',
      data: { labels: rt.reasons.map(function (a) { return a.label; }), datasets: [Ch.barDataset('العدد', rt.reasons.map(function (a) { return a.value; }), C.COLORS.blue)] },
      options: Ch.baseOptions({ indexAxis: 'y', scales: { x: { grid: { color: C.COLORS.line } } } })
    });
    Ch.render('rt-receiver', {
      type: 'bar',
      data: { labels: rt.receivers.map(function (a) { return a.label; }), datasets: [Ch.barDataset('العدد', rt.receivers.map(function (a) { return a.value; }), C.COLORS.orange)] },
      options: Ch.baseOptions({ indexAxis: 'y', scales: { x: { grid: { color: C.COLORS.line } } } })
    });
  }

  /* ============ Lightbox ============ */
  function openLightbox(src) {
    var lb = $('#lightbox');
    if (!lb) return;
    var img = $('#lightbox-img');
    img.src = src;
    toggle(lb, true);
    document.body.classList.add('lb-open');
  }
  function closeLightbox() {
    var lb = $('#lightbox');
    if (lb) toggle(lb, false);
    document.body.classList.remove('lb-open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    var lb = $('#lightbox');
    if (lb) lb.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
  });

  /* وصول عام للاختبار */
  window.DashboardApp = { init: init, renderAll: renderAll, switchTab: switchTab };
})();