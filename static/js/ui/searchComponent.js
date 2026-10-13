import { escapeHtml } from '../utils/helpers.js';
import { displayPart, formatINR } from '../utils/formatters.js';

/**
 * Execute search query, render results list, and wire item selection handlers.
 * @param {string} query
 * @param {import('../services/searchService.js').SearchService} searchService
 * @param {boolean} hasData
 * @param {Function} onSelectResult
 */
export function executeSearch(query, searchService, hasData, onSelectResult) {
  const resultsDiv = document.getElementById('searchResults');
  if (!resultsDiv) return;

  if (!hasData) {
    resultsDiv.innerHTML =
      '<div class="search-no-results">Please upload data first.</div>';
    resultsDiv.classList.add('active');
    resultsDiv.classList.remove('hidden');
    return;
  }

  const results = searchService.search(query);

  if (results.length === 0) {
    resultsDiv.innerHTML =
      '<div class="search-no-results">No items found for "' +
      escapeHtml(query) +
      '"</div>';
    resultsDiv.classList.add('active');
    resultsDiv.classList.remove('hidden');
    return;
  }

  resultsDiv.innerHTML = results
    .map(function (r) {
      return (
        '<div class="search-result-item" data-part="' +
        escapeHtml(r.item.ROOT_PART_NUM) +
        '">' +
        '<div class="sr-part">' +
        escapeHtml(displayPart(r.item)) +
        ' <span class="search-badge font-mono">' +
        escapeHtml(r.matchType) +
        ' ' +
        r.score +
        '%</span></div>' +
        '<div class="sr-name">' +
        escapeHtml(r.item.PART_DESC) +
        '</div>' +
        '<div class="sr-meta">' +
        '<span>STK: ' +
        r.item.STOCK_QTY +
        '</span>' +
        '<span>PRC: ' +
        formatINR(r.item.PURCHASE_PRICE) +
        '</span>' +
        '<span>AVG: ' +
        r.item.AVG_CONSUMPTION +
        '/mo</span>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  resultsDiv.classList.add('active');
  resultsDiv.classList.remove('hidden');

  resultsDiv.querySelectorAll('.search-result-item').forEach(function (el) {
    el.addEventListener('click', function () {
      const partNum = el.dataset.part;
      const match = results.find((r) => r.item.ROOT_PART_NUM === partNum);
      if (match) {
        if (typeof onSelectResult === 'function') {
          onSelectResult(match.item);
        }
        resultsDiv.classList.remove('active');
        resultsDiv.classList.add('hidden');
      }
    });
  });
}

/**
 * Initialize search bar inputs and keyboard/click listeners.
 * @param {Object} options
 * @param {import('../services/searchService.js').SearchService} options.searchService
 * @param {Function} options.getData
 * @param {Function} options.onSelectResult
 */
export function initSearch({ searchService, getData, onSelectResult }) {
  const input = document.getElementById('searchInput');
  const resultsDiv = document.getElementById('searchResults');

  if (!input || !resultsDiv) return;

  let searchTimeout = null;

  input.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const q = input.value.trim();

    if (q.length < 2) {
      resultsDiv.classList.remove('active');
      resultsDiv.classList.add('hidden');
      resultsDiv.innerHTML = '';
      return;
    }

    searchTimeout = setTimeout(function () {
      const data = typeof getData === 'function' ? getData() : [];
      executeSearch(q, searchService, data && data.length > 0, onSelectResult);
    }, 250);
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-section')) {
      resultsDiv.classList.remove('active');
      resultsDiv.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      resultsDiv.classList.remove('active');
      resultsDiv.classList.add('hidden');
    }
  });
}
