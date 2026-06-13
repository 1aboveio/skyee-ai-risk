"""Analyze confirmed-fraud customers in dwd_customer and dwd_transaction."""
from pathlib import Path
import prestodb

LABEL_FILE = Path("docs/reference/label/confirmed_fraud_customer.txt")
HOST = "172.16.100.213"
PORT = 9666
USER = "data-analyst"
CATALOG = "hive"
SCHEMA = "usr_skyee_mw"


def connect():
    return prestodb.dbapi.connect(
        host=HOST, port=PORT, user=USER, catalog=CATALOG, schema=SCHEMA
    )


def load_ids():
    ids = []
    for line in LABEL_FILE.read_text().splitlines():
        line = line.strip()
        if line:
            ids.append(int(line))
    return sorted(set(ids)), ids


def main():
    unique_ids, raw_ids = load_ids()
    print(f"Loaded {len(raw_ids)} rows, {len(unique_ids)} unique confirmed-fraud cust_ids")

    id_list = ", ".join(str(i) for i in unique_ids)
    conn = connect()
    cur = conn.cursor()

    # Current customer snapshot (latest dt per cust_id)
    print("\n=== dwd_customer snapshot (latest dt per customer) ===")
    cur.execute(f"""
        SELECT
            cust_id,
            cust_type,
            cust_status,
            realname_status,
            risk_level,
            risk_score,
            sanctioned,
            high_risk,
            active_status,
            regist_country,
            verified_country,
            selected_identity_type,
            verified_name,
            company_legal_person_name,
            DATE(reg_time) AS reg_date,
            DATE(frozen_time) AS frozen_date,
            DATE(stopped_time) AS stopped_date,
            dt
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
            FROM dwd_customer
            WHERE cust_id IN ({id_list})
        )
        WHERE rn = 1
        ORDER BY cust_id
    """)
    cust_cols = [d[0] for d in cur.description]
    cust_rows = cur.fetchall()
    print(", ".join(cust_cols))
    for row in cust_rows:
        print(row)

    found_ids = {r[0] for r in cust_rows}
    missing = set(unique_ids) - found_ids
    if missing:
        print(f"\n{len(missing)} confirmed-fraud IDs NOT in dwd_customer:", sorted(missing))

    # Customer summary
    print("\n=== dwd_customer summary ===")
    cur.execute(f"""
        SELECT
            COUNT(DISTINCT cust_id) AS matched_customers,
            COUNT(*) FILTER (WHERE dt = (SELECT MAX(dt) FROM dwd_customer)) AS on_latest_dt,
            COUNT(*) FILTER (WHERE cust_status = 'NORMAL') AS normal_status,
            COUNT(*) FILTER (WHERE cust_status = 'FROZEN') AS frozen_status,
            COUNT(*) FILTER (WHERE cust_status = 'STOPPED') AS stopped_status,
            COUNT(*) FILTER (WHERE high_risk = 'Y') AS high_risk,
            COUNT(*) FILTER (WHERE sanctioned = 'Y') AS sanctioned,
            COUNT(*) FILTER (WHERE active_status = 'Y') AS active,
            COUNT(*) FILTER (WHERE active_status = 'N') AS inactive
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
            FROM dwd_customer
            WHERE cust_id IN ({id_list})
        )
        WHERE rn = 1
    """)
    print([d[0] for d in cur.description])
    print(cur.fetchone())

    # Transaction summary for the bad customers
    print("\n=== dwd_transaction summary for confirmed-fraud customers ===")
    cur.execute(f"""
        SELECT
            COUNT(DISTINCT cust_id) AS custs_with_txn,
            COUNT(*) AS total_txns,
            COUNT(*) FILTER (WHERE transaction_direction = 'PAY_OUT') AS pay_txns,
            COUNT(*) FILTER (WHERE transaction_direction = 'COLLECTION_IN') AS coll_txns,
            COUNT(*) FILTER (WHERE transaction_source = 'PAY') AS source_pay,
            COUNT(*) FILTER (WHERE transaction_source = 'COLL') AS source_coll,
            ROUND(SUM(txn_amount_cny), 2) AS total_amount_cny,
            ROUND(AVG(txn_amount_cny), 2) AS avg_amount_cny,
            ROUND(SUM(CASE WHEN transaction_direction = 'PAY_OUT' THEN txn_amount_cny ELSE 0 END), 2) AS pay_amount_cny,
            ROUND(SUM(CASE WHEN transaction_direction = 'COLLECTION_IN' THEN txn_amount_cny ELSE 0 END), 2) AS coll_amount_cny,
            COUNT(*) FILTER (WHERE is_cross_border = 'Y') AS cross_border_txns,
            COUNT(*) FILTER (WHERE is_refund = 'Y') AS refund_txns,
            COUNT(*) FILTER (WHERE is_pobo = 'Y') AS pobo_txns,
            COUNT(*) FILTER (WHERE is_agent_initiated = 'Y') AS agent_txns,
            MIN(txn_time) AS earliest_txn,
            MAX(txn_time) AS latest_txn
        FROM dwd_transaction
        WHERE cust_id IN ({id_list})
    """)
    print([d[0] for d in cur.description])
    print(cur.fetchone())

    # Transaction status distribution
    print("\n=== transaction status distribution ===")
    cur.execute(f"""
        SELECT txn_status, transaction_direction, COUNT(*) AS cnt
        FROM dwd_transaction
        WHERE cust_id IN ({id_list})
        GROUP BY txn_status, transaction_direction
        ORDER BY cnt DESC
    """)
    print([d[0] for d in cur.description])
    for row in cur.fetchall():
        print(row)

    # Customer profile distribution
    print("\n=== customer profile distribution ===")
    cur.execute(f"""
        SELECT
            cust_type,
            cust_status,
            risk_level,
            active_status,
            COUNT(*) AS cnt
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
            FROM dwd_customer
            WHERE cust_id IN ({id_list})
        )
        WHERE rn = 1
        GROUP BY cust_type, cust_status, risk_level, active_status
        ORDER BY cnt DESC
    """)
    print([d[0] for d in cur.description])
    for row in cur.fetchall():
        print(row)

    # Transaction-level detail
    print("\n=== transaction-level detail for confirmed-fraud customers ===")
    cur.execute(f"""
        SELECT
            cust_id,
            txn_id,
            transaction_source,
            transaction_direction,
            txn_status,
            txn_time,
            txn_amount,
            txn_currency,
            txn_amount_cny,
            is_cross_border,
            is_refund,
            is_pobo,
            is_agent_initiated,
            debtor_name,
            creditor_name,
            debtor_country,
            creditor_country,
            fund_purpose,
            pay_method
        FROM dwd_transaction
        WHERE cust_id IN ({id_list})
        ORDER BY txn_time
    """)
    print([d[0] for d in cur.description])
    for row in cur.fetchall():
        print(row)

    # Per-customer transaction summary
    print("\n=== per-customer transaction summary ===")
    cur.execute(f"""
        SELECT
            cust_id,
            COUNT(*) AS txns,
            ROUND(SUM(txn_amount_cny), 2) AS amount_cny,
            ROUND(AVG(txn_amount_cny), 2) AS avg_cny,
            COUNT(*) FILTER (WHERE transaction_direction = 'PAY_OUT') AS pays,
            COUNT(*) FILTER (WHERE transaction_direction = 'COLLECTION_IN') AS colls,
            COUNT(*) FILTER (WHERE is_cross_border = 'Y') AS cb,
            MIN(txn_time) AS first_txn,
            MAX(txn_time) AS last_txn
        FROM dwd_transaction
        WHERE cust_id IN ({id_list})
        GROUP BY cust_id
        ORDER BY amount_cny DESC NULLS LAST
    """)
    print([d[0] for d in cur.description])
    for row in cur.fetchall():
        print(row)

    # Benchmark vs all active customers
    print("\n=== benchmark: all-customer transaction averages ===")
    cur.execute("""
        SELECT
            COUNT(DISTINCT cust_id) AS total_custs,
            COUNT(*) AS total_txns,
            ROUND(SUM(txn_amount_cny), 2) AS total_amount_cny,
            ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT cust_id), 2) AS txns_per_cust,
            ROUND(SUM(txn_amount_cny) / COUNT(DISTINCT cust_id), 2) AS amount_per_cust
        FROM dwd_transaction
    """)
    print([d[0] for d in cur.description])
    print(cur.fetchone())

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
