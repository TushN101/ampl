/**
 * Central state store managing application data and change notifications.
 */

export class Store {
  #state = {
    data: [],
    dataSource: '',
  };

  #subscribers = new Set();

  /**
   * Get current state snapshot.
   * @returns {{ data: Array<Object>, dataSource: string }}
   */
  getState() {
    return {
      data: this.#state.data,
      dataSource: this.#state.dataSource,
    };
  }

  /**
   * Get all active data rows.
   * @returns {Array<Object>}
   */
  getData() {
    return this.#state.data;
  }

  /**
   * Get the data source name.
   * @returns {string}
   */
  getDataSource() {
    return this.#state.dataSource;
  }

  /**
   * Update datasets and notify subscribers.
   * @param {Array<Object>} data - Parsed SKU rows
   * @param {string} dataSource - Name of uploaded source file
   */
  setData(data, dataSource = '') {
    this.#state.data = Array.isArray(data) ? data : [];
    this.#state.dataSource = dataSource;
    this.#notify();
  }

  /**
   * Subscribe a listener function to store updates.
   * @param {Function} listener - Callback receiving the updated state
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.#subscribers.add(listener);
    }
    return () => {
      this.#subscribers.delete(listener);
    };
  }

  /**
   * Notify all subscribers of state change.
   */
  #notify() {
    const currentState = this.getState();
    this.#subscribers.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in store subscriber:', err);
      }
    });
  }
}

export const store = new Store();
