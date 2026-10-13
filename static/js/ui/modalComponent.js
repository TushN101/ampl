import { escapeHtml, safeFloat } from '../utils/helpers.js';
import { formatINR } from '../utils/formatters.js';

/**
 * Close the item details modal overlay.
 */
export function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Populate and display SKU details in the modal dialog.
 * @param {Object} item - SKU record
 */
export function openModal(item) {
  const overlay = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  if (!overlay || !title || !body || !item) return;

  title.textContent = `${item.ROOT_PART_NUM} — ${item.PART_DESC}`;

  const stockMonths =
    item.AVG_CONSUMPTION > 0
      ? (item.STOCK_QTY / item.AVG_CONSUMPTION).toFixed(1)
      : 'N/A';
  const sovValue = item.SOQ_QTY * item.PURCHASE_PRICE;
  const stockValue = item.STOCK_QTY * item.PURCHASE_PRICE;
  const isDead = item.DEAD_STOCK_YN === 'Y';
  const isSuperseded = item.is_superseded;
  const isPna = item.STOCK_QTY === 0;
  const isNonOldPart =
    item.PART_FAMILY_AGE && item.PART_FAMILY_AGE !== 'Old Part';
  const isRequisitionOpen = item.CUST_BACK_ORDER > 0;
  const isReviewCandidate = isPna && isNonOldPart && isRequisitionOpen;

  const fields = [
    {
      label: 'Root Part Number',
      value: item.ROOT_PART_NUM,
      cls: isSuperseded ? 'highlight-orange' : '',
    },
    {
      label: 'Latest Part Number',
      value: item.LATEST_PART_NUM,
      cls: isSuperseded ? 'highlight-green' : '',
    },
    { label: 'Part Description', value: item.PART_DESC },
    {
      label: 'Part Family Age',
      value: item.PART_FAMILY_AGE || 'N/A',
      cls: isNonOldPart ? 'highlight-orange' : '',
    },
    {
      label: 'Current Stock',
      value: item.STOCK_QTY,
      cls: item.STOCK_QTY === 0 ? 'highlight-red' : '',
    },
    {
      label: 'On Order Qty',
      value: item.ON_ORDER_QTY,
      cls: item.ON_ORDER_QTY > 0 ? 'highlight-blue' : '',
    },
    {
      label: 'Customer Back Order',
      value: item.CUST_BACK_ORDER,
      cls: item.CUST_BACK_ORDER > 0 ? 'highlight-red' : '',
    },
    {
      label: 'Stock Value',
      value: formatINR(stockValue),
      cls: stockValue > 50000 ? 'highlight-yellow' : '',
    },
    {
      label: 'Months of Stock',
      value: stockMonths === 'N/A' ? 'N/A' : stockMonths + ' mo',
      cls: parseFloat(stockMonths) > 3 ? 'highlight-yellow' : '',
    },
    { label: 'Min Order Qty', value: item.MINIMUM_ORDER_QTY },
    {
      label: 'SOQ Qty',
      value: item.SOQ_QTY,
      cls: item.SOQ_QTY > 0 ? 'highlight-blue' : '',
    },
    {
      label: 'SOQ Value',
      value: formatINR(sovValue),
      cls: item.SOQ_QTY > 0 ? 'highlight-blue' : '',
    },
    {
      label: 'Avg Consumption (6m)',
      value: item.AVG_CONSUMPTION + ' / mo',
      cls:
        item.AVG_CONSUMPTION < 1
          ? 'highlight-yellow'
          : item.AVG_CONSUMPTION > 3
          ? 'highlight-green'
          : '',
    },
    { label: 'Wt Avg Consumption', value: item.WT_AVG_CONSUMPTION },
    { label: 'Transactions (6m)', value: item.TRANS_COUNT_6_MONTH },
    { label: 'Std Deviation', value: item.STANDARD_DEVIATION },
    { label: 'Re-Order Level', value: item.RE_ORDER_LEVEL },
    { label: 'Max Order Level', value: item.MAX_ORDER_LEVEL },
    {
      label: 'Purchase Price',
      value:
        '₹' +
        safeFloat(item.PURCHASE_PRICE).toLocaleString('en-IN', {
          maximumFractionDigits: 2,
        }),
    },
    { label: 'Lead Time', value: item.LEAD_TIME + ' days' },
    {
      label: 'Dead Stock',
      value: isDead ? 'YES' : 'NO',
      cls: isDead ? 'highlight-red' : 'highlight-green',
    },
    { label: 'Location', value: item.LOC_CD || 'N/A' },
  ];

  if (isReviewCandidate) {
    fields.unshift({
      label: '⚠ Review Trigger',
      value:
        'PNA + Service requisition + ' +
        (item.PART_FAMILY_AGE || 'non-Old-Part') +
        ' — manual review recommended before auto-order',
      cls: 'highlight-red',
    });
  }

  body.innerHTML = fields
    .map(function (f) {
      return (
        '<div class="detail-row">' +
        '<span class="detail-label">' +
        escapeHtml(f.label) +
        '</span>' +
        '<span class="detail-value ' +
        (f.cls || '') +
        '">' +
        escapeHtml(f.value) +
        '</span>' +
        '</div>'
      );
    })
    .join('');

  overlay.classList.add('active');
}

/**
 * Initialize event listeners for modal dismissal.
 */
export function initModal() {
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('modalClose');

  if (!overlay) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
}
