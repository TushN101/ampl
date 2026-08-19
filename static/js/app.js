/* ===== SOQ Alert Dashboard — Claude Theme JS ===== */

(function () {
  'use strict';

  // --- Dark Mode Logic ---
  const themeToggleBtn = document.getElementById('themeToggle');
  
  function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }
  
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // --- Alert Definitions ---
  var ALERT_DEFS = [
    {
      id: 'low_consumption_high_value',
      title: 'Low Consumption + High Value',
      subtitle: 'Expensive slow-movers with SOQ suggested — customer may have left',
      color: 'text-ochre',
      thresholds: [
        { key: 't_avg', label: 'Avg Consumption <', min: 0, max: 5, step: 0.1, defaultVal: 1.0, format: function(v){ return v.toFixed(1); } },
        { key: 't_price', label: 'Price > ₹', min: 500, max: 120000, step: 500, defaultVal: 2000, format: function(v){ return formatINR(v); } },
      ],
      valueTag: function(r){ return formatINR(r.PURCHASE_PRICE); },
    },
    {
      id: 'high_moq_trap',
      title: 'High MOQ Trap',
      subtitle: 'Low stock + high MOQ + low consumption — forced bulk order',
      color: 'text-clay',
      thresholds: [
        { key: 't_stock', label: 'Stock <', min: 0, max: 20, step: 1, defaultVal: 5, format: function(v){ return v; } },
        { key: 't_moq', label: 'MOQ >=', min: 1, max: 1000, step: 1, defaultVal: 5, format: function(v){ return v; } },
        { key: 't_avg', label: 'Avg Consumption <', min: 0, max: 5, step: 0.1, defaultVal: 1.0, format: function(v){ return v.toFixed(1); } },
      ],
      valueTag: function(r){ return 'MOQ: ' + r.MINIMUM_ORDER_QTY; },
    },
    {
      id: 'dead_stock_misclassified',
      title: 'Dead Stock Misclassified',
      subtitle: 'Flagged dead but has demand — order blocked by incorrect marking',
      color: 'text-ochre',
      thresholds: [
        { key: 't_stock', label: 'Stock <=', min: 0, max: 20, step: 1, defaultVal: 5, format: function(v){ return v; } },
      ],
      valueTag: function(r){ return 'Avg: ' + r.AVG_CONSUMPTION; },
    },
    {
      id: 'double_order_risk',
      title: 'Double Order Risk',
      subtitle: 'On Order exists AND SOQ generated — potential overstock',
      color: 'text-sky',
      thresholds: [],
      valueTag: function(r){ return 'OnOrd: ' + r.ON_ORDER_QTY + ' + SOQ: ' + r.SOQ_QTY; },
    },
  ];

  var searchTimeout = null;
// Find this function in your app.js and update it
  function formatINR(num) {
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + '\u00A0Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + '\u00A0L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  function displayPart(item) {
    if (item.is_superseded) return item.ROOT_PART_NUM + ' → ' + item.LATEST_PART_NUM;
    return item.ROOT_PART_NUM;
  }

  function initUpload() {
    var fileInput = document.getElementById('fileInput');
    var uploadBtn = document.getElementById('uploadBtn');
    var statusEl = document.getElementById('uploadStatus');
    var filenameEl = document.getElementById('uploadFilename');

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) {
        filenameEl.textContent = fileInput.files[0].name;
        uploadBtn.disabled = false;
      } else {
        filenameEl.textContent = 'No file selected';
        uploadBtn.disabled = true;
      }
    });

    uploadBtn.addEventListener('click', async function () {
      if (!fileInput.files.length) return;
      var file = fileInput.files[0];
      if (!file.name.match(/\.xlsx?$/i)) {
        statusEl.textContent = 'Please upload an .xlsx or .xls file.';
        statusEl.className = 'upload-status error';
        return;
      }

      uploadBtn.disabled = true;
      statusEl.textContent = 'Uploading & analyzing...';
      statusEl.className = 'upload-status';

      var formData = new FormData();
      formData.append('file', file);

      try {
        var res = await fetch('/api/upload', { method: 'POST', body: formData });
        var data = await res.json();
        if (data.error) throw new Error(data.error);

        statusEl.textContent = 'Loaded ' + data.rows + ' rows from ' + file.name;
        statusEl.className = 'upload-status success';

        loadSummary();
        ALERT_DEFS.forEach(function (def) { fetchAlert(def.id); });
      } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
        statusEl.className = 'upload-status error';
        uploadBtn.disabled = false;
      }
    });
  }

  async function loadSummary() {
    try {
      var res = await fetch('/api/summary');
      var data = await res.json();
      document.getElementById('statSkus').textContent = data.total_skus.toLocaleString('en-IN');
      document.getElementById('statSovValue').textContent = formatINR(data.total_sov_value);
      document.getElementById('statStockValue').textContent = formatINR(data.total_stock_value);
      document.getElementById('statDead').textContent = data.dead_stock_count.toLocaleString('en-IN');
      document.getElementById('statZero').textContent = data.zero_stock_count.toLocaleString('en-IN');
      document.getElementById('statCbo').textContent = data.backorder_count.toLocaleString('en-IN');
      document.getElementById('statOnOrder').textContent = data.on_order_count.toLocaleString('en-IN');
    } catch (e) { console.error('Summary error', e); }
  }

  function buildDashboardCards() {
    var grid = document.getElementById('dashboardsGrid');
    grid.innerHTML = '';

    ALERT_DEFS.forEach(function (def) {
      var card = document.createElement('div');
      card.className = 'alert-card';
      card.id = 'card-' + def.id;

      var header = document.createElement('div');
      header.className = 'alert-card-header';
      header.innerHTML =
        '<div class="alert-info">' +
          '<div class="alert-title ' + def.color + '">' + def.title + '</div>' +
          '<div class="alert-subtitle">' + def.subtitle + '</div>' +
        '</div>' +
        '<div class="alert-count" id="count-' + def.id + '">—</div>';
      card.appendChild(header);

      var body = document.createElement('div');
      body.className = 'alert-body';

      if (def.thresholds.length > 0) {
        var threshDiv = document.createElement('div');
        threshDiv.className = 'threshold-controls';
        def.thresholds.forEach(function (t) {
          var row = document.createElement('div');
          row.className = 'threshold-row';
          row.innerHTML =
            '<span class="threshold-label">' + t.label + '</span>' +
            '<input type="range" class="threshold-slider" id="slider-' + def.id + '-' + t.key +
              '" min="' + t.min + '" max="' + t.max + '" step="' + t.step + '" value="' + t.defaultVal + '">' +
            '<span class="threshold-value" id="val-' + def.id + '-' + t.key + '">' + t.format(t.defaultVal) + '</span>';
          threshDiv.appendChild(row);

          var slider = row.querySelector('.threshold-slider');
          var valSpan = row.querySelector('.threshold-value');
          slider.addEventListener('input', function () {
            valSpan.textContent = t.format(slider.value);
            fetchAlert(def.id);
          });
        });
        body.appendChild(threshDiv);
      }

      var itemsDiv = document.createElement('div');
      itemsDiv.className = 'alert-items-list';
      itemsDiv.id = 'items-' + def.id;
      itemsDiv.innerHTML = '<div class="loading-spinner">Analyzing Data...</div>';
      body.appendChild(itemsDiv);

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  async function fetchAlert(alertId) {
    var def = null;
    for (var i = 0; i < ALERT_DEFS.length; i++) {
      if (ALERT_DEFS[i].id === alertId) { def = ALERT_DEFS[i]; break; }
    }
    if (!def) return;

    var params = new URLSearchParams();
    def.thresholds.forEach(function (t) {
      var slider = document.getElementById('slider-' + alertId + '-' + t.key);
      if (slider) params.set(t.key, slider.value);
    });

    var itemsContainer = document.getElementById('items-' + alertId);
    itemsContainer.innerHTML = '<div class="loading-spinner">Updating Set...</div>';

    try {
      var res = await fetch('/api/alerts/' + alertId + '?' + params.toString());
      var data = await res.json();

      document.getElementById('count-' + alertId).textContent = data.count;

      if (data.items.length === 0) {
        itemsContainer.innerHTML = '<div class="alert-empty">No items match current parameters.</div>';
        return;
      }

      itemsContainer.innerHTML = data.items.map(function (item) {
        var partDisplay = displayPart(item);
        return '<div class="alert-item-row" data-part="' + item.ROOT_PART_NUM + '">' +
          '<div class="air-content">' +
            '<div class="air-part">' + partDisplay + '</div>' +
            '<div class="air-name">' + item.PART_DESC + '</div>' +
            '<div class="air-metrics">' +
              '<span>STK: ' + item.STOCK_QTY + '</span>' +
              '<span>AVG: ' + item.AVG_CONSUMPTION + '</span>' +
              '<span>SOQ: ' + item.SOQ_QTY + '</span>' +
              (item.ON_ORDER_QTY > 0 ? '<span>ORD: ' + item.ON_ORDER_QTY + '</span>' : '') +
              (item.CUST_BACK_ORDER > 0 ? '<span class="text-clay">CBO: ' + item.CUST_BACK_ORDER + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="air-value-tag ' + def.color + '">' + def.valueTag(item) + '</div>' +
        '</div>';
      }).join('');

      itemsContainer.querySelectorAll('.alert-item-row').forEach(function (row) {
        row.addEventListener('click', function () {
          var partNum = row.dataset.part;
          var item = data.items.find(function (i) { return i.ROOT_PART_NUM === partNum; });
          if (item) openModal(item);
        });
      });
    } catch (e) {
      itemsContainer.innerHTML = '<div class="alert-empty">Error processing data matrix.</div>';
      console.error('Alert fetch error', e);
    }
  }

  function initSearch() {
    var input = document.getElementById('searchInput');
    var resultsDiv = document.getElementById('searchResults');

    input.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      var q = input.value.trim();
      if (q.length < 2) { resultsDiv.classList.remove('active'); resultsDiv.innerHTML = ''; return; }
      searchTimeout = setTimeout(function () { performSearch(q); }, 250);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-section')) resultsDiv.classList.remove('active');
    });
  }

  async function performSearch(query) {
    var resultsDiv = document.getElementById('searchResults');
    try {
      var res = await fetch('/api/search?q=' + encodeURIComponent(query));
      var data = await res.json();

      if (data.total === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No indices found for "' + query + '"</div>';
        resultsDiv.classList.add('active'); return;
      }

      resultsDiv.innerHTML = data.results.map(function (r) {
        return '<div class="search-result-item" data-part="' + r.item.ROOT_PART_NUM + '">' +
          '<div class="sr-part">' + displayPart(r.item) + ' <span class="search-badge font-mono">' + r.match_type + ' ' + r.score + '%</span></div>' +
          '<div class="sr-name">' + r.item.PART_DESC + '</div>' +
          '<div class="sr-meta">' +
            '<span>STK: ' + r.item.STOCK_QTY + '</span>' +
            '<span>PRC: ' + formatINR(r.item.PURCHASE_PRICE) + '</span>' +
            '<span>AVG: ' + r.item.AVG_CONSUMPTION + '/mo</span>' +
          '</div>' +
        '</div>';
      }).join('');

      resultsDiv.classList.add('active');
      resultsDiv.querySelectorAll('.search-result-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var partNum = el.dataset.part;
          var match = data.results.find(function (r) { return r.item.ROOT_PART_NUM === partNum; });
          if (match) { openModal(match.item); resultsDiv.classList.remove('active'); }
        });
      });
    } catch (e) { console.error('Search error', e); }
  }

  function openModal(item) {
    var overlay = document.getElementById('modalOverlay');
    var title = document.getElementById('modalTitle');
    var body = document.getElementById('modalBody');

    title.textContent = item.ROOT_PART_NUM + ' — ' + item.PART_DESC;

    var stockMonths = item.AVG_CONSUMPTION > 0 ? (item.STOCK_QTY / item.AVG_CONSUMPTION).toFixed(1) : 'N/A';
    var sovValue = item.SOQ_QTY * item.PURCHASE_PRICE;
    var stockValue = item.STOCK_QTY * item.PURCHASE_PRICE;
    var isDead = item.DEAD_STOCK_YN === 'Y';
    var isSuperseded = item.is_superseded;

    var fields = [
      { label: 'Root Part Number', value: item.ROOT_PART_NUM, cls: isSuperseded ? 'highlight-orange' : '' },
      { label: 'Latest Part Number', value: item.LATEST_PART_NUM, cls: isSuperseded ? 'highlight-green' : '' },
      { label: 'Part Description', value: item.PART_DESC },
      { label: 'Part Family Age', value: item.PART_FAMILY_AGE || 'N/A' },
      { label: 'Current Stock', value: item.STOCK_QTY, cls: item.STOCK_QTY === 0 ? 'highlight-red' : '' },
      { label: 'On Order Qty', value: item.ON_ORDER_QTY, cls: item.ON_ORDER_QTY > 0 ? 'highlight-blue' : '' },
      { label: 'Customer Back Order', value: item.CUST_BACK_ORDER, cls: item.CUST_BACK_ORDER > 0 ? 'highlight-red' : '' },
      { label: 'Stock Value', value: formatINR(stockValue), cls: stockValue > 50000 ? 'highlight-yellow' : '' },
      { label: 'Months of Stock', value: stockMonths === 'N/A' ? 'N/A' : stockMonths + ' mo', cls: parseFloat(stockMonths) > 3 ? 'highlight-yellow' : '' },
      { label: 'Min Order Qty', value: item.MINIMUM_ORDER_QTY },
      { label: 'SOQ Qty', value: item.SOQ_QTY, cls: item.SOQ_QTY > 0 ? 'highlight-blue' : '' },
      { label: 'SOQ Value', value: formatINR(sovValue), cls: item.SOQ_QTY > 0 ? 'highlight-blue' : '' },
      { label: 'Avg Consumption (6m)', value: item.AVG_CONSUMPTION + ' / mo', cls: item.AVG_CONSUMPTION < 1 ? 'highlight-yellow' : item.AVG_CONSUMPTION > 3 ? 'highlight-green' : '' },
      { label: 'Wt Avg Consumption', value: item.WT_AVG_CONSUMPTION },
      { label: 'Transactions (6m)', value: item.TRANS_COUNT_6_MONTH },
      { label: 'Std Deviation', value: item.STANDARD_DEVIATION },
      { label: 'Re-Order Level', value: item.RE_ORDER_LEVEL },
      { label: 'Max Order Level', value: item.MAX_ORDER_LEVEL },
      { label: 'Purchase Price', value: '₹' + item.PURCHASE_PRICE.toLocaleString('en-IN', { maximumFractionDigits: 2 }) },
      { label: 'Lead Time', value: item.LEAD_TIME + ' days' },
      { label: 'Dead Stock', value: isDead ? 'YES' : 'NO', cls: isDead ? 'highlight-red' : 'highlight-green' },
      { label: 'Location', value: item.LOC_CD || 'N/A' },
    ];

    body.innerHTML = fields.map(function (f) {
      return '<div class="detail-row">' +
        '<span class="detail-label">' + f.label + '</span>' +
        '<span class="detail-value ' + (f.cls || '') + '">' + f.value + '</span>' +
      '</div>';
    }).join('');

    overlay.classList.add('active');
  }

  function initModal() {
    var overlay = document.getElementById('modalOverlay');
    var closeBtn = document.getElementById('modalClose');
    closeBtn.addEventListener('click', function () { overlay.classList.remove('active'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('active'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.classList.remove('active'); });
  }

  async function init() {
    initUpload();
    loadSummary();
    buildDashboardCards();
    ALERT_DEFS.forEach(function (def) { fetchAlert(def.id); });
    initSearch();
    initModal();
  }

  document.addEventListener('DOMContentLoaded', init);
})();