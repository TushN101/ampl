/**
 * General helper utilities for data sanitization, formatting, and event control.
 */

/**
 * Safely convert value to integer.
 * @param {*} v - Input value
 * @param {number} [defaultVal=0] - Fallback value
 * @returns {number}
 */
export function safeInt(v, defaultVal = 0) {
  if (v === null || v === undefined || v === '') return defaultVal;
  const parsed = parseInt(v, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Safely convert value to float.
 * @param {*} v - Input value
 * @param {number} [defaultVal=0] - Fallback value
 * @returns {number}
 */
export function safeFloat(v, defaultVal = 0) {
  if (v === null || v === undefined || v === '') return defaultVal;
  const parsed = parseFloat(v);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Escape HTML special characters to prevent injection issues in rendered templates.
 * @param {string} str - Raw input string
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} waitMs - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, waitMs = 150) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, waitMs);
  };
}
