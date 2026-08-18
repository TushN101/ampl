# SOQ Alert Dashboard System

A web-based analytics dashboard for Maruti DMS **Suggested Order Quantity (SOQ)** data.
Detects risky orders, misclassified dead stock, stockout risks, backorders, and more.

## Quick Start

```bash
# 1. Create virtual environment & install dependencies
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Place your SOQ XLSX export in the data/ folder
#    (drop the .xlsx file directly — no conversion needed)

# 3. Run the server
python run.py

# 4. Open in browser
# http://localhost:5000
```

> On Windows, use `venv\Scripts\activate` instead.
> Requires Python 3.9 or higher.

## Features

- **8 Alert Dashboards** with live threshold sliders:
  1. **Low Consumption + High Value** — expensive slow-movers with SOQ (customer may have left)
  2. **High MOQ Trap** — forced bulk order on slow-moving item
  3. **Dead Stock Misclassified** — flagged dead but has active demand, order blocked
  4. **Critical Stockout Risk** — expensive fast-mover running dry, no order planned
  5. **Superseded Part Active** — ROOT != LATEST part number but still ordering
  6. **Zero Stock Active Items** — demand exists but zero stock & no order
  7. **Pending Backorders** — customer backorder with zero/low stock
  8. **Double Order Risk** — On Order exists AND SOQ generated (potential overstock)

- **Fuzzy Search** — search by Root Part Number (A), Latest Part Number (B), Description (C)
- **Detail Modal** — click any item to see all 29 columns including backorders, on-order, lead time, etc.
- **Adjustable Thresholds** — drag sliders to fine-tune each alert's sensitivity
- **Mobile-First Design** — works on phone, tablet, and desktop

## Data Format

Drop your Maruti DMS SOQ `.xlsx` export into the `data/` folder.
Auto-detects all 29 standard columns (A through AC):

```
A: ROOT_PART_NUM    B: LATEST_PART_NUM   C: PART_DESC
D: PURCHASE_PRICE   E: MINIMUM_ORDER_QTY  H: LEAD_TIME
L: TRANS_COUNT_6_MONTH   M: STANDARD_DEVIATION
N: AVG_CONSUMPTION  O: WT_AVG_CONSUMPTION  T: STOCK_QTY
U: ON_ORDER_QTY    V: CUST_BACK_ORDER    X: SOQ_QTY
AB: PART_FAMILY_AGE   AC: DEAD_STOCK_YN
```

Legacy CSV format is also supported as fallback.

## Tech Stack

- Python 3.9+
- Flask
- openpyxl (XLSX reading)
- thefuzz (fuzzy string matching)
- Vanilla HTML/CSS/JS (no frontend framework)
