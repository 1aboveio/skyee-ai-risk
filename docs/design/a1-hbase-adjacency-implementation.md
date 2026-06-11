# 1aboveio/a1 HBase Adjacency List Implementation

**Source:** ~/projects/a1/backend/blockchain/

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AdjacencyWriter                          │
│  (Service layer - creates edges from transactions)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AdjacencyDAL                             │
│  (Data Access Layer - reads/writes to HBase)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      HBase                                  │
│  Table: blockchain:adjacency                                │
│  Column Family: e (edges)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### 2.1 RowKey Design

```
Format: {chain_id}~{field}~{value}
Example: 1~from_address~0xabc123...
```

**Key Insight:** The rowkey includes the **field name** (from_address, to_address) to enable bidirectional queries.

### 2.2 Column Qualifier Design

```
Format: {chain_id}~tx_hash~{timestamp}~{tx_hash}
Example: 1~tx_hash~2024-01-01T00:00:00~0xdef456...
```

**Key Insight:** The qualifier includes timestamp and tx_hash for uniqueness and time-based filtering.

### 2.3 Cell Value

```json
{
  "tx_hash": "0xdef456...",
  "block_number": 12345678,
  "block_timestamp": "2024-01-01T00:00:00",
  "from_address": "0xabc123...",
  "to_address": "0x789def...",
  "value_wei": "1000000000000000000",
  "gas_used": 21000,
  "gas_price": 20000000000,
  "method_id": "0x",
  "is_contract_call": false,
  "chain_id": 1
}
```

---

## 3. Edge Creation

### 3.1 Bidirectional Edges

For each transaction, **two edges** are created:

```python
# Forward edge: from_address -> to_address
src = BlockchainVertex(chain_id=1, key="from_address", value="0xabc...")
dst = BlockchainVertex(chain_id=1, key="to_address", value="0x789...")
edge_forward = BlockchainEdge(src_vertex=src, dst_vertex=dst, attr=attr)

# Reverse edge: to_address -> from_address
src_rev = BlockchainVertex(chain_id=1, key="to_address", value="0x789...")
dst_rev = BlockchainVertex(chain_id=1, key="from_address", value="0xabc...")
edge_reverse = BlockchainEdge(src_vertex=src_rev, dst_vertex=dst_rev, attr=attr)
```

### 3.2 RowKey Examples

For transaction from `0xabc` to `0x789`:

| RowKey | Qualifier | Value |
|--------|-----------|-------|
| `1~from_address~0xabc` | `1~tx_hash~2024-01-01~0xdef` | `{...tx details...}` |
| `1~to_address~0x789` | `1~tx_hash~2024-01-01~0xdef` | `{...tx details...}` |
| `1~to_address~0x789` | `1~tx_hash~2024-01-01~0xdef` | `{...tx details...}` |
| `1~from_address~0xabc` | `1~tx_hash~2024-01-01~0xdef` | `{...tx details...}` |

---

## 4. Query Pattern

### 4.1 Get Neighbors (Single-Hop)

```python
async def _get_neighbors_hbase(self, chain_id, address, direction, ...):
    address_lower = address.lower()
    
    # Build prefix for direction
    if direction in ("out", "both"):
        prefix = f"{chain_id}~from_address~{address_lower}"
    if direction in ("in", "both"):
        prefix = f"{chain_id}~to_address~{address_lower}"
    
    # Scan with prefix filter
    filter_obj = PrefixFilter(prefix)
    rows = pool.scan(table_name, filter=filter_obj.to_filter_string(), limit=limit)
    
    # Parse results
    for rowkey, columns in rows:
        for qualifier, value in columns.items():
            attr = json.loads(value)
            # Filter by timestamp if needed
            results.append(attr)
```

### 4.2 HBase Shell Equivalent

```bash
# Get all outgoing edges for address 0xabc
scan 'blockchain:adjacency', {STARTROW => '1~from_address~0xabc', STOPROW => '1~from_address~0xabc~', LIMIT => 100}

# Get all incoming edges for address 0x789
scan 'blockchain:adjacency', {STARTROW => '1~to_address~0x789', STOPROW => '1~to_address~0x789~', LIMIT => 100}
```

---

## 5. Key Design Decisions

### 5.1 Bidirectional Storage

**Decision:** Store both forward and reverse edges separately.

**Rationale:**
- Enables efficient "who sent to X" and "who received from X" queries
- No need to scan entire table for reverse lookups
- Trade-off: 2x storage, but query performance is O(1) for both directions

### 5.2 Field Name in RowKey

**Decision:** Include field name (from_address, to_address) in rowkey.

**Rationale:**
- Enables prefix-based scanning for specific directions
- Allows querying "all transactions where X is sender" vs "all transactions where X is receiver"
- RowKey format: `{chain_id}~{field}~{value}`

### 5.3 Timestamp in Qualifier

**Decision:** Include timestamp in column qualifier.

**Rationale:**
- Enables time-based filtering
- Provides natural ordering within row
- Allows multiple edges between same pair of addresses

### 5.4 Append-Only

**Decision:** HBase adjacency is append-only (no deletes).

**Rationale:**
- HBase is optimized for writes, not deletes
- Old edges naturally superseded by newer ones
- Simplifies implementation

---

## 6. Configuration

```python
# HBase Settings
HBASE_ADJACENCY_ENABLED: bool = False  # Feature flag
HBASE_THRIFT2_HOST: str = "localhost"
HBASE_THRIFT2_PORT: int = 9091
HBASE_THRIFT2_TRANSPORT: Literal["buffered", "framed"] = "buffered"
HBASE_THRIFT2_PROTOCOL: Literal["binary", "compact"] = "binary"
HBASE_NAMESPACE: str = "blockchain"
HBASE_POOL_SIZE: int = 10
FAMILY_EDGE: str = "e"

# Adjacency Configuration
TRACKING_FIELDS: list[str] = ["from_address", "to_address"]
INDEX_FIELDS: list[str] = ["token_address", "contract_address"]
ENTITY_FIELDS: list[str] = ["tx_hash"]
```

---

## 7. Dual Backend Support

The implementation supports **dual backend**:

1. **HBase** (when `HBASE_ADJACENCY_ENABLED=True`)
   - High-performance graph queries
   - Prefix-based scanning
   - Append-only writes

2. **PostgreSQL** (fallback when HBase disabled)
   - Aggregation-based queries
   - No separate graph storage
   - Slower but simpler

---

## 8. Adaptation for Skyee

To adapt this for Skyee's customer graph:

### 8.1 RowKey Design

```
Format: {edge_type}~{field}~{value}
Example: SAME_PHONE~cust_mobile~+8613812345678
```

### 8.2 Column Qualifier

```
Format: {source_cust_id}~{target_cust_id}~{timestamp}
Example: 12345~67890~2026-06-01T00:00:00
```

### 8.3 Cell Value

```json
{
  "source_cust_id": 12345,
  "target_cust_id": 67890,
  "edge_type": "SAME_PHONE",
  "edge_value": "+8613812345678",
  "strength": "strong",
  "first_seen": "2026-01-01",
  "last_seen": "2026-06-01",
  "record_count": 5
}
```

### 8.4 Query Pattern

```python
# Get all customers connected to customer 12345
prefix = "SAME_PHONE~cust_mobile~"  # Would need reverse index
# OR
prefix = "12345~"  # If using cust_id as part of rowkey
```

---

## 9. Summary

The 1aboveio/a1 implementation uses a clever HBase schema:

| Aspect | Design |
|--------|--------|
| **RowKey** | `{chain_id}~{field}~{value}` |
| **Qualifier** | `{chain_id}~tx_hash~{timestamp}~{tx_hash}` |
| **Value** | JSON with transaction details |
| **Column Family** | `e` (edges) |
| **Direction** | Bidirectional (2 edges per transaction) |
| **Query** | Prefix scan with PrefixFilter |
| **Writes** | Append-only via `putmany` |
| **Reads** | Prefix scan with optional timestamp filter |

**Key Takeaway:** The field name in the rowkey enables efficient directional queries without needing separate tables or indexes.
