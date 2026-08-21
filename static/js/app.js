/**
 * SOQ Alert Dashboard — Pure Client-Side Implementation
 *
 * All processing happens in the browser:
 * - Excel parsing via SheetJS (xlsx)
 * - Fuzzy search via Fuse.js
 * - Alert calculations on-the-fly
 * - No backend required!
 */

(function () {
  'use strict';

  // ============================================================
  // GLOBAL STATE
  // ============================================================

  /** @type {Array<Object>} All parsed data rows */
  let DATA = [];

  /** @type {string} Source filename */
  let DATA_SOURCE = '';

  /** @type {Fuse|null} Fuse.js search instance */
  let fuseInstance = null;

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  /**
   * Safely convert value to integer
   * @param {*} v - Input value
   * @param {number} defaultVal - Default if conversion fails
   * @returns {number}
   */
  function safeInt(v, defaultVal = 0) {
    if (v === null || v === undefined || v === '') return defaultVal;
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  /**
   * Safely convert value to float
   * @param {*} v - Input value
   * @param {number} defaultVal - Default if conversion fails
   * @returns {number}
   */
  function safeFloat(v, defaultVal = 0) {
    if (v === null || v === undefined || v === '') return defaultVal;
    const parsed = parseFloat(v);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  /**
   * Format number as Indian Rupees (INR)
   * @param {number} num - Number to format
   * @returns {string}
   */
  function formatINR(num) {
    const val = safeFloat(num);
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + '\u00A0Cr';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + '\u00A0L';
    if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  }

  /**
   * Display part number, showing supersession arrow if applicable
   * @param {Object} item - Data row
   * @returns {string}
   */
  function displayPart(item) {
    if (item.is_superseded) {
      return item.ROOT_PART_NUM + ' → ' + item.LATEST_PART_NUM;
    }
    return item.ROOT_PART_NUM;
  }

  /**
   * Escape HTML special characters properly to prevent XSS and broken attributes
   * @param {string} str - String to escape
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================================
  // EXCEL PARSING (Client-Side via SheetJS)
  // ============================================================

  /**
   * Parse Excel file using SheetJS library
   * Efficiently handles large files (7000+ rows)
   *
   * @param {ArrayBuffer} arrayBuffer - File data as ArrayBuffer
   * @returns {{rows: Array<Object>, source: string}}
   */
  function parseExcelFile(arrayBuffer) {
    // Parse workbook
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON (array of arrays for performance)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Skip header row, process data rows
    const rows = [];
    const startRow = 1; // Skip header

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // Extract dead stock flag (column 28, index-based)
      let dead = String(row[28] || 'N').trim().toUpperCase();
      if (!dead || dead === 'NONE') dead = 'N';

      rows.push({
        ROOT_PART_NUM: String(row[0] || '').trim(),
        LATEST_PART_NUM: String(row[1] || '').trim(),
        PART_DESC: String(row[2] || '').trim(),
        PURCHASE_PRICE: safeFloat(row[3]),
        MINIMUM_ORDER_QTY: safeInt(row[4]),
        LOC_CD: String(row[5] || '').trim(),
        SLF_FACTOR: safeFloat(row[6]),
        LEAD_TIME: safeInt(row[7]),
        ORDER_CYCLE: safeInt(row[8]),
        ALPHA_VAL: safeFloat(row[9]),
        BETA_VAL: safeFloat(row[10]),
        TRANS_COUNT_6_MONTH: safeInt(row[11]),
        STANDARD_DEVIATION: safeFloat(row[12]),
        AVG_CONSUMPTION: safeFloat(row[13]),
        WT_AVG_CONSUMPTION: safeFloat(row[14]),
        MIN_ORDER_LEVEL: safeFloat(row[15]),
        RE_ORDER_LEVEL: safeFloat(row[16]),
        MAX_ORDER_LEVEL: safeInt(row[17]),
        OLD_MAX_LVL: safeInt(row[18]),
        STOCK_QTY: safeInt(row[19]),
        ON_ORDER_QTY: safeInt(row[20]),
        CUST_BACK_ORDER: safeInt(row[21]),
        OLD_CBO: safeInt(row[22]),
        SOQ_QTY: safeInt(row[23]),
        PARENT_GROUP: String(row[24] || '').trim(),
        DEALER_MAP_CD: String(row[25] || '').trim(),
        COMP_FA: String(row[26] || '').trim(),
        PART_FAMILY_AGE: String(row[27] || '').trim(),
        DEAD_STOCK_YN: dead,
        is_superseded: String(row[0] || '') !== String(row[1] || ''),
      });
    }

    return { rows, source: '' };
  }

  // ============================================================
  // ALERT DEFINITIONS & FUNCTIONS
  // ============================================================

  /** @type {Array<Object>} Alert configuration definitions */
  const ALERT_DEFS = [
    {
      id: 'low_consumption_high_value',
      title: 'Low Consumption + High Value',
      subtitle: 'Expensive slow-movers with SOQ suggested — customer may have left',
      color: 'text-ochre',
      thresholds: [
        { key: 't_avg', label: 'Avg Consumption <', min: 0, max: 5, step: 0.1, defaultVal: 1.0, format: function(v){ return safeFloat(v).toFixed(1); } },
        { key: 't_price', label: 'Price > ₹', min: 500, max: 120000, step: 500, defaultVal: 2000, format: function(v){ return formatINR(safeFloat(v)); } },
      ],
      valueTag: function(r){ return formatINR(r.PURCHASE_PRICE); },
      filter: function(data, params) {
        const t_avg = safeFloat(params.t_avg, 1.0);
        const t_price = safeFloat(params.t_price, 2000);
        return data.filter(r =>
          r.AVG_CONSUMPTION < t_avg &&
          r.PURCHASE_PRICE > t_price &&
          r.SOQ_QTY > 0
        );
      }
    },
    {
      id: 'high_moq_trap',
      title: 'High MOQ Trap',
      subtitle: 'Low stock + high MOQ + low consumption — forced bulk order',
      color: 'text-clay',
      thresholds: [
        { key: 't_stock', label: 'Stock <', min: 0, max: 20, step: 1, defaultVal: 5, format: function(v){ return Math.round(safeFloat(v)); } },
        { key: 't_moq', label: 'MOQ >=', min: 1, max: 1000, step: 1, defaultVal: 5, format: function(v){ return Math.round(safeFloat(v)); } },
        { key: 't_avg', label: 'Avg Consumption <', min: 0, max: 5, step: 0.1, defaultVal: 1.0, format: function(v){ return safeFloat(v).toFixed(1); } },
      ],
      valueTag: function(r){ return 'MOQ: ' + r.MINIMUM_ORDER_QTY; },
      filter: function(data, params) {
        const t_stock = safeFloat(params.t_stock, 5);
        const t_moq = safeFloat(params.t_moq, 5);
        const t_avg = safeFloat(params.t_avg, 1.0);
        return data.filter(r =>
          r.STOCK_QTY < t_stock &&
          r.MINIMUM_ORDER_QTY >= t_moq &&
          r.AVG_CONSUMPTION < t_avg &&
          r.SOQ_QTY > 0
        );
      }
    },
    {
      id: 'dead_stock_misclassified',
      title: 'Dead Stock Misclassified',
      subtitle: 'Flagged dead but has demand — order blocked by incorrect marking',
      color: 'text-ochre',
      thresholds: [
        { key: 't_stock', label: 'Stock <=', min: 0, max: 20, step: 1, defaultVal: 5, format: function(v){ return Math.round(safeFloat(v)); } },
      ],
      valueTag: function(r){ return 'Avg: ' + r.AVG_CONSUMPTION; },
      filter: function(data, params) {
        const t_stock = safeFloat(params.t_stock, 5);
        return data.filter(r =>
          r.SOQ_QTY > 0 &&
          r.AVG_CONSUMPTION > 1 &&
          r.STOCK_QTY <= t_stock &&
          r.DEAD_STOCK_YN === 'Y'
        );
      }
    },
    {
      id: 'double_order_risk',
      title: 'Double Order Risk',
      subtitle: 'On Order exists AND SOQ generated — potential overstock',
      color: 'text-sky',
      thresholds: [],
      valueTag: function(r){ return 'OnOrd: ' + r.ON_ORDER_QTY + ' + SOQ: ' + r.SOQ_QTY; },
      filter: function(data, params) {
        return data.filter(r => r.ON_ORDER_QTY > 0 && r.SOQ_QTY > 0);
      }
    },
  ];

  // ============================================================
  // SUMMARY CALCULATIONS
  // ============================================================

  /**
   * Calculate summary statistics from current data
   * @returns {Object} Summary statistics
   */
  function calculateSummary() {
    if (!DATA || DATA.length === 0) {
      return {
        total_skus: 0,
        total_sov_value: 0,
        total_stock_value: 0,
        dead_stock_count: 0,
        zero_stock_count: 0,
        backorder_count: 0,
        on_order_count: 0,
        data_source: DATA_SOURCE,
      };
    }

    let totalSovValue = 0;
    let totalStockValue = 0;
    let deadStockCount = 0;
    let zeroStockCount = 0;
    let backorderCount = 0;
    let onOrderCount = 0;

    for (let i = 0; i < DATA.length; i++) {
      const r = DATA[i];
      totalSovValue += r.SOQ_QTY * r.PURCHASE_PRICE;
      totalStockValue += r.STOCK_QTY * r.PURCHASE_PRICE;

      if (r.DEAD_STOCK_YN === 'Y') deadStockCount++;
      if (r.STOCK_QTY === 0) zeroStockCount++;
      if (r.CUST_BACK_ORDER > 0) backorderCount++;
      if (r.ON_ORDER_QTY > 0) onOrderCount++;
    }

    return {
      total_skus: DATA.length,
      total_sov_value: Math.round(totalSovValue * 100) / 100,
      total_stock_value: Math.round(totalStockValue * 100) / 100,
      dead_stock_count: deadStockCount,
      zero_stock_count: zeroStockCount,
      backorder_count: backorderCount,
      on_order_count: onOrderCount,
      data_source: DATA_SOURCE,
    };
  }

  function updateSummaryDisplay() {
    const s = calculateSummary();

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl('statSkus', s.total_skus.toLocaleString('en-IN'));
    setEl('statSovValue', formatINR(s.total_sov_value));
    setEl('statStockValue', formatINR(s.total_stock_value));
    setEl('statDead', s.dead_stock_count.toLocaleString('en-IN'));
    setEl('statZero', s.zero_stock_count.toLocaleString('en-IN'));
    setEl('statCbo', s.backorder_count.toLocaleString('en-IN'));
    setEl('statOnOrder', s.on_order_count.toLocaleString('en-IN'));
    setEl('statSource', s.data_source || '—');
  }

  // ============================================================
  // FUZZY SEARCH (via Fuse.js)
  // ============================================================

  function initializeSearch() {
    // Prevent fatal application crash if Fuse failed to load (e.g. adblocker / CDN failure)
    if (!DATA || DATA.length === 0 || typeof Fuse === 'undefined') {
      fuseInstance = null;
      return;
    }

    const fuseOptions = {
      keys: [
        { name: 'ROOT_PART_NUM', weight: 2.0 },
        { name: 'LATEST_PART_NUM', weight: 2.0 },
        { name: 'PART_DESC', weight: 1.0 },
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: false,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: false,
      useExtendedSearch: true,
      ignoreLocation: true,
      distance: 100,
    };

    fuseInstance = new Fuse(DATA, fuseOptions);
  }

  function performSearch(query) {
    if (!query || !query.trim()) return [];
    if (!DATA || DATA.length === 0) return [];

    const trimmedQuery = query.trim().toLowerCase();

    // First check for exact matches (fast path, works even without Fuse.js)
    const exactMatches = [];
    for (let i = 0; i < DATA.length; i++) {
      const r = DATA[i];
      if (trimmedQuery === r.ROOT_PART_NUM.toLowerCase() ||
          trimmedQuery === r.LATEST_PART_NUM.toLowerCase()) {
        exactMatches.push({ item: r, score: 100, matchType: 'exact' });
      }
    }

    if (exactMatches.length > 0) return exactMatches.slice(0, 50);

    // Fall back to fuzzy search
    if (!fuseInstance) return [];

    const results = fuseInstance.search(trimmedQuery);

    return results.slice(0, 50).map(result => ({
      item: result.item,
      score: Math.round((1 - result.score) * 100),
      matchType: 'fuzzy',
    }));
  }

  // ============================================================
  // ALERT PROCESSING
  // ============================================================

  function getAlertResults(alertId) {
    const def = ALERT_DEFS.find(d => d.id === alertId);
    if (!def) return { alertId, count: 0, items: [] };

    const params = {};
    if (def.thresholds) {
      def.thresholds.forEach(t => {
        const slider = document.getElementById('slider-' + alertId + '-' + t.key);
        if (slider) {
          params[t.key] = parseFloat(slider.value);
        } else {
          params[t.key] = t.defaultVal;
        }
      });
    }

    const items = def.filter(DATA, params);

    return {
      alertId,
      count: items.length,
      items: items,
    };
  }

  // ============================================================
  // UI COMPONENTS
  // ============================================================

  function initUpload() {
      const fileInput = document.getElementById('fileInput');
      const uploadBtn = document.getElementById('uploadBtn');
      const filenameSpan = document.getElementById('uploadFilename'); // <-- Added this

      if (!fileInput || !uploadBtn) return;

      fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
          // 1. Enable the Analyze button
          uploadBtn.disabled = false;
          uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          uploadBtn.classList.add('hover:shadow-lg', 'hover:shadow-sky-500/25', 'hover:-translate-y-0.5');

          // 2. Update the text to show the selected file name
          if (filenameSpan) {
            filenameSpan.textContent = fileInput.files[0].name;
            filenameSpan.classList.remove('text-muted');
          }
        } else {
          // 1. Disable the Analyze button
          uploadBtn.disabled = true;
          uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
          uploadBtn.classList.remove('hover:shadow-lg', 'hover:shadow-sky-500/25', 'hover:-translate-y-0.5');

          // 2. Revert the text back
          if (filenameSpan) {
            filenameSpan.textContent = 'No file selected';
            filenameSpan.classList.add('text-muted');
          }
        }
      });

      uploadBtn.addEventListener('click', async function () {
        if (!fileInput.files.length) return;

        const file = fileInput.files[0];
        if (!file.name.match(/\.xlsx?$/i)) {
          showUploadStatus('Please upload an .xlsx or .xls file.', 'error');
          return;
        }

        uploadBtn.disabled = true;
        uploadBtn.classList.add('opacity-50', 'cursor-not-allowed');
        showUploadStatus('Parsing Excel file (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)...', '');

        try {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          showUploadStatus('Processing ' + (arrayBuffer.byteLength / 1024 / 1024).toFixed(1) + ' MB of data...', '');

          const result = parseExcelFile(arrayBuffer);
          DATA = result.rows;
          DATA_SOURCE = file.name;

          initializeSearch();

          showUploadStatus(
            '✓ Loaded ' + DATA.length.toLocaleString('en-IN') + ' rows from ' + file.name,
            'success'
          );

          // Hide empty state if you have one, show dashboard
          const emptyState = document.getElementById('emptyState');
          if (emptyState) emptyState.classList.add('hidden');

          document.getElementById('dashboardsGrid').classList.remove('hidden');

          updateSummaryDisplay();
          buildDashboardCards();

          ALERT_DEFS.forEach(function(def) { renderAlert(def.id); });

        } catch (e) {
          console.error('Upload error:', e);
          showUploadStatus('Error parsing file: ' + e.message, 'error');
          uploadBtn.disabled = false;
          uploadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      });
    }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  function showUploadStatus(message, type) {
    const container = document.getElementById('uploadStatus');
    const statusEl = container.querySelector('.upload-status');

    if (!container || !statusEl) return;

    statusEl.className = 'upload-status px-4 py-2 rounded-lg text-sm font-medium';
    if (type) statusEl.classList.add(type);
    statusEl.textContent = message;
    container.classList.remove('hidden');
  }

  function buildDashboardCards() {
    const grid = document.getElementById('dashboardsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ALERT_DEFS.forEach(function(def) {
      const card = document.createElement('div');
      card.className = 'alert-card';
      card.id = 'card-' + def.id;

      const header = document.createElement('div');
      header.className = 'alert-card-header';
      header.innerHTML =
        '<div class="alert-info">' +
          '<div class="alert-title ' + def.color + '">' + def.title + '</div>' +
          '<div class="alert-subtitle">' + def.subtitle + '</div>' +
        '</div>' +
        '<div class="alert-count" id="count-' + def.id + '">—</div>';
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'alert-body';

      if (def.thresholds && def.thresholds.length > 0) {
        const threshDiv = document.createElement('div');
        threshDiv.className = 'threshold-controls';

        def.thresholds.forEach(function(t) {
          const row = document.createElement('div');
          row.className = 'threshold-row';
          row.innerHTML =
            '<span class="threshold-label">' + t.label + '</span>' +
            '<input type="range" class="threshold-slider" id="slider-' + def.id + '-' + t.key +
              '" min="' + t.min + '" max="' + t.max + '" step="' + t.step + '" value="' + t.defaultVal + '">' +
            '<span class="threshold-value" id="val-' + def.id + '-' + t.key + '">' + t.format(t.defaultVal) + '</span>';
          threshDiv.appendChild(row);

          const slider = row.querySelector('.threshold-slider');
          const valSpan = row.querySelector('.threshold-value');

          let debounceTimer = null;
          slider.addEventListener('input', function() {
            const numericVal = parseFloat(slider.value);
            valSpan.textContent = t.format(numericVal);

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
              renderAlert(def.id);
            }, 150);
          });
        });

        body.appendChild(threshDiv);
      }

      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'alert-items-list';
      itemsDiv.id = 'items-' + def.id;
      itemsDiv.innerHTML = '<div class="loading-spinner">Analyzing Data...</div>';
      body.appendChild(itemsDiv);

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function renderAlert(alertId) {
    const def = ALERT_DEFS.find(d => d.id === alertId);
    if (!def) return;

    const itemsContainer = document.getElementById('items-' + alertId);
    if (!itemsContainer) return;

    if (DATA.length === 0) {
      itemsContainer.innerHTML = '<div class="alert-empty">No data loaded yet.</div>';
      return;
    }

    const data = getAlertResults(alertId);

    const countEl = document.getElementById('count-' + alertId);
    if (countEl) countEl.textContent = data.count;

    if (!data.items || data.items.length === 0) {
      itemsContainer.innerHTML = '<div class="alert-empty">No items match current parameters.</div>';
      return;
    }

    const displayItems = data.items.slice(0, 100);

    itemsContainer.innerHTML = displayItems.map(function(item) {
      const partDisplay = displayPart(item);
      return '<div class="alert-item-row" data-part="' + escapeHtml(item.ROOT_PART_NUM) + '">' +
        '<div class="air-content">' +
          '<div class="air-part">' + escapeHtml(partDisplay) + '</div>' +
          '<div class="air-name">' + escapeHtml(item.PART_DESC) + '</div>' +
          '<div class="air-metrics">' +
            '<span>STK: ' + item.STOCK_QTY + '</span>' +
            '<span>AVG: ' + item.AVG_CONSUMPTION + '</span>' +
            '<span>SOQ: ' + item.SOQ_QTY + '</span>' +
            (item.ON_ORDER_QTY > 0 ? '<span>ORD: ' + item.ON_ORDER_QTY + '</span>' : '') +
            (item.CUST_BACK_ORDER > 0 ? '<span class="text-clay">CBO: ' + item.CUST_BACK_ORDER + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="air-value-tag ' + def.color + '">' + escapeHtml(def.valueTag(item)) + '</div>' +
      '</div>';
    }).join('');

    itemsContainer.querySelectorAll('.alert-item-row').forEach(function(row) {
      row.addEventListener('click', function() {
        const partNum = row.dataset.part;
        const item = data.items.find(i => i.ROOT_PART_NUM === partNum);
        if (item) openModal(item);
      });
    });

    if (data.items.length > 100) {
      const notice = document.createElement('div');
      notice.className = 'text-center text-xs text-gray-400 py-2';
      notice.textContent = 'Showing 100 of ' + data.items.length + ' matching items';
      itemsContainer.appendChild(notice);
    }
  }

  // ============================================================
  // SEARCH UI
  // ============================================================

  let searchTimeout = null;

  function initSearch() {
    const input = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('searchResults');

    if (!input || !resultsDiv) return;

    input.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      const q = input.value.trim();

      if (q.length < 2) {
        resultsDiv.classList.remove('active');
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
      }

      searchTimeout = setTimeout(function() {
        executeSearch(q);
      }, 250);
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.search-section')) {
        resultsDiv.classList.remove('active');
        resultsDiv.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        resultsDiv.classList.remove('active');
        resultsDiv.classList.add('hidden');
      }
    });
  }

  function executeSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;

    if (!DATA || DATA.length === 0) {
      resultsDiv.innerHTML = '<div class="search-no-results">Please upload data first.</div>';
      resultsDiv.classList.add('active');
      resultsDiv.classList.remove('hidden');
      return;
    }

    const results = performSearch(query);

    if (results.length === 0) {
      resultsDiv.innerHTML = '<div class="search-no-results">No items found for "' + escapeHtml(query) + '"</div>';
      resultsDiv.classList.add('active');
      resultsDiv.classList.remove('hidden');
      return;
    }

    resultsDiv.innerHTML = results.map(function(r) {
      return '<div class="search-result-item" data-part="' + escapeHtml(r.item.ROOT_PART_NUM) + '">' +
        '<div class="sr-part">' + escapeHtml(displayPart(r.item)) + ' <span class="search-badge font-mono">' + escapeHtml(r.matchType) + ' ' + r.score + '%</span></div>' +
        '<div class="sr-name">' + escapeHtml(r.item.PART_DESC) + '</div>' +
        '<div class="sr-meta">' +
          '<span>STK: ' + r.item.STOCK_QTY + '</span>' +
          '<span>PRC: ' + formatINR(r.item.PURCHASE_PRICE) + '</span>' +
          '<span>AVG: ' + r.item.AVG_CONSUMPTION + '/mo</span>' +
        '</div>' +
      '</div>';
    }).join('');

    resultsDiv.classList.add('active');
    resultsDiv.classList.remove('hidden');

    resultsDiv.querySelectorAll('.search-result-item').forEach(function(el) {
      el.addEventListener('click', function() {
        const partNum = el.dataset.part;
        const match = results.find(r => r.item.ROOT_PART_NUM === partNum);
        if (match) {
          openModal(match.item);
          resultsDiv.classList.remove('active');
          resultsDiv.classList.add('hidden');
        }
      });
    });
  }

  // ============================================================
  // MODAL
  // ============================================================

  function openModal(item) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (!overlay || !title || !body) return;

    title.textContent = item.ROOT_PART_NUM + ' — ' + item.PART_DESC;

    const stockMonths = item.AVG_CONSUMPTION > 0
      ? (item.STOCK_QTY / item.AVG_CONSUMPTION).toFixed(1)
      : 'N/A';
    const sovValue = item.SOQ_QTY * item.PURCHASE_PRICE;
    const stockValue = item.STOCK_QTY * item.PURCHASE_PRICE;
    const isDead = item.DEAD_STOCK_YN === 'Y';
    const isSuperseded = item.is_superseded;

    const fields = [
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
      { label: 'Purchase Price', value: '₹' + safeFloat(item.PURCHASE_PRICE).toLocaleString('en-IN', { maximumFractionDigits: 2 }) },
      { label: 'Lead Time', value: item.LEAD_TIME + ' days' },
      { label: 'Dead Stock', value: isDead ? 'YES' : 'NO', cls: isDead ? 'highlight-red' : 'highlight-green' },
      { label: 'Location', value: item.LOC_CD || 'N/A' },
    ];

    body.innerHTML = fields.map(function(f) {
      return '<div class="detail-row">' +
        '<span class="detail-label">' + escapeHtml(f.label) + '</span>' +
        '<span class="detail-value ' + (f.cls || '') + '">' + escapeHtml(f.value) + '</span>' +
      '</div>';
    }).join('');

    overlay.classList.add('active');
  }

  function initModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');

    if (!overlay || !closeBtn) return;

    closeBtn.addEventListener('click', function() {
      overlay.classList.remove('active');
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') overlay.classList.remove('active');
    });
  }

  // ============================================================
  // THEME TOGGLE
  // ============================================================

  function initTheme() {
    const toggleBtn = document.getElementById('themeToggle');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.classList.remove('dark');
      }
    }

    function toggleTheme() {
      if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function init() {
    console.log('[SOQ Dashboard] Initializing client-side application...');

    initTheme();
    initUpload();
    buildDashboardCards();
    initSearch();
    initModal();

    if (typeof XLSX === 'undefined') {
      console.error('[SOQ Dashboard] ERROR: SheetJS (XLSX) library not loaded!');
      showUploadStatus('Error: Excel library failed to load. Please refresh the page.', 'error');
      return;
    }

    if (typeof Fuse === 'undefined') {
      console.warn('[SOQ Dashboard] WARNING: Fuse.js not loaded. Fuzzy search will be limited.');
    }

    console.log('[SOQ Dashboard] Ready! Waiting for file upload.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
