import { calculateSummary } from '../services/analyticsService.js';
import { formatINR } from '../utils/formatters.js';

/**
 * Render summary statistics in the top metrics bar.
 * @param {Array<Object>} data - SKU rows
 * @param {string} [dataSource=''] - Source file name
 */
export function renderSummary(data, dataSource = '') {
  const s = calculateSummary(data, dataSource);

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
