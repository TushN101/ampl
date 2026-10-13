import { safeFloat, safeInt } from '../utils/helpers.js';
import { formatINR } from '../utils/formatters.js';

/**
 * Registry of default alert configurations and filtering rules.
 */
export const DEFAULT_ALERTS = [
  {
    id: 'low_consumption_high_value',
    title: 'Low Consumption + High Value',
    subtitle: 'Expensive slow-movers with SOQ suggested — customer may have left',
    color: 'text-ochre',
    thresholds: [
      {
        key: 't_avg',
        label: 'Avg Consumption <',
        min: 0,
        max: 5,
        step: 0.1,
        defaultVal: 1.0,
        format: (v) => safeFloat(v).toFixed(1),
      },
      {
        key: 't_price',
        label: 'Price > ₹',
        min: 500,
        max: 120000,
        step: 500,
        defaultVal: 2000,
        format: (v) => formatINR(safeFloat(v)),
      },
    ],
    valueTag: (r) => formatINR(r.PURCHASE_PRICE),
    filter: (data, params = {}) => {
      const t_avg = safeFloat(params.t_avg, 1.0);
      const t_price = safeFloat(params.t_price, 2000);
      return data.filter(
        (r) =>
          r.AVG_CONSUMPTION < t_avg &&
          r.PURCHASE_PRICE > t_price &&
          r.SOQ_QTY > 0
      );
    },
  },
  {
    id: 'high_moq_trap',
    title: 'High MOQ Trap',
    subtitle: 'Low stock + high MOQ + low consumption — forced bulk order',
    color: 'text-clay',
    thresholds: [
      {
        key: 't_stock',
        label: 'Stock <',
        min: 0,
        max: 20,
        step: 1,
        defaultVal: 5,
        format: (v) => Math.round(safeFloat(v)),
      },
      {
        key: 't_moq',
        label: 'MOQ >=',
        min: 1,
        max: 1000,
        step: 1,
        defaultVal: 5,
        format: (v) => Math.round(safeFloat(v)),
      },
      {
        key: 't_avg',
        label: 'Avg Consumption <',
        min: 0,
        max: 5,
        step: 0.1,
        defaultVal: 1.0,
        format: (v) => safeFloat(v).toFixed(1),
      },
    ],
    valueTag: (r) => 'MOQ: ' + r.MINIMUM_ORDER_QTY,
    filter: (data, params = {}) => {
      const t_stock = safeFloat(params.t_stock, 5);
      const t_moq = safeFloat(params.t_moq, 5);
      const t_avg = safeFloat(params.t_avg, 1.0);
      return data.filter(
        (r) =>
          r.STOCK_QTY < t_stock &&
          r.MINIMUM_ORDER_QTY >= t_moq &&
          r.AVG_CONSUMPTION < t_avg &&
          r.SOQ_QTY > 0
      );
    },
  },
  {
    id: 'dead_stock_misclassified',
    title: 'Dead Stock Misclassified',
    subtitle: 'Flagged dead but has demand — order blocked by incorrect marking',
    color: 'text-ochre',
    thresholds: [
      {
        key: 't_stock',
        label: 'Stock <=',
        min: 0,
        max: 20,
        step: 1,
        defaultVal: 5,
        format: (v) => Math.round(safeFloat(v)),
      },
    ],
    valueTag: (r) => 'Avg: ' + r.AVG_CONSUMPTION,
    filter: (data, params = {}) => {
      const t_stock = safeFloat(params.t_stock, 5);
      return data.filter(
        (r) =>
          r.SOQ_QTY > 0 &&
          r.AVG_CONSUMPTION > 1 &&
          r.STOCK_QTY <= t_stock &&
          r.DEAD_STOCK_YN === 'Y'
      );
    },
  },
  {
    id: 'double_order_risk',
    title: 'Double Order Risk',
    subtitle: 'On Order exists AND SOQ generated — potential overstock',
    color: 'text-sky',
    thresholds: [],
    valueTag: (r) => 'OnOrd: ' + r.ON_ORDER_QTY + ' + SOQ: ' + r.SOQ_QTY,
    filter: (data) => {
      return data.filter((r) => r.ON_ORDER_QTY > 0 && r.SOQ_QTY > 0);
    },
  },
  {
    id: 'new_part_pna_requisition',
    title: 'New Part — PNA with Service Requisition',
    subtitle: 'Out-of-stock new parts requested by Service — verify before auto-order',
    color: 'text-clay',
    thresholds: [
      {
        key: 't_cbo',
        label: 'Min Backorder (CBO) ≥',
        min: 1,
        max: 20,
        step: 1,
        defaultVal: 1,
        format: (v) => Math.round(safeFloat(v)),
      },
    ],
    valueTag: (r) => 'CBO: ' + r.CUST_BACK_ORDER,
    filter: (data, params = {}) => {
      const t_cbo = safeInt(params.t_cbo, 1);
      return data.filter(
        (r) =>
          r.STOCK_QTY === 0 &&
          r.CUST_BACK_ORDER >= t_cbo &&
          r.CUST_BACK_ORDER > 0 &&
          r.PART_FAMILY_AGE !== 'Old Part' &&
          String(r.PART_FAMILY_AGE || '').trim() !== ''
      );
    },
  },
];
