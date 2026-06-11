# Graph Query Infrastructure Survey

**Author:** MiMo  
**Date:** 2026-06-12  
**Status:** Draft  
**Use Case:** Node → Edge → Node queries, multi-hop traversal

---

## 1. Requirements

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Single-hop query | High | Find all edges for a given node |
| Multi-hop traversal | High | Find paths between nodes (2-6 hops) |
| Edge filtering | High | Filter by edge type, strength, time range |
| Property lookup | Medium | Get node/edge properties during traversal |
| Scalability | High | Handle 100K+ nodes, 1M+ edges |
| Latency | High | < 100ms for single-hop, < 1s for 3-hop |
| Integration | Medium | Connect with existing Hudi/Presto/Spark stack |

---

## 2. Option Comparison

### 2.1 DuckDB (with DuckPGQ extension)

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│                   DuckDB                        │
│  ┌─────────────────────────────────────────┐    │
│  │           DuckPGQ Extension             │    │
│  │  (SQL/PGQ - SQL:2023 Graph Standard)    │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Columnar Storage Engine         │    │
│  │  (In-process, Parquet/Delta native)     │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Query Example:**
```sql
-- Install extension
INSTALL duckpgq;
LOAD duckpgq;

-- Create property graph
CREATE PROPERTY GRAPH my_graph
  VERTEX TABLES (
    dwd_graph_nodes AS node
      PROPERTIES (cust_id, cust_type, risk_level)
  )
  EDGE TABLES (
    dwd_graph_edges AS edge
      SOURCE KEY (source_cust_id) REFERENCES node (cust_id)
      DESTINATION KEY (target_cust_id) REFERENCES node (cust_id)
      PROPERTIES (edge_type, strength, edge_value)
  );

-- Single-hop query
SELECT n2.cust_id, n2.cust_name, e.edge_type, e.strength
FROM GRAPH_TABLE (my_graph
  MATCH (n1) -[e]-> (n2)
  WHERE n1.cust_id = 12345
  COLUMNS (n2.cust_id, n2.cust_name, e.edge_type, e.strength)
);

-- Multi-hop query (3 hops)
SELECT n4.cust_id, n4.cust_name, 
       n1.cust_id || ' -> ' || n2.cust_id || ' -> ' || n3.cust_id || ' -> ' || n4.cust_id as path
FROM GRAPH_TABLE (my_graph
  MATCH (n1) -[e1]-> (n2) -[e2]-> (n3) -[e3]-> (n4)
  WHERE n1.cust_id = 12345 AND n4.cust_id = 67890
  COLUMNS (n4.cust_id, n4.cust_name, 
           n1.cust_id || ' -> ' || n2.cust_id || ' -> ' || n3.cust_id || ' -> ' || n4.cust_id)
);
```

**Pros:**
- ✅ In-process (no server needed)
- ✅ SQL/PGQ standard syntax
- ✅ 10-100x faster than Neo4j on analytical queries
- ✅ Native Parquet/Delta support
- ✅ Can read directly from Hudi tables
- ✅ Zero-copy integration with existing data

**Cons:**
- ❌ Single-node only (no distributed processing)
- ❌ Memory bound (dataset must fit in memory)
- ❌ Community extension (not production-hardened)
- ❌ No built-in persistence (in-memory or file-based)

**Performance:**
- Single-hop: ~1-10ms
- 3-hop: ~10-100ms
- 6-hop: ~100ms-1s

---

### 2.2 PostgreSQL with GIN Index

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│                PostgreSQL                       │
│  ┌─────────────────────────────────────────┐    │
│  │           GIN Index Layer               │    │
│  │  (Array @> containment queries)         │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Row-based Storage Engine        │    │
│  │  (ACID, MVCC, WAL)                      │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Schema Design:**
```sql
-- Nodes table
CREATE TABLE dwd_graph_nodes (
    cust_id BIGINT PRIMARY KEY,
    cust_type VARCHAR(20),
    cust_name VARCHAR(150),
    risk_level VARCHAR(20),
    -- Adjacency list as array
    neighbor_ids BIGINT[] DEFAULT '{}',
    edge_types TEXT[] DEFAULT '{}'
);

-- Edges table (normalized)
CREATE TABLE dwd_graph_edges (
    edge_id BIGINT PRIMARY KEY,
    source_cust_id BIGINT,
    target_cust_id BIGINT,
    edge_type VARCHAR(30),
    strength VARCHAR(10),
    edge_value VARCHAR(500)
);

-- GIN indexes for array containment
CREATE INDEX idx_nodes_neighbor_ids ON dwd_graph_nodes USING GIN (neighbor_ids);
CREATE INDEX idx_nodes_edge_types ON dwd_graph_nodes USING GIN (edge_types);

-- B-tree indexes for edges
CREATE INDEX idx_edges_source ON dwd_graph_edges (source_cust_id);
CREATE INDEX idx_edges_target ON dwd_graph_edges (target_cust_id);
CREATE INDEX idx_edges_type ON dwd_graph_edges (edge_type);
```

**Query Example:**
```sql
-- Single-hop query (using adjacency list)
SELECT unnest(neighbor_ids) as target_cust_id
FROM dwd_graph_nodes
WHERE cust_id = 12345;

-- Single-hop with edge details
SELECT e.target_cust_id, n.cust_name, e.edge_type, e.strength
FROM dwd_graph_edges e
JOIN dwd_graph_nodes n ON e.target_cust_id = n.cust_id
WHERE e.source_cust_id = 12345;

-- Multi-hop (3 hops) using recursive CTE
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

-- Find all nodes with specific edge type
SELECT cust_id, cust_name
FROM dwd_graph_nodes
WHERE edge_types @> ARRAY['SAME_PHONE'];
```

**Pros:**
- ✅ ACID compliance
- ✅ Mature ecosystem
- ✅ GIN index efficient for array containment
- ✅ Recursive CTEs for multi-hop
- ✅ Full SQL support
- ✅ Can use foreign data wrappers (FDW) to connect to Hudi

**Cons:**
- ❌ Recursive CTEs slow for deep traversal (>3 hops)
- ❌ Row-based storage less efficient for graph workloads
- ❌ Requires separate database server
- ❌ Data synchronization needed

**Performance:**
- Single-hop: ~1-5ms (with GIN index)
- 3-hop: ~50-500ms
- 6-hop: ~1-10s (recursive CTE)

---

### 2.3 HBase Adjacency List

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│                  HBase                          │
│  ┌─────────────────────────────────────────┐    │
│  │         Adjacency List Storage          │    │
│  │  RowKey: node_id                        │    │
│  │  CF: edges                              │    │
│  │    CQ: edge_type:target_node_id         │    │
│  │    Value: edge_properties               │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         HDFS Distributed Storage        │    │
│  │  (Bloom filters, block cache)           │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Schema Design:**
```
Table: dwd_graph_adjacency

RowKey: cust_id (e.g., "12345")

Column Family: edges
  - SAME_PHONE:target_67890  → {"strength": "strong", "value": "+8613812345678", "first_seen": "2026-01-01"}
  - SAME_EMAIL:target_67890  → {"strength": "strong", "value": "user@example.com", "first_seen": "2026-01-15"}
  - COUNTERPARTY:target_11111 → {"strength": "strong", "value": "PAY:ORDER_ID=123:DEBTOR", "first_seen": "2026-02-01"}

Column Family: properties
  - cust_type     → "COMPANY"
  - cust_name     → "ABC COMPANY LTD"
  - risk_level    → "HIGH"
```

**Query Example (using HBase Shell):**
```bash
# Single-hop query
get 'dwd_graph_adjacency', '12345', {COLUMN => 'edges'}

# Filter by edge type
get 'dwd_graph_adjacency', '12345', {COLUMN => 'edges:SAME_PHONE'}

# Multi-hop (using MapReduce or Spark)
# Step 1: Get neighbors of 12345
# Step 2: Get neighbors of those neighbors
# Step 3: Filter and join
```

**Query Example (using Spark):**
```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .config("hbase.table", "dwd_graph_adjacency") \
    .getOrCreate()

# Read adjacency list
df = spark.read.format("org.apache.hadoop.hbase.spark") \
    .option("hbase.table", "dwd_graph_adjacency") \
    .load()

# Single-hop query
single_hop = df.filter(df.rowkey == "12345") \
    .select(explode("edges").alias("edge_type", "target_id", "properties"))

# Multi-hop (3 hops)
hop1 = df.filter(df.rowkey == "12345").select(explode("edges"))
hop2 = df.join(hop1, df.rowkey == hop1.target_id).select(explode("edges"))
hop3 = df.join(hop2, df.rowkey == hop2.target_id).select(explode("edges"))
```

**Pros:**
- ✅ Distributed (scales horizontally)
- ✅ Low-latency point lookups
- ✅ Bloom filters for fast existence checks
- ✅ Block cache for hot data
- ✅ Native Hadoop ecosystem integration
- ✅ Can store edge properties in column values

**Cons:**
- ❌ No SQL interface (requires HBase Shell or Spark)
- ❌ Complex multi-hop queries (requires MapReduce/Spark)
- ❌ No built-in graph algorithms
- ❌ Schema design requires careful rowkey planning
- ❌ Operational complexity

**Performance:**
- Single-hop: ~1-10ms (point lookup)
- 3-hop: ~100ms-1s (with Spark)
- 6-hop: ~1-10s (with Spark)

---

### 2.4 Comparison Matrix

| Feature | DuckDB | PostgreSQL | HBase |
|---------|--------|------------|-------|
| **Deployment** | In-process | Server | Distributed cluster |
| **SQL Support** | Full (PGQ) | Full | Limited (Spark SQL) |
| **Multi-hop** | Native PGQ | Recursive CTE | MapReduce/Spark |
| **Scalability** | Single node | Single node (with replicas) | Horizontal |
| **Latency (1-hop)** | 1-10ms | 1-5ms | 1-10ms |
| **Latency (3-hop)** | 10-100ms | 50-500ms | 100ms-1s |
| **Data Size** | Memory bound | Disk bound | Petabyte scale |
| **Integration** | Parquet/Hudi native | FDW to Hudi | Native Hadoop |
| **Maturity** | Experimental | Production | Production |
| **Ops Complexity** | Low | Medium | High |

---

## 3. Recommendation

### For Current Scale (100K nodes, 1M edges)

**Recommended: DuckDB with DuckPGQ**

**Rationale:**
1. **Zero ETL** - Can read directly from Hudi/Parquet files
2. **Simple deployment** - No server needed, just pip install
3. **Fast enough** - 1-hop < 10ms, 3-hop < 100ms
4. **SQL/PGQ standard** - Future-proof syntax
5. **Prototyping friendly** - Easy to iterate

**Implementation:**
```python
import duckdb

# Connect to DuckDB (in-memory or file-based)
conn = duckdb.connect(':memory:')

# Install and load DuckPGQ
conn.execute("INSTALL duckpgq")
conn.execute("LOAD duckpgq")

# Read directly from Hudi/Parquet
conn.execute("""
    CREATE TABLE nodes AS 
    SELECT * FROM read_parquet('/path/to/dwd_graph_nodes/*.parquet')
""")

conn.execute("""
    CREATE TABLE edges AS 
    SELECT * FROM read_parquet('/path/to/dwd_graph_edges/*.parquet')
""")

# Create property graph
conn.execute("""
    CREATE PROPERTY GRAPH my_graph
    VERTEX TABLES (nodes AS node)
    EDGE TABLES (edges AS edge
        SOURCE KEY (source_cust_id) REFERENCES node (cust_id)
        DESTINATION KEY (target_cust_id) REFERENCES node (cust_id)
    )
""")

# Query
result = conn.execute("""
    SELECT n2.cust_id, e.edge_type
    FROM GRAPH_TABLE (my_graph
        MATCH (n1) -[e]-> (n2)
        WHERE n1.cust_id = 12345
        COLUMNS (n2.cust_id, e.edge_type)
    )
""").fetchall()
```

### For Future Scale (1M+ nodes, 100M+ edges)

**Recommended: HBase Adjacency List + Spark**

**Rationale:**
1. **Horizontal scaling** - Can handle petabyte-scale graphs
2. **Existing infrastructure** - Already have HBase/HDFS
3. **Spark integration** - Can use GraphX for complex algorithms
4. **Low latency** - Point lookups are fast

**Implementation:**
```python
# HBase table design
# RowKey: cust_id
# CF: edges
#   CQ: edge_type:target_cust_id
#   Value: JSON with properties

# Spark job for multi-hop
from pyspark.sql import SparkSession
from pyspark.graphx import Graph

spark = SparkSession.builder \
    .config("hbase.table", "dwd_graph_adjacency") \
    .getOrCreate()

# Load graph from HBase
vertices = spark.read.format("hbase").load()
edges = spark.read.format("hbase").load()

# Create GraphX graph
graph = Graph(vertices, edges)

# Run connected components
cc = graph.connectedComponents()

# Find shortest path
sp = graph.shortestPaths(12345)
```

---

## 4. Hybrid Approach

**Best of both worlds:**

```
┌─────────────────────────────────────────────────────────┐
│                    Query Layer                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  DuckDB (for prototyping & small queries)       │    │
│  │  - Read from Hudi/Parquet directly              │    │
│  │  - SQL/PGQ syntax                               │    │
│  │  - In-memory, fast iteration                    │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  HBase (for production & large queries)         │    │
│  │  - Adjacency list storage                       │    │
│  │  - Spark for complex traversals                 │    │
│  │  - Distributed, scalable                        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Hudi (dwd_graph_nodes, dwd_graph_edges)        │    │
│  │  - Source of truth                              │    │
│  │  - Incremental updates                          │    │
│  │  - Parquet format                               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Workflow:**
1. **Development/Testing:** Use DuckDB directly on Hudi files
2. **Small Queries (< 1M edges):** Use DuckDB
3. **Large Queries (> 1M edges):** Use HBase + Spark
4. **Production:** Sync Hudi → HBase for low-latency access

---

## 5. Implementation Plan

### Phase 1: DuckDB Prototype (Week 1-2)
- [ ] Install DuckDB with DuckPGQ
- [ ] Create property graph from Hudi tables
- [ ] Implement single-hop queries
- [ ] Implement 3-hop queries
- [ ] Performance benchmarking

### Phase 2: PostgreSQL Alternative (Week 3-4)
- [ ] Design adjacency list schema
- [ ] Create GIN indexes
- [ ] Implement recursive CTE queries
- [ ] Compare with DuckDB performance

### Phase 3: HBase Production (Week 5-8)
- [ ] Design HBase rowkey schema
- [ ] Create HBase table
- [ ] Implement Spark jobs for multi-hop
- [ ] Sync Hudi → HBase pipeline
- [ ] Performance benchmarking

### Phase 4: Integration (Week 9-10)
- [ ] API layer for graph queries
- [ ] Caching layer for hot queries
- [ ] Monitoring and alerting
- [ ] Documentation

---

## 6. References

- [DuckDB Graph Queries](https://duckdb.org/docs/current/guides/graph_queries)
- [DuckPGQ Extension](https://duckdb.org/library/duckpgq/)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [HBase Adjacency List](https://hbase.apache.org/book.html#schema)
- [Apache S2Graph](https://s2graph.apache.org/)
- [GRainDB: Making RDBMSs Efficient on Graph Workloads](https://arxiv.org/pdf/2108.10540.pdf)
