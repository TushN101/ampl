import { escapeHtml, debounce } from '../utils/helpers.js';
import { displayPart } from '../utils/formatters.js';

/**
 * Render a single alert card's items and item count.
 * @param {Object} options
 * @param {string} options.alertId
 * @param {import('../alerts/alertRegistry.js').AlertRegistry} options.registry
 * @param {Array<Object>} options.data
 * @param {Function} options.onItemClick
 */
export function renderAlert({ alertId, registry, data, onItemClick }) {
  const def = registry.get(alertId);
  if (!def) return;

  const itemsContainer = document.getElementById('items-' + alertId);
  if (!itemsContainer) return;

  if (!data || data.length === 0) {
    itemsContainer.innerHTML =
      '<div class="alert-empty">No data loaded yet.</div>';
    const countEl = document.getElementById('count-' + alertId);
    if (countEl) countEl.textContent = '—';
    return;
  }

  // Extract threshold values from DOM inputs or fallback to defaults
  const params = {};
  if (def.thresholds) {
    def.thresholds.forEach((t) => {
      const slider = document.getElementById('slider-' + alertId + '-' + t.key);
      params[t.key] = slider ? parseFloat(slider.value) : t.defaultVal;
    });
  }

  const result = registry.evaluateAlert(alertId, data, params);

  const countEl = document.getElementById('count-' + alertId);
  if (countEl) countEl.textContent = result.count;

  if (!result.items || result.items.length === 0) {
    itemsContainer.innerHTML =
      '<div class="alert-empty">No items match current parameters.</div>';
    return;
  }

  const displayItems = result.items.slice(0, 100);

  itemsContainer.innerHTML = displayItems
    .map(function (item) {
      const partDisplay = displayPart(item);
      const ageBadge =
        alertId === 'new_part_pna_requisition' && item.PART_FAMILY_AGE
          ? '<span class="air-age-badge">' +
            escapeHtml(item.PART_FAMILY_AGE) +
            '</span>'
          : '';

      return (
        '<div class="alert-item-row" data-part="' +
        escapeHtml(item.ROOT_PART_NUM) +
        '">' +
        '<div class="air-content">' +
        '<div class="air-part">' +
        escapeHtml(partDisplay) +
        ' ' +
        ageBadge +
        '</div>' +
        '<div class="air-name">' +
        escapeHtml(item.PART_DESC) +
        '</div>' +
        '<div class="air-metrics">' +
        '<span>STK: ' +
        item.STOCK_QTY +
        '</span>' +
        '<span>AVG: ' +
        item.AVG_CONSUMPTION +
        '</span>' +
        '<span>SOQ: ' +
        item.SOQ_QTY +
        '</span>' +
        (item.ON_ORDER_QTY > 0
          ? '<span>ORD: ' + item.ON_ORDER_QTY + '</span>'
          : '') +
        (item.CUST_BACK_ORDER > 0
          ? '<span class="text-clay">CBO: ' + item.CUST_BACK_ORDER + '</span>'
          : '') +
        '</div>' +
        '</div>' +
        '<div class="air-value-tag ' +
        def.color +
        '">' +
        escapeHtml(def.valueTag(item)) +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  itemsContainer.querySelectorAll('.alert-item-row').forEach(function (row) {
    row.addEventListener('click', function () {
      const partNum = row.dataset.part;
      const item = result.items.find((i) => i.ROOT_PART_NUM === partNum);
      if (item && typeof onItemClick === 'function') {
        onItemClick(item);
      }
    });
  });

  if (result.items.length > 100) {
    const notice = document.createElement('div');
    notice.className = 'text-center text-xs text-gray-400 py-2';
    notice.textContent =
      'Showing 100 of ' + result.items.length + ' matching items';
    itemsContainer.appendChild(notice);
  }
}

/**
 * Re-render all alert cards in the grid.
 * @param {Object} options
 * @param {import('../alerts/alertRegistry.js').AlertRegistry} options.registry
 * @param {Array<Object>} options.data
 * @param {Function} options.onItemClick
 */
export function renderAllAlerts({ registry, data, onItemClick }) {
  registry.getAll().forEach((def) => {
    renderAlert({
      alertId: def.id,
      registry,
      data,
      onItemClick,
    });
  });
}

/**
 * Build the alert cards grid and slider controls in the DOM.
 * @param {Object} options
 * @param {import('../alerts/alertRegistry.js').AlertRegistry} options.registry
 * @param {Function} options.onThresholdChange
 */
export function buildDashboardCards({ registry, onThresholdChange }) {
  const grid = document.getElementById('dashboardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  registry.getAll().forEach(function (def) {
    const card = document.createElement('div');
    card.className = 'alert-card';
    card.id = 'card-' + def.id;

    const header = document.createElement('div');
    header.className = 'alert-card-header';
    header.innerHTML =
      '<div class="alert-info">' +
      '<div class="alert-title ' +
      def.color +
      '">' +
      def.title +
      '</div>' +
      '<div class="alert-subtitle">' +
      def.subtitle +
      '</div>' +
      '</div>' +
      '<div class="alert-count" id="count-' +
      def.id +
      '">—</div>';
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'alert-body';

    if (def.thresholds && def.thresholds.length > 0) {
      const threshDiv = document.createElement('div');
      threshDiv.className = 'threshold-controls';

      def.thresholds.forEach(function (t) {
        const row = document.createElement('div');
        row.className = 'threshold-row';
        row.innerHTML =
          '<span class="threshold-label">' +
          t.label +
          '</span>' +
          '<input type="range" class="threshold-slider" id="slider-' +
          def.id +
          '-' +
          t.key +
          '" min="' +
          t.min +
          '" max="' +
          t.max +
          '" step="' +
          t.step +
          '" value="' +
          t.defaultVal +
          '">' +
          '<span class="threshold-value" id="val-' +
          def.id +
          '-' +
          t.key +
          '">' +
          t.format(t.defaultVal) +
          '</span>';
        threshDiv.appendChild(row);

        const slider = row.querySelector('.threshold-slider');
        const valSpan = row.querySelector('.threshold-value');

        const debouncedUpdate = debounce(function () {
          if (typeof onThresholdChange === 'function') {
            onThresholdChange(def.id);
          }
        }, 150);

        slider.addEventListener('input', function () {
          const numericVal = parseFloat(slider.value);
          valSpan.textContent = t.format(numericVal);
          debouncedUpdate();
        });
      });

      body.appendChild(threshDiv);
    }

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'alert-items-list';
    itemsDiv.id = 'items-' + def.id;
    itemsDiv.innerHTML =
      '<div class="loading-spinner">Analyzing Data...</div>';
    body.appendChild(itemsDiv);

    card.appendChild(body);
    grid.appendChild(card);
  });
}
