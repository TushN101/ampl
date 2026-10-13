import { safeFloat } from './helpers.js';

/**
 * Format a numeric amount as Indian Rupees (INR) with standard suffixes.
 * @param {number|string} num - Number to format
 * @returns {string} Formatted currency string
 */
export function formatINR(num) {
  const val = safeFloat(num);
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + '\u00A0Cr';
  if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + '\u00A0L';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

/**
 * Display part number representation, indicating supersession if applicable.
 * @param {Object} item - SKU record
 * @returns {string} Formatted part number
 */
export function displayPart(item) {
  if (!item) return '';
  if (item.is_superseded) {
    return item.ROOT_PART_NUM + ' → ' + item.LATEST_PART_NUM;
  }
  return item.ROOT_PART_NUM || '';
}
