# Graph Table Design Proposal

**Author:** MiMo  
**Date:** 2026-06-12  
**Status:** Draft  
**Reference:** 关联图谱高价值字段20260430.xlsx

---

## 1. Overview

The graph table design enables relationship discovery between customers based on shared attributes. This is used for:
- Risk propagation (if one customer is high-risk, their connections may also be)
- Fraud detection (identifying suspicious patterns)
- Network analysis (understanding customer clusters)
- KYC enhancement (verifying customer relationships)

---

## 2. Table Designs

### 2.1 dwd_graph_nodes (Customer Nodes)

**Purpose:** Customer nodes in the graph

**Grain:** One row per customer (CUST_ID)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| cust_id | bigint | dwd_customer | Node ID (PK) |
| cust_type | varchar(20) | dwd_customer | PERSONAL / COMPANY |
| cust_name | varchar(150) | dwd_customer | Customer name |
| en_name | varchar(255) | dwd_customer | English name |
| risk_level | varchar(20) | dwd_customer | HIGH / MEDIUM_HIGH / MEDIUM / LOW |
| risk_score | decimal(4,2) | dwd_customer | Numeric risk score |
| is_sanctioned | char(1) | dwd_customer | Sanctioned flag |
| is_high_risk | char(1) | dwd_customer | High risk flag |
| cust_status | varchar(20) | dwd_customer | NORMAL / FROZEN / STOPPED |
| regist_country | varchar(10) | dwd_customer | Registration country |
| first_seen | timestamp | MIN(create_time) | First activity |
| last_seen | timestamp | MAX(lst_upd_time) | Last activity |
| dt | date | Derived | Partition column |

`node_degree` is not stored in `dwd_graph_nodes`. It is edge-derived and changes
whenever edge evidence changes, so the DuckDB query layer computes it from the
canonical edge snapshot.

---

### 2.2 dwd_graph_edges (Customer Connections)

**Purpose:** Connections between customers based on shared attributes

**Grain:** One row per unique connection between two customers

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| edge_id | bigint | Generated | Edge ID (PK) |
| source_cust_id | bigint | Various | Source node (FK) |
| target_cust_id | bigint | Various | Target node (FK) |
| edge_type | varchar(30) | Derived | See edge types below |
| edge_value | varchar(500) | The shared value | The actual matching value |
| edge_source | varchar(50) | Table name | Which table created this edge |
| strength | varchar(10) | Derived | Match strength: Strong / Weak |
| first_seen | timestamp | MIN(create_time) | First observed |
| last_seen | timestamp | MAX(lst_upd_time) | Last observed |
| record_count | int | COUNT | Number of records supporting this edge |
| dt | date | Derived | Event date for filtering, not the physical partition |
| etl_ts | timestamp | ETL runtime | Hudi precombine timestamp |

**Partition:** `edge_type`

The canonical edge table must not be partitioned by `first_seen` month. Reverse
backfills can discover older evidence for an existing edge, which legitimately
moves `first_seen` backward. Partitioning the canonical table by that value would
turn a normal correction into a partition move and make idempotent updates
fragile.

### 2.3 dwd_graph_edge_monthly (Monthly Edge Evidence)

**Purpose:** Idempotent monthly edge evidence used to support reverse backfill.

**Grain:** One row per `(edge_id, edge_source, edge_field, observed_month)`.

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| edge_month_id | bigint | Generated | Monthly evidence record key |
| edge_id | bigint | Generated | Canonical edge ID |
| source_cust_id | bigint | Various | Source node |
| target_cust_id | bigint | Various | Target node |
| edge_type | varchar(30) | Derived | Edge type |
| edge_value | varchar(500) | The shared value | Matching value |
| edge_source | varchar(50) | Table name | Source table |
| edge_field | varchar(100) | Field name | Source field/spec |
| strength | varchar(10) | Derived | Strong / Weak |
| first_seen | timestamp | MIN(create_time) | Earliest evidence timestamp in this monthly slice |
| last_seen | timestamp | MAX(lst_upd_time) | Latest evidence timestamp in this monthly slice |
| record_count | int | COUNT | Evidence support count in this monthly slice |
| observed_month | varchar(7) | Derived | `yyyy-MM`, or `unknown` if source timestamps are missing |
| dt | date | Derived | Observed date |
| etl_ts | timestamp | ETL runtime | Hudi precombine timestamp |

**Partition:** `edge_type, edge_source, edge_field, observed_month`

Backfill writes this table with partition overwrite. The canonical
`dwd_graph_edges` table is rebuilt/refreshed by aggregating monthly evidence:
`first_seen = min(first_seen)`, `last_seen = max(last_seen)`, and
`record_count = sum(record_count)`.

---

## 3. Edge Types

Based on the reference file (关联图谱高价值字段20260430.xlsx), the following edge types are defined:

| Edge Type | Source (Alias.Field) | Edge Value Format | Strength | Rationale |
|-----------|---------------------|-------------------|----------|-----------|
| **SAME_PHONE** | ci.CUST_MOBILE, ci.CONTACT_MOBILE, pd.MOBILE_NO, ba.RESERVED_MOBILE, po.SAME_NAME_PAYER_MOBILE | `+8613812345678` (E.164 format) | Strong | Phone numbers are unique identifiers |
| **SAME_EMAIL** | ci.EMAIL, ba.ENTITY_EMAIL, pd.BENEFICIARY_EMAIL | `user@example.com` | Strong | Email addresses are unique identifiers |
| **SAME_ENTITY_NAME** | ci.NAME (COMPANY), ci.EN_NAME (COMPANY), ba.ACCT_NAME, ft.BUYER_NAME, ft.SELLER_NAME, er.LEGAL_PERSON_NAME, er.ENTERPRISE_NAME | `ABC COMPANY LTD` | Strong | Entity names are unique identifiers |
| **SAME_PERSON_NAME** | ci.NAME (PERSONAL), ci.EN_NAME (PERSONAL), pr.NAME, pr.EN_NAME | `张三` | Weak | Person names can be similar without being same person |
| **SAME_ADDRESS** | pr.RESIDENCE_ADDRESS, pr.CERT_ADDRESS, ba.ENTITY_ADDRESS, co.PAYEE_ADDRESS | `北京市朝阳区xxx路xxx号` | Strong | Addresses can be shared by related entities |
| **SAME_ID_NO** | pr.CERT_NO, ba.ID_CARD_NO, pd.IDENTITY_NO, er.CERT_NO | `ID_CARD=110101199001011234` or `PASSPORT=E12345678` | Strong | Certificate numbers are unique identifiers |
| **SAME_STORE_URL** | si.STORE_URL, fl.GOODS_STORE_URL, er.COMPANY_WEBSITE_URL | `https://www.example.com/store` | Weak | Store URLs can be shared by related businesses |
| **SAME_IP** | ll.LOGIN_IP | `192.168.1.1` | Weak | IPs can be shared (office, VPN, etc.) |
| **COUNTERPARTY** | pd.PAY_ORDER_ID, pd.CUST_ID, pd.COUNTER_PARTY_ID, co.COLL_ORDER_ID, co.CUST_ID, co.COUNTER_PARTY_ID | `PAY:ORDER_ID=12345678:DEBTOR` or `COLL:ORDER_ID=87654321:CREDITOR` | Strong | Direct transaction relationship with side |
| **SIMILAR_ADDRESS** | pr.RESIDENCE_ADDRESS, pr.CERT_ADDRESS, ba.ENTITY_ADDRESS, co.PAYEE_ADDRESS | `北京市朝阳区xxx路xxx号 \|\| 北京市朝阳区xxx路xxx号` (source \|\| target) | Strong | Fuzzy address match via embedding similarity |

---

## 4. Edge Generation Logic

### 4.1 SAME_PHONE Edges

```sql
-- From stg_cust_customer_info (primary mobile)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_PHONE' as edge_type,
    a.cust_mobile as edge_value,
    'stg_cust_customer_info' as edge_source,
    'Strong' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_customer_info a
JOIN stg_cust_customer_info b ON a.cust_mobile = b.cust_mobile AND a.cust_id < b.cust_id
WHERE a.cust_mobile IS NOT NULL AND a.cust_mobile != '';

-- From stg_cust_customer_info (contact mobile)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_PHONE' as edge_type,
    a.contact_mobile as edge_value,
    'stg_cust_customer_info' as edge_source,
    'Strong' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_customer_info a
JOIN stg_cust_customer_info b ON a.contact_mobile = b.contact_mobile AND a.cust_id < b.cust_id
WHERE a.contact_mobile IS NOT NULL AND a.contact_mobile != '';
```

### 4.2 SAME_EMAIL Edges

```sql
-- From stg_cust_customer_info
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_EMAIL' as edge_type,
    a.email as edge_value,
    'stg_cust_customer_info' as edge_source,
    'Strong' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_customer_info a
JOIN stg_cust_customer_info b ON a.email = b.email AND a.cust_id < b.cust_id
WHERE a.email IS NOT NULL AND a.email != '';
```

### 4.3 SAME_ID_NO Edges

```sql
-- From stg_cust_person_realname_info (ID_CARD)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_ID_NO' as edge_type,
    CONCAT(a.cert_type, '=', a.cert_no) as edge_value,
    'stg_cust_person_realname_info' as edge_source,
    'Strong' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_person_realname_info a
JOIN stg_cust_person_realname_info b ON a.cert_no = b.cert_no AND a.cert_type = b.cert_type AND a.cust_id < b.cust_id
WHERE a.cert_no IS NOT NULL AND a.cert_no != ''
  AND a.cert_type IN ('ID_CARD', 'PASSPORT');  -- Only match same cert type
```

### 4.4 SAME_ADDRESS Edges

```sql
-- From stg_cust_person_realname_info (residence address)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_ADDRESS' as edge_type,
    a.residence_address as edge_value,
    'stg_cust_person_realname_info' as edge_source,
    'Strong' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_person_realname_info a
JOIN stg_cust_person_realname_info b ON a.residence_address = b.residence_address AND a.cust_id < b.cust_id
WHERE a.residence_address IS NOT NULL AND a.residence_address != '';
```

### 4.5 SAME_NAME Edges

```sql
-- From stg_cust_customer_info (cust_name)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_NAME' as edge_type,
    a.cust_name as edge_value,
    'stg_cust_customer_info' as edge_source,
    'Weak' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_customer_info a
JOIN stg_cust_customer_info b ON a.cust_name = b.cust_name AND a.cust_id < b.cust_id
WHERE a.cust_name IS NOT NULL AND a.cust_name != '';
```

### 4.6 SAME_STORE_URL Edges

```sql
-- From stg_cust_store_info
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_STORE_URL' as edge_type,
    a.store_url as edge_value,
    'stg_cust_store_info' as edge_source,
    'Weak' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_store_info a
JOIN stg_cust_store_info b ON a.store_url = b.store_url AND a.cust_id < b.cust_id
WHERE a.store_url IS NOT NULL AND a.store_url != '';
```

### 4.7 SAME_IP Edges

```sql
-- From stg_cust_user_login_log
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SAME_IP' as edge_type,
    a.login_ip as edge_value,
    'stg_cust_user_login_log' as edge_source,
    'Weak' as strength,
    MIN(a.create_time, b.create_time) as first_seen,
    MAX(a.lst_upd_time, b.lst_upd_time) as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_cust_user_login_log a
JOIN stg_cust_user_login_log b ON a.login_ip = b.login_ip AND a.cust_id < b.cust_id
WHERE a.login_ip IS NOT NULL AND a.login_ip != '';
```

### 4.8 COUNTERPARTY Edges

```sql
-- From stg_pmp_pay_details (payment counterparty)
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    a.counter_party_id as target_cust_id,
    'COUNTERPARTY' as edge_type,
    CAST(a.pay_order_id AS VARCHAR) as edge_value,
    'stg_pmp_pay_details' as edge_source,
    'Strong' as strength,
    a.create_time as first_seen,
    a.lst_upd_time as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM stg_pmp_pay_details a
WHERE a.counter_party_id IS NOT NULL 
  AND a.cust_id != a.counter_party_id
  AND a.cust_id < a.counter_party_id;
```

### 4.9 SIMILAR_ADDRESS Edges (Fuzzy Match)

```sql
-- Pre-compute address embeddings
CREATE TABLE dwd_address_embeddings AS
SELECT 
    cust_id,
    address,
    address_type,
    embedding  -- Vector embedding of normalized address
FROM (
    -- Person residence addresses
    SELECT 
        cust_id,
        residence_address as address,
        'RESIDENCE' as address_type,
        embedding_normalize(embed(residence_address)) as embedding
    FROM stg_cust_person_realname_info
    WHERE residence_address IS NOT NULL AND residence_address != ''
    
    UNION ALL
    
    -- Person cert addresses
    SELECT 
        cust_id,
        cert_address as address,
        'CERT' as address_type,
        embedding_normalize(embed(cert_address)) as embedding
    FROM stg_cust_person_realname_info
    WHERE cert_address IS NOT NULL AND cert_address != ''
    
    UNION ALL
    
    -- Enterprise addresses
    SELECT 
        cust_id,
        residence_address as address,
        'ENTERPRISE' as address_type,
        embedding_normalize(embed(residence_address)) as embedding
    FROM stg_cust_enterprise_realname_info
    WHERE residence_address IS NOT NULL AND residence_address != ''
    
    UNION ALL
    
    -- Bank account entity addresses
    SELECT 
        cust_id,
        entity_address as address,
        'BANK_ENTITY' as address_type,
        embedding_normalize(embed(entity_address)) as embedding
    FROM stg_cust_bank_acct_info
    WHERE entity_address IS NOT NULL AND entity_address != ''
);

-- Find similar addresses using cosine similarity
INSERT INTO dwd_graph_edges
SELECT 
    ROW_NUMBER() OVER () + (SELECT MAX(edge_id) FROM dwd_graph_edges) as edge_id,
    a.cust_id as source_cust_id,
    b.cust_id as target_cust_id,
    'SIMILAR_ADDRESS' as edge_type,
    CONCAT(a.address, ' || ', b.address) as edge_value,
    'address_embedding' as edge_source,
    -- Strength based on cosine similarity
    CASE 
        WHEN cosine_similarity(a.embedding, b.embedding) >= 0.90 THEN 'Strong'
        ELSE 'Weak'
    END as strength,
    CURRENT_TIMESTAMP as first_seen,
    CURRENT_TIMESTAMP as last_seen,
    1 as record_count,
    CURRENT_DATE as dt
FROM dwd_address_embeddings a
JOIN dwd_address_embeddings b ON a.cust_id < b.cust_id
WHERE cosine_similarity(a.embedding, b.embedding) >= 0.80  -- Similarity threshold
  AND a.address != b.address;  -- Exclude exact matches (already covered by SAME_ADDRESS)
```

---

## 5. Graph Query Examples

### 5.1 Find All Connections for a Customer

```sql
SELECT target_cust_id, edge_type, edge_value, strength
FROM dwd_graph_edges
WHERE source_cust_id = 12345
UNION ALL
SELECT source_cust_id, edge_type, edge_value, strength
FROM dwd_graph_edges
WHERE target_cust_id = 12345
ORDER BY CASE strength WHEN 'Strong' THEN 0 ELSE 1 END;
```

### 5.2 Find Shortest Path Between Two Customers

```sql
WITH RECURSIVE path AS (
    SELECT source_cust_id, target_cust_id, edge_type, 
           ARRAY[source_cust_id, target_cust_id] as visited,
           1 as depth
    FROM dwd_graph_edges
    WHERE source_cust_id = 12345
    
    UNION ALL
    
    SELECT e.source_cust_id, e.target_cust_id, e.edge_type,
           p.visited || e.target_cust_id,
           p.depth + 1
    FROM dwd_graph_edges e
    JOIN path p ON e.source_cust_id = p.target_cust_id
    WHERE e.target_cust_id != 67890
      AND e.target_cust_id != ALL(p.visited)
      AND p.depth < 6
)
SELECT * FROM path WHERE target_cust_id = 67890 LIMIT 1;
```

### 5.3 Find High-Risk Connected Customers

```sql
SELECT DISTINCT n.cust_id, n.cust_name, n.risk_level, e.edge_type, e.strength
FROM dwd_graph_edges e
JOIN dwd_graph_nodes n ON (e.target_cust_id = n.cust_id OR e.source_cust_id = n.cust_id)
WHERE (e.source_cust_id = 12345 OR e.target_cust_id = 12345)
  AND n.risk_level IN ('HIGH', 'MEDIUM_HIGH')
  AND n.cust_id != 12345
ORDER BY CASE e.strength WHEN 'Strong' THEN 0 ELSE 1 END;
```

### 5.4 Find Shared Attributes Between Two Customers

```sql
SELECT edge_type, edge_value, strength
FROM dwd_graph_edges
WHERE (source_cust_id = 12345 AND target_cust_id = 67890)
   OR (source_cust_id = 67890 AND target_cust_id = 12345)
ORDER BY CASE strength WHEN 'Strong' THEN 0 ELSE 1 END;
```

---

## 6. Design Decisions

### 6.1 Edge Direction

**Decision:** Store edges as one direction only (source_cust_id < target_cust_id)

**Rationale:**
- Reduces storage by 50%
- Simplifies deduplication
- Queries can use UNION ALL to get bidirectional results

### 6.2 Edge Strength

**Decision:** Classify each edge type as Strong or Weak based on how uniquely the attribute identifies a relationship

| Edge Type | Strength | Rationale |
|-----------|----------|-----------|
| SAME_ID_NO | Strong | Certificate numbers are unique identifiers |
| SAME_PHONE | Strong | Phone numbers are unique identifiers |
| SAME_EMAIL | Strong | Email addresses are unique identifiers |
| SAME_ADDRESS | Strong | Addresses can be shared by related entities |
| SAME_ENTITY_NAME | Strong | Entity names are unique identifiers |
| COUNTERPARTY | Strong | Direct transaction relationship |
| SAME_PERSON_NAME | Weak | Person names can be similar without being same person |
| SAME_STORE_URL | Weak | Store URLs can be shared by related businesses |
| SAME_IP | Weak | IPs can be shared (office, VPN, etc.) |

### 6.3 Edge Merging

**Decision:** Create separate edges for each attribute match

**Rationale:**
- More granular analysis
- Can aggregate if needed
- Easier to debug and audit

### 6.4 Temporal Tracking

**Decision:** Track first_seen and last_seen timestamps

**Rationale:**
- Enables time-based analysis
- Can identify stale edges
- Supports audit requirements

### 6.5 Edge Pruning

**Decision:** Keep all edges, but mark stale ones

**Rationale:**
- Historical analysis
- Can filter by last_seen in queries
- Audit trail maintained

---

## 7. Implementation Plan

### Phase 1: Table Creation (Week 1)
- [x] Create `dwd_graph_nodes` table
- [x] Create `dwd_graph_edges` table
- [ ] Set up partitioning

### Phase 2: Edge Generation (Week 2)
- [x] Implement SAME_PHONE edges
- [x] Implement SAME_EMAIL edges
- [x] Implement SAME_ID_NO edges

### Phase 3: Additional Edges (Week 3)
- [x] Implement SAME_ADDRESS edges
- [x] Implement SAME_NAME edges
- [x] Implement SAME_STORE_URL edges
- [x] Implement SAME_IP edges

### Phase 4: Query Optimization (Week 4)
- [ ] Create indexes on edge tables
- [ ] Optimize recursive queries
- [ ] Performance testing

---

## 8. Audit Requirements

### 8.1 Data Quality Checks

| Check | Description | Threshold |
|-------|-------------|-----------|
| Node Count | All customers should have nodes | 100% coverage |
| Edge Count | Reasonable number of edges | > 0, < 10x node count |
| Strength Values | Must be 'Strong' or 'Weak' | 100% valid |
| No Self-Loops | source_cust_id != target_cust_id | 0 violations |

### 8.2 Edge-Specific Checks

| Edge Type | Check | Threshold |
|-----------|-------|-----------|
| SAME_PHONE | Phone format valid | 100% valid |
| SAME_EMAIL | Email format valid | 100% valid |
| SAME_CERT_NO | Cert length valid | 100% valid |
| SAME_ADDRESS | Address not empty | 100% non-empty |

---

## 9. Glossary

| Term | Definition |
|------|------------|
| Node | A customer entity in the graph |
| Edge | A relationship between two customers |
| Edge Type | The type of shared attribute (phone, email, etc.) |
| Edge Value | The actual shared value |
| Strength | How uniquely the attribute identifies the relationship (Strong / Weak) |
| Node Degree | Number of connections a node has |
| Cluster | A group of connected customers |
| Path | A sequence of edges connecting two nodes |

---

## Appendix: Reference File Fields

From 关联图谱高价值字段20260430.xlsx:

| Table | Table Comment | Column | Column Comment |
|-------|---------------|--------|----------------|
| cust_store_info | 店铺信息 | STORE_URL | 店铺连接 |
| pmp_pay_order | 付款订单表 | SAME_NAME_PAYER_MOBILE | 同名付款人手机号 |
| pmp_pay_order | 付款订单表 | SAME_NAME_PAYER_NAME | 同名付款人名称 |
| pmp_pay_order | 付款订单表 | SAME_NAME_PAYER_CERT_NO | 同名付款人证件号 |
| pmp_pay_details | 付款明细表 | COLL_EN_ADDRESS | 收款人英文地址 |
| pmp_pay_details | 付款明细表 | IDENTITY_NO | 证件号码 |
| pmp_pay_details | 付款明细表 | EMAIL | 邮箱 |
| pmp_pay_details | 付款明细表 | BENEFICIARY_IDENTIFICATION_NO | 受益人证件号码 |
| pmp_pay_details | 付款明细表 | BENEFICIARY_EMAIL | 受益人邮箱 |
| pmp_pay_details | 付款明细表 | MOBILE_NO | 手机号码 |
| pmp_pay_details | 付款明细表 | COLL_ADDRESS | 收款人地址 |
| cust_person_realname_info | 个人实名认证信息 | RESIDENCE_ADDRESS | 居住地详细地址 |
| cust_person_realname_info | 个人实名认证信息 | CERT_NO | 证件号 |
| cust_person_realname_info | 个人实名认证信息 | CERT_ADDRESS | 证件详细地址 |
| cust_person_realname_info | 个人实名认证信息 | EN_NAME | 英文名称 |
| cust_customer_info | 客户基础信息 | CUST_MOBILE | 手机号 |
| cust_customer_info | 客户基础信息 | EMAIL | 电子邮箱 |
| cust_customer_info | 客户基础信息 | EN_NAME | 英文名称 |
| cust_customer_info | 客户基础信息 | CUST_NAME | 客户名称 |
| cust_customer_info | 客户基础信息 | CONTACT_MOBILE | 联系手机号 |
| cust_foreign_trade_order | 客户外贸订单表 | BUYER_NAME | 买方名称 |
| cust_foreign_trade_order | 客户外贸订单表 | SELLER_NAME | 卖方名称 |
| cust_bank_acct_info | 客户银行账号信息 | ENTITY_ADDRESS | 主体详细地址 |
| cust_bank_acct_info | 客户银行账号信息 | REF_COMPANY_CERT_NO | 关联企业证件号 |
| cust_bank_acct_info | 客户银行账号信息 | ACCT_NAME | 户名 |
| cust_bank_acct_info | 客户银行账号信息 | ENTITY_ADDRESS | 详细地址 |
| cust_bank_acct_info | 客户银行账号信息 | ID_CARD_NO | 身份证号 |
| cust_bank_acct_info | 客户银行账号信息 | ENTITY_IDENTIFICATION_NO | 主体证件号码 |
| cust_bank_acct_info | 客户银行账号信息 | ENTITY_EN_ADDRESS | 主体详细英文地址 |
| cust_bank_acct_info | 客户银行账号信息 | ENTITY_EMAIL | 主体邮箱 |
| cust_bank_acct_info | 客户银行账号信息 | PHONE_NO | 电话号码 |
| cust_bank_acct_info | 客户银行账号信息 | ACCT_EN_NAME | 英文户名 |
| cust_bank_acct_info | 客户银行账号信息 | RESERVED_MOBILE | 预留手机号 |
| cust_enterprise_realname_info | 企业实名认证信息 | RESIDENCE_ADDRESS | 居住地详细地址 |
| cust_enterprise_realname_info | 企业实名认证信息 | LEGAL_PERSON_NAME | 法人名称 |
| cust_enterprise_realname_info | 企业实名认证信息 | COMPANY_WEBSITE_URL | 线上店铺网址 |
| cust_enterprise_realname_info | 企业实名认证信息 | CERT_NO | 证书编号 |
| cust_enterprise_realname_info | 企业实名认证信息 | CERT_ADDRESS | 证件所在详细地址 |
| cust_enterprise_realname_info | 企业实名认证信息 | ENTERPRISE_NAME | 企业名称 |
| cust_enterprise_realname_info | 企业实名认证信息 | EN_NAME | 企业英文名称 |
| pmp_coll_order | 收款订单表 | PAYEE_ADDRESS | 收款方地址 |
| cust_collections_acct | 收款账号表 | ACCT_NAME | 户名 |
| cust_foreign_trade_order_logistics | 外贸订单物流信息表 | GOODS_STORE_URL | 商品店铺链接 |
| cust_user_login_log | 用户登录日志 | LOGIN_IP | LOGIN_IP |
