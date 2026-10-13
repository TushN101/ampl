import { safeFloat, safeInt } from '../utils/helpers.js';

/**
 * Read browser File instance into an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse Excel file data into structured SKU records using SheetJS.
 * @param {ArrayBuffer} arrayBuffer - Raw file buffer
 * @returns {{ rows: Array<Object>, source: string }}
 */
export function parseExcelFile(arrayBuffer) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS (XLSX) library is not available.');
  }

  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert worksheet to array of row arrays
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const rows = [];
  const startRow = 1; // Skip header row

  for (let i = startRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    let dead = String(row[28] || 'N').trim().toUpperCase();
    if (!dead || dead === 'NONE') dead = 'N';

    const rootPart = String(row[0] || '').trim();
    const latestPart = String(row[1] || '').trim();

    rows.push({
      ROOT_PART_NUM: rootPart,
      LATEST_PART_NUM: latestPart,
      PART_DESC: String(row[2] || '').trim(),
      PURCHASE_PRICE: safeFloat(row[3]),
      MINIMUM_ORDER_QTY: safeInt(row[4]),
      LOC_CD: String(row[5] || '').trim(),
      SLF_FACTOR: safeFloat(row[6]),
      LEAD_TIME: safeInt(row[7]),
      ORDER_CYCLE: safeInt(row[8]),
      ALPHA_VAL: safeFloat(row[9]),
      BETA_VAL: safeFloat(row[10]),
      TRANS_COUNT_6_MONTH: safeInt(row[11]),
      STANDARD_DEVIATION: safeFloat(row[12]),
      AVG_CONSUMPTION: safeFloat(row[13]),
      WT_AVG_CONSUMPTION: safeFloat(row[14]),
      MIN_ORDER_LEVEL: safeFloat(row[15]),
      RE_ORDER_LEVEL: safeFloat(row[16]),
      MAX_ORDER_LEVEL: safeInt(row[17]),
      OLD_MAX_LVL: safeInt(row[18]),
      STOCK_QTY: safeInt(row[19]),
      ON_ORDER_QTY: safeInt(row[20]),
      CUST_BACK_ORDER: safeInt(row[21]),
      OLD_CBO: safeInt(row[22]),
      SOQ_QTY: safeInt(row[23]),
      PARENT_GROUP: String(row[24] || '').trim(),
      DEALER_MAP_CD: String(row[25] || '').trim(),
      COMP_FA: String(row[26] || '').trim(),
      PART_FAMILY_AGE: String(row[27] || '').trim(),
      DEAD_STOCK_YN: dead,
      is_superseded: rootPart !== latestPart,
    });
  }

  return { rows, source: '' };
}
