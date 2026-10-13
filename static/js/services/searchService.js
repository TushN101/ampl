/**
 * Service for part number and description searching using exact match and Fuse.js fuzzy search.
 */
export class SearchService {
  #data = [];
  #fuse = null;

  /**
   * Initialize or re-index the search service with new SKU records.
   * @param {Array<Object>} data
   */
  init(data) {
    this.#data = Array.isArray(data) ? data : [];

    if (!this.#data.length || typeof Fuse === 'undefined') {
      this.#fuse = null;
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

    this.#fuse = new Fuse(this.#data, fuseOptions);
  }

  /**
   * Search parts by query string.
   * @param {string} query
   * @param {number} [maxResults=50]
   * @returns {Array<{ item: Object, score: number, matchType: 'exact'|'fuzzy' }>}
   */
  search(query, maxResults = 50) {
    if (!query || !query.trim() || !this.#data.length) {
      return [];
    }

    const trimmedQuery = query.trim().toLowerCase();

    // Fast path: exact match on part numbers
    const exactMatches = [];
    for (let i = 0; i < this.#data.length; i++) {
      const r = this.#data[i];
      if (
        trimmedQuery === (r.ROOT_PART_NUM || '').toLowerCase() ||
        trimmedQuery === (r.LATEST_PART_NUM || '').toLowerCase()
      ) {
        exactMatches.push({ item: r, score: 100, matchType: 'exact' });
      }
    }

    if (exactMatches.length > 0) {
      return exactMatches.slice(0, maxResults);
    }

    // Fuzzy search fallback
    if (!this.#fuse) {
      return [];
    }

    const results = this.#fuse.search(trimmedQuery);
    return results.slice(0, maxResults).map((res) => ({
      item: res.item,
      score: Math.round((1 - res.score) * 100),
      matchType: 'fuzzy',
    }));
  }
}

export const searchService = new SearchService();
