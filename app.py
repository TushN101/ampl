import io
import openpyxl
from flask import Flask, render_template, jsonify, request
from thefuzz import fuzz

app = Flask(__name__)

# Global in-memory data store
DATA = []
DATA_SOURCE = ""


def safe_int(v, default=0):
    if v is None:
        return default
    try:
        return int(v)
    except (ValueError, TypeError):
        return default


def safe_float(v, default=0.0):
    if v is None:
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def load_xlsx_from_bytes(file_bytes):
    """Parse Excel file directly from memory without saving to disk."""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        dead = str(row[28] or "N").strip().upper()
        if not dead or dead == "NONE":
            dead = "N"
        rows.append({
            "ROOT_PART_NUM": str(row[0] or "").strip(),
            "LATEST_PART_NUM": str(row[1] or "").strip(),
            "PART_DESC": str(row[2] or "").strip(),
            "PURCHASE_PRICE": safe_float(row[3]),
            "MINIMUM_ORDER_QTY": safe_int(row[4]),
            "LOC_CD": str(row[5] or "").strip(),
            "SLF_FACTOR": safe_float(row[6]),
            "LEAD_TIME": safe_int(row[7]),
            "ORDER_CYCLE": safe_int(row[8]),
            "ALPHA_VAL": safe_float(row[9]),
            "BETA_VAL": safe_float(row[10]),
            "TRANS_COUNT_6_MONTH": safe_int(row[11]),
            "STANDARD_DEVIATION": safe_float(row[12]),
            "AVG_CONSUMPTION": safe_float(row[13]),
            "WT_AVG_CONSUMPTION": safe_float(row[14]),
            "MIN_ORDER_LEVEL": safe_float(row[15]),
            "RE_ORDER_LEVEL": safe_float(row[16]),
            "MAX_ORDER_LEVEL": safe_int(row[17]),
            "OLD_MAX_LVL": safe_int(row[18]),
            "STOCK_QTY": safe_int(row[19]),
            "ON_ORDER_QTY": safe_int(row[20]),
            "CUST_BACK_ORDER": safe_int(row[21]),
            "OLD_CBO": safe_int(row[22]),
            "SOQ_QTY": safe_int(row[23]),
            "PARENT_GROUP": str(row[24] or "").strip(),
            "DEALER_MAP_CD": str(row[25] or "").strip(),
            "COMP_FA": str(row[26] or "").strip(),
            "PART_FAMILY_AGE": str(row[27] or "").strip(),
            "DEAD_STOCK_YN": dead,
            "is_superseded": str(row[0] or "") != str(row[1] or ""),
        })
    return rows


# --- Alert Functions ---

def alert_low_consumption_high_value(data, t_avg=1.0, t_price=2000):
    return [r for r in data if r["AVG_CONSUMPTION"] < t_avg and r["PURCHASE_PRICE"] > t_price and r["SOQ_QTY"] > 0]


def alert_high_moq_trap(data, t_stock=5, t_moq=5, t_avg=1.0):
    return [r for r in data if r["STOCK_QTY"] < t_stock and r["MINIMUM_ORDER_QTY"] >= t_moq and r["AVG_CONSUMPTION"] < t_avg and r["SOQ_QTY"] > 0]


def alert_dead_stock_misclassified(data, t_stock=5):
    return [r for r in data if r["SOQ_QTY"] > 0 and r["AVG_CONSUMPTION"] > 1 and r["STOCK_QTY"] <= t_stock and r["DEAD_STOCK_YN"] == "Y"]


def alert_double_order_risk(data):
    return [r for r in data if r["ON_ORDER_QTY"] > 0 and r["SOQ_QTY"] > 0]


ALERT_FUNCTIONS = {
    "low_consumption_high_value": alert_low_consumption_high_value,
    "high_moq_trap": alert_high_moq_trap,
    "dead_stock_misclassified": alert_dead_stock_misclassified,
    "double_order_risk": alert_double_order_risk,
}

ALERT_DEFAULTS = {
    "low_consumption_high_value": {"t_avg": 1.0, "t_price": 2000},
    "high_moq_trap": {"t_stock": 5, "t_moq": 5, "t_avg": 1.0},
    "dead_stock_misclassified": {"t_stock": 5},
    "double_order_risk": {},
}


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/summary")
def summary():
    return jsonify({
        "total_skus": len(DATA),
        "total_sov_value": round(sum(r["SOQ_QTY"] * r["PURCHASE_PRICE"] for r in DATA), 2),
        "total_stock_value": round(sum(r["STOCK_QTY"] * r["PURCHASE_PRICE"] for r in DATA), 2),
        "dead_stock_count": sum(1 for r in DATA if r["DEAD_STOCK_YN"] == "Y"),
        "zero_stock_count": sum(1 for r in DATA if r["STOCK_QTY"] == 0),
        "backorder_count": sum(1 for r in DATA if r["CUST_BACK_ORDER"] > 0),
        "on_order_count": sum(1 for r in DATA if r["ON_ORDER_QTY"] > 0),
        "data_source": DATA_SOURCE,
    })


@app.route("/api/alerts/<alert_id>")
def get_alert(alert_id):
    if alert_id not in ALERT_FUNCTIONS:
        return jsonify({"error": "Unknown alert"}), 404
    params = request.args.to_dict(flat=True)
    defaults = ALERT_DEFAULTS.get(alert_id, {})
    for k, v in defaults.items():
        if k not in params:
            params[k] = str(v)
    for k in list(params.keys()):
        if k.startswith("t_"):
            params[k] = float(params[k])
    try:
        items = ALERT_FUNCTIONS[alert_id](DATA, **{k: v for k, v in params.items() if k.startswith("t_")})
    except TypeError:
        items = []
    return jsonify({"alert_id": alert_id, "count": len(items), "items": items})


@app.route("/api/search")
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"query": "", "results": [], "total": 0})
    query_lower = query.lower()
    scored = []
    for row in DATA:
        if query_lower == row["ROOT_PART_NUM"].lower() or query_lower == row["LATEST_PART_NUM"].lower():
            scored.append((row, 100, "exact"))
            continue
        best = max(
            fuzz.token_set_ratio(query, row["ROOT_PART_NUM"]),
            fuzz.token_set_ratio(query, row["LATEST_PART_NUM"]),
            fuzz.token_set_ratio(query, row["PART_DESC"])
        )
        if (
            query_lower in row["ROOT_PART_NUM"].lower()
            or query_lower in row["LATEST_PART_NUM"].lower()
            or query_lower in row["PART_DESC"].lower()
        ):
            best = max(best, 80)
        if best >= 40:
            scored.append((row, best, "fuzzy"))
    scored.sort(key=lambda x: -x[1])
    return jsonify({
        "query": query,
        "results": [{"item": s[0], "score": s[1], "match_type": s[2]} for s in scored[:50]],
        "total": min(len(scored), 50)
    })


@app.route("/api/upload", methods=["POST"])
def upload():
    global DATA, DATA_SOURCE

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400
    if not f.filename.lower().endswith((".xlsx", ".xls")):
        return jsonify({"error": "Only .xlsx / .xls files are supported"}), 400

    try:
        # Read byte stream directly without saving to disk
        file_bytes = f.read()
        DATA = load_xlsx_from_bytes(file_bytes)
        DATA_SOURCE = f.filename
        return jsonify({"rows": len(DATA), "source": DATA_SOURCE})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
