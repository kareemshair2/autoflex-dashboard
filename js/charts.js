/* ============================================================
 * AutoFlex Dashboard - طبقة الرسوم البيانية (Chart.js)
 * ============================================================ */
(function () {
  'use strict';
  var C = window.APP_CONFIG;

  var instances = {};

  function palette() {
    return C.COLORS.chart.base;
  }

  function baseOptions(extra) {
    return Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      font: { family: "'Almarai', sans-serif", size: 12 },
      plugins: {
        legend: {
          labels: { color: C.COLORS.ink, usePointStyle: true, boxWidth: 8, padding: 14, font: { family: "'Almarai', sans-serif", size: 12 } }
        },
        tooltip: {
          rtl: true,
          bodyFont: { family: "'Almarai', sans-serif" },
          titleFont: { family: "'Changa', sans-serif" },
          padding: 12,
          backgroundColor: C.COLORS.blueDark,
          titleColor: '#ffffff',
          bodyColor: '#eef3f6'
        }
      }
    }, extra || {});
  }

  function render(id, config) {
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
    instances[id] = new Chart(ctx, config);
  }

  function update(id, config) {
    render(id, config);
  }

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  function lineDataset(label, data, color, opts) {
    return Object.assign({
      label: label, data: data,
      borderColor: color, backgroundColor: color + '20',
      borderWidth: 2, pointRadius: 3, pointBackgroundColor: color,
      tension: 0.35, fill: true
    }, opts || {});
  }

  function barDataset(label, data, color, opts) {
    return Object.assign({
      label: label, data: data,
      backgroundColor: color, borderColor: color,
      borderRadius: 4, borderSkipped: false,
      maxBarThickness: 42
    }, opts || {});
  }

  window.Charts = {
    palette: palette,
    baseOptions: baseOptions,
    render: render,
    update: update,
    destroy: destroy,
    destroyAll: destroyAll,
    lineDataset: lineDataset,
    barDataset: barDataset
  };
})();