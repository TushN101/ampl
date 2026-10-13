/**
 * Compute aggregate summary statistics across loaded SKU inventory records.
 * @param {Array<Object>} data - SKU rows
 * @param {string} [dataSource=''] - Source file name
 * @returns {Object} Calculated metrics
 */
export function calculateSummary(data, dataSource = '') {
  if (!data || data.length === 0) {
    return {
      total_skus: 0,
      total_sov_value: 0,
      total_stock_value: 0,
      dead_stock_count: 0,
      zero_stock_count: 0,
      backorder_count: 0,
      on_order_count: 0,
      data_source: dataSource,
    };
  }

  let totalSovValue = 0;
  let totalStockValue = 0;
  let deadStockCount = 0;
  let zeroStockCount = 0;
  let backorderCount = 0;
  let onOrderCount = 0;

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    totalSovValue += r.SOQ_QTY * r.PURCHASE_PRICE;
    totalStockValue += r.STOCK_QTY * r.PURCHASE_PRICE;

    if (r.DEAD_STOCK_YN === 'Y') deadStockCount++;
    if (r.STOCK_QTY === 0) zeroStockCount++;
    if (r.CUST_BACK_ORDER > 0) backorderCount++;
    if (r.ON_ORDER_QTY > 0) onOrderCount++;
  }

  return {
    total_skus: data.length,
    total_sov_value: Math.round(totalSovValue * 100) / 100,
    total_stock_value: Math.round(totalStockValue * 100) / 100,
    dead_stock_count: deadStockCount,
    zero_stock_count: zeroStockCount,
    backorder_count: backorderCount,
    on_order_count: onOrderCount,
    data_source: dataSource,
  };
}
