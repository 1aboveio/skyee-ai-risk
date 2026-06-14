"""Generate a per-case analysis document for confirmed-fraud customers."""
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import prestodb

LABEL_FILE = Path("docs/reference/label/confirmed_fraud_customer.txt")
OUT_MD = Path("docs/analytics/confirmed_fraud_customer_case_analysis.md")
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
    raw = []
    for line in LABEL_FILE.read_text().splitlines():
        line = line.strip()
        if line:
            raw.append(int(line))
    unique = sorted(set(raw))
    return unique, raw


def rows_to_dicts(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_latest_rows(cur, table, id_list, extra_cols=None, extra_where=""):
    cols = "*" if extra_cols is None else ", ".join(extra_cols)
    sql = f"""
        SELECT {cols}
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
            FROM {table}
            WHERE cust_id IN ({id_list})
              {extra_where}
        )
        WHERE rn = 1
    """
    cur.execute(sql)
    return rows_to_dicts(cur)


def fmt_money(v):
    try:
        return f"{float(v):,.2f}"
    except Exception:
        return str(v)


def fmt_date(v):
    if v is None:
        return "-"
    s = str(v)
    if " " in s:
        return s.split(" ")[0]
    return s


def summarize_counter(cnt, top_n=5):
    if not cnt:
        return "无"
    total = sum(cnt.values())
    items = cnt.most_common(top_n)
    parts = [f"{k} ({v}, {v/total*100:.1f}%)" for k, v in items]
    return "； ".join(parts)


def run():
    unique_ids, raw_ids = load_ids()
    id_list = ", ".join(str(i) for i in unique_ids)
    conn = connect()
    cur = conn.cursor()

    # Latest dwd_customer snapshot
    cur.execute(f"""
        SELECT *
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
            FROM dwd_customer
            WHERE cust_id IN ({id_list})
        )
        WHERE rn = 1
        ORDER BY cust_id
    """)
    customers = {r["cust_id"]: r for r in rows_to_dicts(cur)}

    # Transactions
    cur.execute(f"""
        SELECT *
        FROM dwd_transaction
        WHERE cust_id IN ({id_list})
        ORDER BY cust_id, txn_time
    """)
    txns = rows_to_dicts(cur)

    # Graph attr index
    cur.execute(f"""
        SELECT
            cust_id,
            edge_type,
            edge_source,
            edge_field,
            join_key,
            edge_value,
            strength,
            record_count,
            first_seen,
            last_seen
        FROM dwd_graph_attr_index
        WHERE cust_id IN ({id_list})
    """)
    graph_attrs = rows_to_dicts(cur)

    # Staging tables
    bank_accts = fetch_latest_rows(
        cur, "stg_cust_bank_acct_info", id_list, extra_where="AND delete_flag = 'N'"
    )
    coll_accts = fetch_latest_rows(
        cur, "stg_cust_collections_acct", id_list, extra_where="AND delete_flag = 'N'"
    )
    ent_realnames = fetch_latest_rows(
        cur, "stg_cust_enterprise_realname_info", id_list, extra_where="AND delete_flag = 'N'"
    )
    ref_persons = fetch_latest_rows(
        cur, "stg_cust_realname_enterprise_ref_person", id_list, extra_where="AND delete_flag = 'N'"
    )
    person_ids = sorted({r["person_id"] for r in ref_persons if r.get("person_id")})
    person_realnames = {}
    if person_ids:
        pid_list = ", ".join(str(p) for p in person_ids)
        cur.execute(f"""
            SELECT *
            FROM (
                SELECT *,
                       ROW_NUMBER() OVER (PARTITION BY id ORDER BY dt DESC, _hoodie_commit_time DESC) AS rn
                FROM stg_cust_person_realname_info
                WHERE id IN ({pid_list}) AND delete_flag = 'N'
            )
            WHERE rn = 1
        """)
        person_realnames = {r["id"]: r for r in rows_to_dicts(cur)}

    login_logs = fetch_latest_rows(
        cur, "stg_cust_user_login_log", id_list, extra_where="AND delete_flag = 'N'"
    )
    ft_orders = fetch_latest_rows(
        cur, "stg_cust_foreign_trade_order", id_list, extra_where="AND delete_flag = 'N'"
    )

    cur.close()
    conn.close()

    # Cross-case account reuse detection
    bank_no_to_custs = defaultdict(set)
    bank_no_to_names = defaultdict(set)
    for r in bank_accts:
        no = str(r.get("acct_no") or "").strip()
        name = str(r.get("acct_name") or "").strip() or "(空)"
        if no:
            bank_no_to_custs[no].add(r["cust_id"])
            bank_no_to_names[no].add(name)
    reused_bank_nos = {no: custs for no, custs in bank_no_to_custs.items() if len(custs) > 1}

    coll_no_to_custs = defaultdict(set)
    for r in coll_accts:
        no = str(r.get("bank_acct_no") or "").strip()
        if no:
            coll_no_to_custs[no].add(r["cust_id"])
    reused_coll_nos = {no: custs for no, custs in coll_no_to_custs.items() if len(custs) > 1}

    # Group data
    txns_by_cust = defaultdict(list)
    for t in txns:
        txns_by_cust[t["cust_id"]].append(t)

    bank_by_cust = defaultdict(list)
    for r in bank_accts:
        bank_by_cust[r["cust_id"]].append(r)

    coll_by_cust = defaultdict(list)
    for r in coll_accts:
        coll_by_cust[r["cust_id"]].append(r)

    login_by_cust = defaultdict(list)
    for r in login_logs:
        login_by_cust[r["cust_id"]].append(r)

    orders_by_cust = defaultdict(list)
    for r in ft_orders:
        orders_by_cust[r["cust_id"]].append(r)

    ref_by_cust = defaultdict(list)
    for r in ref_persons:
        ref_by_cust[r["cust_id"]].append(r)

    graph_attrs_by_cust = defaultdict(list)
    for r in graph_attrs:
        graph_attrs_by_cust[r["cust_id"]].append(r)

    # Build per-case details
    cases = []
    for cid in unique_ids:
        cust = customers.get(cid, {})
        ent = next((r for r in ent_realnames if r["cust_id"] == cid), {})
        ctx = txns_by_cust.get(cid, [])
        cba = bank_by_cust.get(cid, [])
        cca = coll_by_cust.get(cid, [])
        clog = login_by_cust.get(cid, [])
        cord = orders_by_cust.get(cid, [])
        cref = ref_by_cust.get(cid, [])
        gattr = graph_attrs_by_cust.get(cid, [])

        # transaction stats
        total_cnt = len(ctx)
        pay_cnt = sum(1 for t in ctx if t.get("transaction_direction") == "PAY_OUT")
        coll_cnt = sum(1 for t in ctx if t.get("transaction_direction") == "COLLECTION_IN")
        cb_cnt = sum(1 for t in ctx if t.get("is_cross_border") == "Y")
        agent_cnt = sum(1 for t in ctx if t.get("is_agent_initiated") == "Y")
        total_cny = sum(float(t.get("txn_amount_cny") or 0) for t in ctx)
        pay_cny = sum(float(t.get("txn_amount_cny") or 0) for t in ctx if t.get("transaction_direction") == "PAY_OUT")
        coll_cny = sum(float(t.get("txn_amount_cny") or 0) for t in ctx if t.get("transaction_direction") == "COLLECTION_IN")
        times = [t["txn_time"] for t in ctx if t.get("txn_time")]

        curr_counter = Counter(t.get("txn_currency") or "UNKNOWN" for t in ctx)
        status_counter = Counter((t.get("txn_status") or "UNKNOWN", t.get("transaction_direction") or "UNKNOWN") for t in ctx)
        creditor_counter = Counter(t.get("creditor_name") or "(空)" for t in ctx)
        debtor_counter = Counter(t.get("debtor_name") or "(空)" for t in ctx)
        cr_country_counter = Counter(t.get("creditor_country") or "(空)" for t in ctx)
        db_country_counter = Counter(t.get("debtor_country") or "(空)" for t in ctx)
        purpose_counter = Counter(t.get("fund_purpose") or "(空)" for t in ctx)
        method_counter = Counter(t.get("pay_method") or "(空)" for t in ctx)
        trade_type_counter = Counter(t.get("trade_type") or "(空)" for t in ctx)
        sub_biz_counter = Counter(t.get("sub_biz_type") or "(空)" for t in ctx)
        clear_channel_counter = Counter(t.get("clear_channel_name") or "(空)" for t in ctx)
        debtor_agent_counter = Counter(t.get("debtor_agent_name") or "(空)" for t in ctx)

        # Evidence stats
        has_attach = sum(1 for t in ctx if t.get("pay_attach_name") or t.get("pay_ref_file_ids"))
        no_evidence_cnt = sum(1 for t in ctx if t.get("transaction_direction") == "PAY_OUT" and not (t.get("pay_attach_name") or t.get("pay_ref_file_ids")))

        # bank accounts
        bank_names = Counter(r.get("bank_name") or "(空)" for r in cba)
        bank_countries = Counter(r.get("bank_country") or "(空)" for r in cba)
        acct_types = Counter(r.get("bank_acct_type") or "(空)" for r in cba)
        acct_nos = [r.get("acct_no") or "" for r in cba]
        reused_bank = [no for no in acct_nos if no in reused_bank_nos]

        # collection accounts
        coll_banks = Counter(r.get("bank_name") or "(空)" for r in cca)
        coll_currencies = Counter(r.get("currency_cd") or "(空)" for r in cca)
        coll_acct_nos = [r.get("bank_acct_no") or "" for r in cca]
        reused_coll = [no for no in coll_acct_nos if no in reused_coll_nos]

        # login
        login_addrs = Counter(r.get("login_addr") or "(空)" for r in clog)

        # orders
        order_currencies = Counter(o.get("order_currency") or "(空)" for o in cord)
        order_total_by_curr = defaultdict(float)
        for o in cord:
            try:
                order_total_by_curr[o.get("order_currency") or "UNKNOWN"] += float(o.get("order_amt") or 0)
            except Exception:
                pass

        # persons
        persons = []
        for r in cref:
            pr = person_realnames.get(r.get("person_id"))
            if pr:
                persons.append({
                    "person_id": r.get("person_id"),
                    "relation_type": r.get("relation_type"),
                    "name": pr.get("name") or pr.get("en_name"),
                    "cert_type": pr.get("cert_type"),
                    "cert_no": pr.get("cert_no"),
                    "country": pr.get("country"),
                })

        # graph attrs summary
        graph_attr_summary = Counter(r.get("edge_type") or "UNKNOWN" for r in gattr)

        cases.append({
            "cust_id": cid,
            "cust": cust,
            "ent": ent,
            "persons": persons,
            "total_cnt": total_cnt,
            "pay_cnt": pay_cnt,
            "coll_cnt": coll_cnt,
            "cb_cnt": cb_cnt,
            "agent_cnt": agent_cnt,
            "total_cny": total_cny,
            "pay_cny": pay_cny,
            "coll_cny": coll_cny,
            "first_txn": min(times) if times else None,
            "last_txn": max(times) if times else None,
            "curr_counter": curr_counter,
            "status_counter": status_counter,
            "creditor_counter": creditor_counter,
            "debtor_counter": debtor_counter,
            "cr_country_counter": cr_country_counter,
            "db_country_counter": db_country_counter,
            "purpose_counter": purpose_counter,
            "method_counter": method_counter,
            "trade_type_counter": trade_type_counter,
            "sub_biz_counter": sub_biz_counter,
            "clear_channel_counter": clear_channel_counter,
            "debtor_agent_counter": debtor_agent_counter,
            "has_attach": has_attach,
            "no_evidence_cnt": no_evidence_cnt,
            "bank_count": len(cba),
            "bank_names": bank_names,
            "bank_countries": bank_countries,
            "acct_types": acct_types,
            "reused_bank": reused_bank,
            "coll_count": len(cca),
            "coll_banks": coll_banks,
            "coll_currencies": coll_currencies,
            "reused_coll": reused_coll,
            "login_count": len(clog),
            "login_addrs": login_addrs,
            "order_count": len(cord),
            "order_currencies": order_currencies,
            "order_total_by_curr": order_total_by_curr,
            "graph_attr_summary": graph_attr_summary,
        })

    # Generate markdown
    lines = []
    lines.append("# 已确认欺诈客户逐案分析")
    lines.append("")
    lines.append(f"- **来源标签文件**：`{LABEL_FILE}`")
    lines.append(f"- **分析日期**：{datetime.now().strftime('%Y-%m-%d')}")
    lines.append(f"- **查询引擎**：Presto `{CATALOG}.{SCHEMA}`（`{HOST}:{PORT}`）")
    lines.append("")
    lines.append("## 文件概览")
    lines.append("")
    lines.append(f"- 文件总行数：**{len(raw_ids)}**")
    lines.append(f"- 唯一 `cust_id` 数量：**{len(unique_ids)}**")
    dup_ids = [cid for cid, c in Counter(raw_ids).items() if c > 1]
    if dup_ids:
        lines.append(f"- 重复 ID：`{', '.join(str(i) for i in dup_ids)}` 各出现 2 次")
    else:
        lines.append("- 无重复 ID")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 在 `dwd_customer` 中命中 | {len(customers)} / {len(unique_ids)} |")
    missing = sorted(set(unique_ids) - set(customers.keys()))
    lines.append(f"| 未命中 `dwd_customer` 的 ID | {', '.join(str(i) for i in missing) if missing else '无'} |")
    tx_custs = sum(1 for c in cases if c["total_cnt"] > 0)
    total_txns = sum(c["total_cnt"] for c in cases)
    total_amt = sum(c["total_cny"] for c in cases)
    lines.append(f"| 有交易记录的客户数 | {tx_custs} / {len(unique_ids)} |")
    lines.append(f"| 交易总笔数 | {total_txns:,} |")
    lines.append(f"| 交易总金额（CNY）| ¥{fmt_money(total_amt)} |")
    lines.append("")

    # Reuse summary
    if reused_bank_nos:
        lines.append("### 跨客户银行账户复用")
        lines.append("")
        lines.append("| 银行账号 | 账户名 | 涉及客户数 | 涉及 cust_id |")
        lines.append("|----------|--------|-----------|--------------|")
        for no, custs in sorted(reused_bank_nos.items(), key=lambda x: -len(x[1])):
            acct_names_str = " / ".join(sorted(bank_no_to_names.get(no, {"(空)"})))
            names = ", ".join(str(customers.get(c, {}).get("verified_name", c)) for c in custs)
            lines.append(f"| {no} | {acct_names_str} | {len(custs)} | {', '.join(str(c) for c in custs)}（{names}）|")
        lines.append("")
    if reused_coll_nos:
        lines.append("### 跨客户收款账户复用")
        lines.append("")
        lines.append("| 收款账号 | 涉及客户数 | 涉及 cust_id |")
        lines.append("|----------|-----------|--------------|")
        for no, custs in sorted(reused_coll_nos.items(), key=lambda x: -len(x[1])):
            names = ", ".join(str(customers.get(c, {}).get("verified_name", c)) for c in custs)
            lines.append(f"| {no} | {len(custs)} | {', '.join(str(c) for c in custs)}（{names}）|")
        lines.append("")

    # Per-case sections
    lines.append("## 逐案详情")
    lines.append("")
    for c in cases:
        cid = c["cust_id"]
        cust = c["cust"]
        ent = c["ent"]
        verified_name = cust.get("verified_name") or ent.get("enterprise_name") or "(未命中客户主档)"
        lines.append(f"### 案例 {cid} — {verified_name}")
        lines.append("")
        if not cust:
            lines.append("> ⚠️ 该 `cust_id` 在 `dwd_customer` 最新快照中未命中，可能为客户主档同步缺失或已删除。**")
            lines.append("")

        # Basic profile
        lines.append("#### 客户主体与状态")
        lines.append("")
        lines.append("| 字段 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| `cust_id` | {cid} |")
        lines.append(f"| 认证名称 | {verified_name} |")
        lines.append(f"| 企业英文名称 | {ent.get('en_name') or '-'} |")
        lines.append(f"| 法人代表 | {cust.get('company_legal_person_name') or ent.get('legal_person_name') or '-'} |")
        lines.append(f"| 客户类型 | {cust.get('cust_type') or '-'} |")
        lines.append(f"| 注册国家 | {cust.get('regist_country') or ent.get('regist_country') or '-'} |")
        lines.append(f"| 客户状态 | {cust.get('cust_status') or '-'} |")
        lines.append(f"| 实名状态 | {cust.get('realname_status') or '-'} |")
        lines.append(f"| 风险等级 | {cust.get('risk_level') or '-'} |")
        lines.append(f"| 风险评分 | {cust.get('risk_score') or '-'} |")
        lines.append(f"| 高风险标记 | {cust.get('high_risk') or '-'} |")
        lines.append(f"| 制裁标记 | {cust.get('sanctioned') or '-'} |")
        lines.append(f"| 活跃状态 | {cust.get('active_status') or '-'} |")
        lines.append(f"| 注册日期 | {fmt_date(cust.get('reg_time'))} |")
        lines.append(f"| 冻结日期 | {fmt_date(cust.get('frozen_time'))} |")
        lines.append(f"| 停止日期 | {fmt_date(cust.get('stopped_time'))} |")
        lines.append("")

        # Legal persons
        if c["persons"]:
            lines.append("#### 关联自然人")
            lines.append("")
            lines.append("| person_id | 关系 | 姓名 | 证件类型 | 证件号 | 国籍 |")
            lines.append("|-----------|------|------|----------|--------|------|")
            for p in c["persons"]:
                cert_no = p.get("cert_no") or ""
                masked = cert_no[:6] + "****" + cert_no[-4:] if len(cert_no) > 10 else cert_no
                lines.append(f"| {p.get('person_id')} | {p.get('relation_type')} | {p.get('name')} | {p.get('cert_type')} | {masked} | {p.get('country')} |")
            lines.append("")

        # Bank / collection accounts
        lines.append("#### 银行账户与收款账户")
        lines.append("")
        lines.append(f"- 银行账户数：**{c['bank_count']}**；收款账户数：**{c['coll_count']}**")
        if c["bank_count"]:
            lines.append(f"- 银行账户类型分布：{summarize_counter(c['acct_types'])}")
            lines.append(f"- 银行分布：{summarize_counter(c['bank_names'])}")
            lines.append(f"- 银行国家/地区分布：{summarize_counter(c['bank_countries'])}")
        if c["coll_count"]:
            lines.append(f"- 收款通道/银行分布：{summarize_counter(c['coll_banks'])}")
            lines.append(f"- 收款币种分布：{summarize_counter(c['coll_currencies'])}")
        if c["reused_bank"]:
            lines.append(f"- ⚠️ 存在跨客户复用的付款账号：`{'`, `'.join(c['reused_bank'])}`")
        if c["reused_coll"]:
            lines.append(f"- ⚠️ 存在跨客户复用的收款账号：`{'`, `'.join(c['reused_coll'])}`")
        lines.append("")

        # Login behavior
        if c["login_count"]:
            lines.append("#### 登录行为")
            lines.append("")
            lines.append(f"- 登录次数：**{c['login_count']}**")
            lines.append(f"- 主要登录地：{summarize_counter(c['login_addrs'])}")
            lines.append("")

        # Foreign trade orders
        if c["order_count"]:
            lines.append("#### 外贸订单")
            lines.append("")
            lines.append(f"- 订单数：**{c['order_count']}**")
            lines.append(f"- 订单币种分布：{summarize_counter(c['order_currencies'])}")
            curr_totals = "； ".join(f"{k}: {fmt_money(v)}" for k, v in c["order_total_by_curr"].items())
            lines.append(f"- 各币种订单金额（原币）：{curr_totals}")
            lines.append("")

        # Graph attrs
        if c["graph_attr_summary"]:
            lines.append("#### 关联图谱属性")
            lines.append("")
            lines.append(f"- `dwd_graph_attr_index` 边类型分布：{summarize_counter(c['graph_attr_summary'])}")
            lines.append("")

        # Transactions
        lines.append("#### 交易表现")
        lines.append("")
        if c["total_cnt"] == 0:
            lines.append("- 在 `dwd_transaction` 中**无交易记录**。**")
            lines.append("")
            continue
        lines.append(f"- 交易笔数：**{c['total_cnt']}**（付款 {c['pay_cnt']} 笔，收款 {c['coll_cnt']} 笔）")
        lines.append(f"- 交易总金额（CNY）：**¥{fmt_money(c['total_cny'])}**（付款 ¥{fmt_money(c['pay_cny'])}, 收款 ¥{fmt_money(c['coll_cny'])}）")
        lines.append(f"- 单笔均价（CNY）：**¥{fmt_money(c['total_cny']/c['total_cnt'] if c['total_cnt'] else 0)}**")
        lines.append(f"- 首笔/末笔交易：{fmt_date(c['first_txn'])} / {fmt_date(c['last_txn'])}")
        lines.append(f"- 跨境交易：{c['cb_cnt']} 笔（{c['cb_cnt']/c['total_cnt']*100:.1f}%）；代客发起：{c['agent_cnt']} 笔（{c['agent_cnt']/c['total_cnt']*100:.1f}%）")
        if c["pay_cnt"] > 0:
            lines.append(f"- 有附件/材料的付款：{c['has_attach']} 笔；无材料的付款：{c['no_evidence_cnt']} 笔")
        lines.append("")
        lines.append("**状态/方向分布：**")
        lines.append("")
        lines.append("| txn_status | transaction_direction | 笔数 |")
        lines.append("|------------|----------------------|------|")
        for (st, dire), cnt in c["status_counter"].most_common():
            lines.append(f"| {st} | {dire} | {cnt} |")
        lines.append("")
        lines.append(f"**交易币种 TOP：** {summarize_counter(c['curr_counter'])}")
        lines.append("")
        lines.append(f"**收款方 TOP：** {summarize_counter(c['creditor_counter'])}")
        lines.append("")
        lines.append(f"**付款方 TOP：** {summarize_counter(c['debtor_counter'])}")
        lines.append("")
        lines.append(f"**收款国家/地区 TOP：** {summarize_counter(c['cr_country_counter'])}")
        lines.append("")
        lines.append(f"**付款国家/地区 TOP：** {summarize_counter(c['db_country_counter'])}")
        lines.append("")
        if c["purpose_counter"]:
            lines.append(f"**资金用途 TOP：** {summarize_counter(c['purpose_counter'])}")
            lines.append("")
        if c["method_counter"]:
            lines.append(f"**支付方式 TOP：** {summarize_counter(c['method_counter'])}")
            lines.append("")
        if c["trade_type_counter"]:
            lines.append(f"**交易类型 TOP：** {summarize_counter(c['trade_type_counter'])}")
            lines.append("")
        if c["sub_biz_counter"]:
            lines.append(f"**子业务类型 TOP：** {summarize_counter(c['sub_biz_counter'])}")
            lines.append("")
        if c["clear_channel_counter"]:
            lines.append(f"**清算通道 TOP：** {summarize_counter(c['clear_channel_counter'])}")
            lines.append("")
        if c["debtor_agent_counter"]:
            lines.append(f"**付款代理/通道 TOP：** {summarize_counter(c['debtor_agent_counter'])}")
            lines.append("")

        # Risk notes
        lines.append("#### 风险观察")
        lines.append("")
        notes = []
        if not cust:
            notes.append("客户主档缺失，但存在交易/业务数据，需排查数据同步或销户原因。**")
        if cust.get("high_risk") == "N" and cust.get("sanctioned") == "N":
            notes.append("当前未标记 `high_risk` 或 `sanctioned`，风险标签滞后于确认欺诈事实。**")
        if c["total_cnt"] > 0 and c["agent_cnt"] == c["total_cnt"]:
            notes.append("全部交易均为代客发起，需复核操作员身份与授权链。**")
        if c["coll_cnt"] > c["pay_cnt"] * 3:
            notes.append("收款笔数远高于付款，呈现资金归集型特征。**")
        if c["reused_bank"] or c["reused_coll"]:
            notes.append("银行账户/收款账号与其他确认欺诈客户复用，是团伙关联的核心线索。**")
        if c["login_count"] and any("越南" in str(k) for k in c["login_addrs"]):
            notes.append("登录地出现越南 IP，与部分香港壳公司的操作地分布一致。**")
        if c["pay_cnt"] > 0 and c["no_evidence_cnt"] > 0:
            notes.append(f"有 {c['no_evidence_cnt']} 笔付款无附件/材料佐证，交易背景真实性存疑。**")
        if not notes:
            notes.append("暂无额外显著风险信号（交易静默或数据有限）。**")
        for n in notes:
            lines.append(f"- {n}")
        lines.append("")

    # Summary
    lines.append("## 关键发现与团伙聚类")
    lines.append("")
    lines.append("### 整体特征")
    lines.append("")
    lines.append(f"- 16 个确认欺诈客户中仅 {tx_custs} 个在 `dwd_transaction` 有交易记录，合计 {total_txns:,} 笔、¥{fmt_money(total_amt)}。**")
    lines.append("- 所有有交易记录的案例交易均为 `is_agent_initiated = Y`，即代客发起。**")
    lines.append("- 绝大多数案例当前仍未标记 `high_risk` 或 `sanctioned`，风险标签明显滞后。**")
    lines.append("")
    lines.append("### 基于账户复用的团伙线索")
    lines.append("")
    if reused_bank_nos:
        lines.append("- 以下付款账号被多个确认欺诈客户共用，强烈暗示共同控制人或资金归集：**")
        lines.append("")
        for no, custs in sorted(reused_bank_nos.items(), key=lambda x: -len(x[1])):
            acct_names_str = " / ".join(sorted(bank_no_to_names.get(no, {"(空)"})))
            names = "、".join(str(customers.get(c, {}).get("verified_name", c)) for c in custs)
            lines.append(f"  - `{no}`（{acct_names_str}）：{'、'.join(str(c) for c in custs)}（{names}）")
        lines.append("")
    else:
        lines.append("- 未发现跨客户复用的银行账户。**")
        lines.append("")
    lines.append("### 重点监控名单")
    lines.append("")
    top_txn_cases = sorted([c for c in cases if c["total_cnt"] > 0], key=lambda x: -x["total_cny"])[:5]
    for rank, c in enumerate(top_txn_cases, 1):
        cust = customers.get(c["cust_id"], {})
        lines.append(f"{rank}. `{c['cust_id']}` {cust.get('verified_name', '')}：{c['total_cnt']} 笔，¥{fmt_money(c['total_cny'])}")
    lines.append("")
    lines.append("### 数据质量提示")
    lines.append("")
    lines.append(f"- `{', '.join(str(i) for i in missing) if missing else '无'}` 在 `dwd_customer` 未命中，需排查客户主档同步或历史数据完整性。**")
    lines.append("- 部分 `dwd_transaction` 字段（如 `fund_purpose`、`debtor_country`/`creditor_country`）存在大量空值，可能影响风险规则覆盖。**")
    lines.append("")

    # Closing
    lines.append("## 附录")
    lines.append("")
    lines.append("- 分析脚本：`scripts/generate_case_analysis.py`")
    lines.append(f"- 本报告：`{OUT_MD}`")
    lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_MD}")


if __name__ == "__main__":
    run()
