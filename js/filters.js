/* ============================================================
 * AutoFlex Dashboard - الفلاتر العالمية
 * - تُبنى الخيارات ديناميكيًا من القيم الفعلية
 * - دعم اختيار أكثر من قيمة + بحث + نطاق زمني
 * - كل تغيير يستدعي onChange بتحديث كامل للوحة
 * ============================================================ */
(function () {
  'use strict';
  var U = window.Utils;
  var C = window.APP_CONFIG;

  var state = window.Data.newFilterState();
  var onChangeCb = null;
  var openedPanel = null;

  function uniqueSorted(values) {
    var map = {};
    values.forEach(function (v) {
      v = U.normalizeText(v);
      if (v) map[v] = 1;
    });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  }

  function setState(newState) {
    state = newState;
    markButtons();
    emit();
  }

  function update(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    markButtons();
    emit();
  }

  function emit() {
    if (onChangeCb) onChangeCb(state);
  }

  /* ---------- عناصر الـ DOM ---------- */
  function wrapper(label, controlEl, id) {
    var box = U.el('div', { class: 'filter-box' });
    if (id) box.setAttribute('id', id);
    var lbl = U.el('span', { class: 'filter-label', text: label });
    box.appendChild(lbl);
    if (controlEl) box.appendChild(controlEl);
    return box;
  }

  function textInput(id, placeholder, onInput) {
    var inp = U.el('input', { type: 'text', id: id, class: 'input input-search', placeholder: placeholder });
    inp.addEventListener('input', U.debounce(function () { onInput(inp.value.trim()); }, 250));
    return inp;
  }

  function dateInput(id, onInput) {
    var inp = U.el('input', { type: 'date', id: id, class: 'input' });
    inp.addEventListener('change', function () {
      var v = inp.value;
      onInput(v ? new Date(v + 'T00:00:00') : null);
    });
    return inp;
  }

  function closePanels() {
    if (openedPanel) {
      openedPanel.classList.remove('open');
      openedPanel = null;
    }
  }

  function multiSelect(label, id, options, current) {
    var btn = U.el('button', { type: 'button', class: 'ms-btn', 'data-for': id }, [
      U.el('span', { class: 'ms-label', text: label }),
      U.el('span', { class: 'ms-badge', text: '0' })
    ]);
    var panel = U.el('div', { class: 'ms-panel', id: id });
    panel.style.display = 'none';

    function render() {
      var sel = current();
      var opts = options();
      panel.innerHTML = '';
      if (!opts.length) {
        panel.appendChild(U.el('div', { class: 'ms-empty', text: 'لا توجد قيم' }));
      }
      opts.forEach(function (opt) {
        var checked = sel.indexOf(opt.value) !== -1;
        var item = U.el('label', { class: 'ms-item' });
        var cb = U.el('input', { type: 'checkbox', class: 'ms-cb' });
        cb.checked = checked;
        cb.dataset.value = opt.value;
        cb.addEventListener('change', function () {
          var val = cb.dataset.value;
          var arr = current().slice();
          if (cb.checked) { if (arr.indexOf(val) === -1) arr.push(val); }
          else arr = arr.filter(function (x) { return x !== val; });
          update(patchObject(id, arr));
        });
        var txt = U.el('span', { class: 'ms-text', text: opt.label });
        if (opt.count != null) txt.appendChild(U.el('span', { class: 'ms-count', text: String(opt.count) }));
        item.appendChild(cb);
        item.appendChild(txt);
        panel.appendChild(item);
      });
      var clearBtn = U.el('button', { type: 'button', class: 'ms-clear', text: 'مسح الكل' });
      var actions = U.el('div', { class: 'ms-actions' }, clearBtn);
      panel.appendChild(actions);
      clearBtn.addEventListener('click', function () { update(patchObject(id, [])); });
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      render();
      var wasOpen = panel.style.display === 'block';
      closePanels();
      if (!wasOpen) {
        panel.style.display = 'block';
        openedPanel = panel;
      }
      markButtons();
    });
    document.addEventListener('click', function (e) {
      if (panel.style.display === 'block' && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
      }
    });

    return { btn: btn, panel: panel, render: render };
  }

  function patchObject(key, value) {
    var p = {};
    p[key] = value;
    return p;
  }

  function singleSelect(label, id, options, onChange) {
    var sel = U.el('select', { class: 'input input-select', id: id });
    options.forEach(function (opt) {
      sel.appendChild(U.el('option', { value: String(opt.value), text: opt.label }));
    });
    sel.value = String(state.__singles ? state.__singles[id] : (options[0] ? options[0].value : ''));
    sel.addEventListener('change', function () {
      state.__singles = state.__singles || {};
      state.__singles[id] = sel.value;
      onChange(sel.value);
    });
    return wrapper(label, sel);
  }

  /* ---------- تهيئة ---------- */
  function init(container, cb) {
    onChangeCb = cb;
    container.innerHTML = '';

    var counts = computeOptionCounts();
    var allRecords = window.Data.records();

    /* نطاق زمني + بحث */
    var row1 = U.el('div', { class: 'filters-row filters-row-main' });
    row1.appendChild(wrapper('من تاريخ', dateInput('f-date-from', function (d) { update({ dateFrom: d }); }), 'wrap-date-from'));
    row1.appendChild(wrapper('إلى تاريخ', dateInput('f-date-to', function (d) { update({ dateTo: d }); }), 'wrap-date-to'));
    row1.appendChild(wrapper('بحث سريع', textInput('f-search', 'ابحث في كل الحقول...', function (v) { update({ search: v }); }), 'wrap-search'));
    row1.appendChild(btnActions());

    /* أبعاد متعددة */
    var row2 = U.el('div', { class: 'filters-row' });
    var fms = [
      multiSelect('نوع العملية', 'f-formtype', function () {
        return ['expense', 'supply', 'invoice', 'return']
          .map(function (t) { return { value: t, label: C.FORM_LABELS[t], count: counts.byForm[t] || 0 }; })
          .filter(function (o) { return o.count > 0; });
      }, function () { return state.formTypes; }),
      multiSelect('نوع المصروف', 'f-expense-type', function () {
        return counts.expenseTypes.map(function (v) { return { value: v, label: v, count: counts.expenseTypeCount[v] }; });
      }, function () { return state.expenseTypes; }),
      multiSelect('طريقة الدفع', 'f-supply-method', function () {
        return counts.supplyMethods.map(function (v) { return { value: v, label: v, count: counts.supplyMethodCount[v] }; });
      }, function () { return state.supplyMethods; }),
      multiSelect('Sales Person', 'f-sales-person', function () {
        return counts.salesPersons.map(function (v) { return { value: v, label: v, count: counts.personCount[v] }; });
      }, function () { return state.salesPersons; }),
      multiSelect('المحافظة', 'f-gov', function () {
        return counts.governorates.map(function (v) { return { value: v, label: v, count: counts.govCount[v] }; });
      }, function () { return state.governorates; }),
      multiSelect('التوثيق', 'f-doc', function () {
        return [
          { value: 'doc', label: 'موثق', count: counts.docCount },
          { value: 'noDoc', label: 'غير موثق', count: counts.noDocCount }
        ];
      }, function () { return state.docStatus; })
    ];
    fms.forEach(function (m) {
      m.btn.dataset.for = m.panel.id;
      var wrap = U.el('div', { class: 'ms-wrap' });
      wrap.appendChild(m.btn);
      wrap.appendChild(m.panel);
      row2.appendChild(wrap);
      m.panel.style.display = 'none';
    });

    /* خصم + زر عرض الكل */
    var row3 = U.el('div', { class: 'filters-row' });
    row3.appendChild(singleSelect('حالة الخصم', 'f-disc', [
      { value: '', label: 'كل الفواتير' },
      { value: 'none', label: 'بدون خصم' },
      { value: 'any', label: 'بخصم' }
    ], function (v) { update({ discountCategory: v }); }));

    var clearAllBtn = U.el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'مسح الفلاتر' });
    clearAllBtn.addEventListener('click', function () { reset(); });
    row3.appendChild(clearAllBtn);

    container.appendChild(row1);
    container.appendChild(row2);
    container.appendChild(row3);

    state.__singles = { 'f-disc': '' };
    markButtons();
    fetchInputsAndAttach();
  }

  function btnActions() {
    var box = U.el('div', { class: 'filter-box filter-result' });
    var count = U.el('span', { class: 'filter-count-label', text: '' });
    count.id = 'filter-count-label';
    box.appendChild(count);
    return box;
  }

  function fetchInputsAndAttach() {
    var from = document.getElementById('f-date-from');
    var to = document.getElementById('f-date-to');
    if (from && state.dateFrom) from.value = toInputVal(state.dateFrom);
    if (to && state.dateTo) to.value = toInputVal(state.dateTo);
  }

  function toInputVal(d) {
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  }

  function computeOptionCounts() {
    var recs = window.Data.records();
    var byForm = { expense: 0, supply: 0, invoice: 0, return: 0 };
    var expenseTypes = {}, supplyMethods = {}, salesPersons = {}, governorates = {};
    var docCount = 0, noDocCount = 0;
    recs.forEach(function (r) {
      byForm[r.formType] = (byForm[r.formType] || 0) + 1;
      if (r.formType === 'expense') {
        var et = U.normalizeText(r.f.expenseType);
        if (et) expenseTypes[et] = (expenseTypes[et] || 0) + 1;
      } else if (r.formType === 'supply') {
        var sm = U.normalizeText(r.f.supplyMethod);
        if (sm) supplyMethods[sm] = (supplyMethods[sm] || 0) + 1;
      } else if (r.formType === 'invoice') {
        var sp = U.normalizeText(r.f.salesPerson);
        if (sp) salesPersons[sp] = (salesPersons[sp] || 0) + 1;
        var g = U.normalizeText(r.f.governorate);
        if (g) governorates[g] = (governorates[g] || 0) + 1;
        if (U.normalizeText(r.f.docStatus) !== '') docCount++; else noDocCount++;
      }
    });
    function sortedKeys(m) { return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'ar'); }); }
    return {
      byForm: byForm,
      expenseTypes: sortedKeys(expenseTypes),
      expenseTypeCount: expenseTypes,
      supplyMethods: sortedKeys(supplyMethods),
      supplyMethodCount: supplyMethods,
      salesPersons: sortedKeys(salesPersons),
      personCount: salesPersons,
      governorates: sortedKeys(governorates),
      govCount: governorates,
      docCount: docCount, noDocCount: noDocCount
    };
  }

  function markButtons() {
    var badges = {
      'f-formtype': state.formTypes,
      'f-expense-type': state.expenseTypes,
      'f-supply-method': state.supplyMethods,
      'f-sales-person': state.salesPersons,
      'f-gov': state.governorates,
      'f-doc': state.docStatus
    };
    Object.keys(badges).forEach(function (id) {
      var btn = document.querySelector('.ms-btn[data-for="' + id + '"]');
      if (btn) {
        var badge = btn.querySelector('.ms-badge');
        var n = badges[id].length;
        badge.textContent = n ? String(n) : '0';
        badge.classList.toggle('active', n > 0);
      }
    });
    var disc = document.getElementById('f-disc');
    if (disc) disc.value = state.discountCategory || '';
    var lbl = document.getElementById('filter-count-label');
    if (lbl && window.App && window.App.currentFilteredCount != null) {
      lbl.textContent = window.App.currentFilteredCount + ' عملية';
    }
  }

  /* مسح الفلاتر */
  function reset() {
    var inputs = document.querySelectorAll('.filters-bar input');
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.type === 'text') inp.value = '';
      if (inp.type === 'date') inp.value = '';
    }
    var sel = document.getElementById('f-disc');
    if (sel) sel.value = '';
    state = window.Data.newFilterState();
    state.__singles = { 'f-disc': '' };
    checkAllFalse();
    markButtons();
    emit();
  }

  function checkAllFalse() {
    var cbs = document.querySelectorAll('.ms-panel input[type=checkbox]');
    for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;
  }

  window.Filters = {
    init: init,
    getState: function () { return state; },
    reset: reset,
    mark: markButtons,
    closePanels: closePanels
  };
})();