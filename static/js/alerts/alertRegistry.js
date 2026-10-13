/**
 * Registry to manage, retrieve, and evaluate alert rules.
 */
export class AlertRegistry {
  #alerts = new Map();

  /**
   * @param {Array<Object>} [initialAlerts=[]]
   */
  constructor(initialAlerts = []) {
    this.registerAll(initialAlerts);
  }

  /**
   * Register a new alert rule definition.
   * @param {Object} def - Alert configuration object
   */
  register(def) {
    if (!def || !def.id) {
      throw new Error('Alert definition must have a unique id.');
    }
    this.#alerts.set(def.id, def);
  }

  /**
   * Register multiple alert rule definitions.
   * @param {Array<Object>} defs
   */
  registerAll(defs) {
    if (Array.isArray(defs)) {
      defs.forEach((def) => this.register(def));
    }
  }

  /**
   * Retrieve all registered alert configurations.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this.#alerts.values());
  }

  /**
   * Retrieve a specific alert definition by ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  get(id) {
    return this.#alerts.get(id);
  }

  /**
   * Evaluate an alert rule against data and parameter thresholds.
   * @param {string} id - Alert identifier
   * @param {Array<Object>} data - SKU rows
   * @param {Object} [params={}] - User threshold overrides
   * @returns {{ alertId: string, count: number, items: Array<Object> }}
   */
  evaluateAlert(id, data = [], params = {}) {
    const def = this.get(id);
    if (!def) {
      return { alertId: id, count: 0, items: [] };
    }

    const effectiveParams = {};
    if (def.thresholds) {
      def.thresholds.forEach((t) => {
        effectiveParams[t.key] =
          params[t.key] !== undefined ? params[t.key] : t.defaultVal;
      });
    }

    const items = typeof def.filter === 'function' ? def.filter(data, effectiveParams) : [];

    return {
      alertId: id,
      count: items.length,
      items,
    };
  }
}

export const alertRegistry = new AlertRegistry();
