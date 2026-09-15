/* ============================================================
 * AutoFlex Dashboard - جدول تفاعلي
 * بحث + فرز + ترقيم صفحات + إظهار/إخفاء أعمدة + صور مصغّرة
 * ============================================================ */
(function () {
  'use strict';
  var U = window.Utils;

  var instances = {};

  function cellValue(rec, colDef, customRender) {
    if (customRender) {
      var custom = customRender(rec, colDef);
      if (custom !== undefined && custom !== null) return custom;
    }
    var v = rec.f[colDef.col];
    var t = colDef.type || fieldType(colDef.col);
    switch (t) {
      case 'currency':
        return U.fmtMoney(U.toNumber(v));
      case 'date':
        return U.fmtDate(v);
      case 'datetime':
        return U.fmtDateTime(v);
      case 'image':
        return v;
      case 'phone':
        return v;
      case 'discount':
        return rec.f.discount ? rec.f.discount.label : '—';
      default:
        return v == null ? '' : String(v);
    }
  }

  function fieldType(key) {
    var col = window.APP_CONFIG.ALL_SCHEMA.filter(function (c) { return c.key === key; })[0];
    return col ? col.type : 'text';
  }

  function create(opts) {
    var id = opts.id || ('tbl-' + Math.random().toString(36).slice(2, 8));
    var container = opts.container;
    var rows = opts.rows || [];
    var pageSize = opts.pageSize || 10;
    var columns = opts.columns || [];
    var search = '';
    var sortCol = null, sortDir = 1;
    var page = 1;
    var visibleCols = columns.map(function (c) { return c.col; });

    instances[id] = null;

    var root = U.el('div', { class: 'dg-table' });
    container.innerHTML = '';
    container.appendChild(root);

    /* شريط الأدوات */
    var bar = U.el('div', { class: 'tbl-toolbar' });
    var info = U.el('span', { class: 'tbl-info', text: '' });
    var searchInp = U.el('input', { type: 'text', class: 'input input-search tbl-search', placeholder: 'بحث داخل الجدول...' });
    var colsBtn = U.el('button', { type: 'button', class: 'btn btn-ghost btn-sm tbl-cols-btn', text: 'الأعمدة ▾' });
    var colsPanel = U.el('div', { class: 'ms-panel tbl-cols-panel' });
    colsPanel.style.display = 'none';
    searchInp.addEventListener('input', U.debounce(function () { search = searchInp.value.trim().toLowerCase(); page = 1; draw(); }, 200));
    colsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var show = colsPanel.style.display === 'block';
      U.$$('.tbl-cols-panel').forEach(function (p) { p.style.display = 'none'; });
      colsPanel.style.display = show ? 'none' : 'block';
      window.Filters && window.Filters.closePanels();
    });
    function renderColToggle() {
      colsPanel.innerHTML = '';
      columns.forEach(function (c) {
        var item = U.el('label', { class: 'ms-item' });
        var cb = U.el('input', { type: 'checkbox', class: 'ms-cb' });
        cb.checked = visibleCols.indexOf(c.col) !== -1;
        cb.addEventListener('change', function () {
          if (cb.checked) visibleCols.push(c.col);
          else visibleCols = visibleCols.filter(function (x) { return x !== c.col; });
          draw();
        });
        item.appendChild(cb);
        item.appendChild(U.el('span', { class: 'ms-text', text: c.label }));
        colsPanel.appendChild(item);
      });
    }
    renderColToggle();
    bar.appendChild(info);
    bar.appendChild(searchInp);
    bar.appendChild(colsBtn);
    bar.appendChild(colsPanel);
    root.appendChild(bar);
    document.addEventListener('click', function (e) {
      if (colsPanel.style.display === 'block' && !colsPanel.contains(e.target) && e.target !== colsBtn) {
        colsPanel.style.display = 'none';
      }
    });

    var scrollWrap = U.el('div', { class: 'tbl-scroll' });
    root.appendChild(scrollWrap);

    function hasRealField(col) {
      return Object.keys((rows[0] && rows[0].f) || {}).indexOf(col.col) !== -1;
    }

    function filteredSorted() {
      var list = rows.slice();
      if (search) {
        list = list.filter(function (rec) {
          var text = columns.map(function (c) { return cellValue(rec, c, opts.customRender); }).join(' ').toLowerCase();
          return text.indexOf(search) !== -1;
        });
      }
      var sortColDef = columns.filter(function (c) { return c.col === sortCol; })[0] || null;
      if (sortCol && sortColDef && hasRealField(sortColDef)) {
        var t = fieldType(sortCol);
        list.sort(function (a, b) {
          if (t === 'text' || t === 'id' || t === 'phone' || t === 'datetime' || t === 'date') {
            return String(cellValue(a, sortColDef, opts.customRender)).localeCompare(
              String(cellValue(b, sortColDef, opts.customRender)), 'ar') * sortDir;
          }
          return (U.toNumber(a.f[sortCol]) - U.toNumber(b.f[sortCol])) * sortDir;
        });
      }
      return list;
    }

    function draw() {
      var list = filteredSorted();
      var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
      if (page > totalPages) page = totalPages;
      var start = (page - 1) * pageSize;
      var pageRows = list.slice(start, start + pageSize);

      info.textContent = 'إجمالي ' + list.length + ' عملية' + (list.length ? ' — عرض ' + start + ' إلى ' + (start + pageRows.length) : '');

      var table = U.el('table', { class: 'tbl' });
      var thead = U.el('thead');
      var trh = U.el('tr');
      var shown = columns.filter(function (c) { return visibleCols.indexOf(c.col) !== -1; });
      shown.forEach(function (c) {
        var th = U.el('th');
        var btn = U.el('button', { type: 'button', class: 'tbl-th', text: c.label });
        btn.dataset.col = c.col;
        if (hasRealField(c)) {
          btn.addEventListener('click', function () {
            if (sortCol === c.col) sortDir = -sortDir;
            else { sortCol = c.col; sortDir = 1; }
            draw();
          });
          if (sortCol === c.col) btn.classList.add(sortDir === 1 ? 'asc' : 'desc');
        } else {
          btn.classList.add('no-sort');
          btn.disabled = true;
        }
        th.appendChild(btn);
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      var tbody = U.el('tbody');
      if (!pageRows.length) {
        tbody.appendChild(U.el('tr', {}, U.el('td', { class: 'tbl-empty', colspan: shown.length, text: 'لا توجد نتائج مطابقة' })));
      }
      pageRows.forEach(function (rec, i) {
        var tr = U.el('tr');
        shown.forEach(function (c) {
          var td = U.el('td');
          var v = cellValue(rec, c);
          var t = c.type || fieldType(c.col);
          if (t === 'image' && v && isImage(v)) {
            td.appendChild(thumbnail(v, rec));
          } else if (t === 'currency') {
            td.appendChild(U.el('span', { class: 'tbl-money', text: v }));
          } else if (t === 'date') {
            td.appendChild(U.el('span', { class: 'tbl-date', text: v }));
          } else {
            td.textContent = v;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scrollWrap.innerHTML = '';
      scrollWrap.appendChild(table);

      /* ترقيم الصفحات */
      var pager = U.el('div', { class: 'tbl-pager' });
      var prevBtn = U.el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: '‹ السابق' });
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', function () { if (page > 1) { page--; draw(); } });
      var nextBtn = U.el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'التالي ›' });
      nextBtn.disabled = page >= totalPages;
      nextBtn.addEventListener('click', function () { if (page < totalPages) { page++; draw(); } });
      var pageLabel = U.el('span', { class: 'tbl-page', text: 'صفحة ' + page + ' من ' + totalPages });
      pager.appendChild(prevBtn);
      pager.appendChild(pageLabel);
      pager.appendChild(nextBtn);
      root.appendChild(pager);
    }

    draw();
    return {
      id: id,
      refresh: function (newRows) { rows = newRows || rows; page = 1; draw(); },
      destroy: function () { container.innerHTML = ''; }
    };
  }

  function isImage(v) {
    return /^(https?:\/\/|\/|data:image)/i.test(String(v)) && /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/i.test(String(v));
  }

  function thumbnail(src, rec) {
    var wrap = U.el('span', { class: 'thumb-wrap', title: 'اضغط لعرض الصورة' });
    var img = U.el('img', { class: 'thumb', alt: 'صورة', loading: 'lazy' });
    img.addEventListener('error', function () { wrap.classList.add('thumb-broken'); });
    img.onload = function () { wrap.style.backgroundImage = 'none'; };
    img.src = src;
    img.addEventListener('click', function () {
      if (window.App) window.App.openLightbox(img.src);
    });
    wrap.appendChild(img);
    return wrap;
  }

  window.Tables = {
    create: create,
    get: function (id) { return instances[id]; }
  };
})();