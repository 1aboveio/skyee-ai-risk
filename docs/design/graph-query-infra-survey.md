# Graph Query Infrastructure Survey

**Author:** MiMo  
**Date:** 2026-06-12  
**Status:** Draft  
**Use Case:** Node → Edge → Node queries, multi-hop traversal, fraud detection

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

### 2.3 HBase Adjacency List (Native)

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

**Native HBase Operations (Java):**
```java
// Single-hop query using HBase Get
public List<Edge> getNeighbors(String custId) throws IOException {
    Get get = new Get(Bytes.toBytes(custId));
    get.addFamily(Bytes.toBytes("edges"));
    
    Result result = table.get(get);
    List<Edge> edges = new ArrayList<>();
    
    for (Cell cell : result.rawCells()) {
        String qualifier = Bytes.toString(CellUtil.cloneQualifier(custId));
        String[] parts = qualifier.split(":");
        String edgeType = parts[0];
        String targetId = parts[1];
        String value = Bytes.toString(CellUtil.cloneValue(cell));
        
        edges.add(new Edge(custId, targetId, edgeType, value));
    }
    return edges;
}

// Single-hop with edge type filter
public List<Edge> getNeighborsByType(String custId, String edgeType) throws IOException {
    Get get = new Get(Bytes.toBytes(custId));
    get.addFamily(Bytes.toBytes("edges"));
    
    // Use prefix filter for edge type
    PrefixFilter filter = new PrefixFilter(Bytes.toBytes(edgeType + ":"));
    get.setFilter(filter);
    
    Result result = table.get(get);
    // ... parse results
}

// Multi-hop query (2 hops)
public List<String> getTwoHopNeighbors(String custId) throws IOException {
    Set<String> result = new HashSet<>();
    
    // First hop
    List<Edge> firstHop = getNeighbors(custId);
    for (Edge edge : firstHop) {
        // Second hop
        List<Edge> secondHop = getNeighbors(edge.targetId);
        for (Edge edge2 : secondHop) {
            if (!edge2.targetId.equals(custId)) {
                result.add(edge2.targetId);
            }
        }
    }
    return new ArrayList<>(result);
}

// Batch multi-hop query (using HBase batch get)
public Map<String, List<Edge>> batchGetNeighbors(List<String> custIds) throws IOException {
    List<Get> gets = custIds.stream()
        .map(id -> {
            Get get = new Get(Bytes.toBytes(id));
            get.addFamily(Bytes.toBytes("edges"));
            return get;
        })
        .collect(Collectors.toList());
    
    Result[] results = table.get(gets);
    // ... parse results
}
```

**HBase Shell Operations:**
```bash
# Single-hop query
get 'dwd_graph_adjacency', '12345', {COLUMN => 'edges'}

# Filter by edge type
get 'dwd_graph_adjacency', '12345', {COLUMN => 'edges:SAME_PHONE'}

# Scan for specific edge value
scan 'dwd_graph_adjacency', {FILTER => "PrefixFilter('SAME_PHONE:')"}
```

**Pros:**
- ✅ Distributed (scales horizontally)
- ✅ Low-latency point lookups
- ✅ Bloom filters for fast existence checks
- ✅ Block cache for hot data
- ✅ Native Hadoop ecosystem integration
- ✅ Can store edge properties in column values
- ✅ Tight integration with existing HBase infrastructure

**Cons:**
- ❌ No SQL interface (requires HBase Shell or Java API)
- ❌ Complex multi-hop queries (requires application code)
- ❌ No built-in graph algorithms
- ❌ Schema design requires careful rowkey planning
- ❌ Operational complexity

**Performance:**
- Single-hop: ~1-10ms (point lookup)
- 3-hop: ~10-100ms (with batch get)
- 6-hop: ~100ms-1s (with parallel traversal)

---

### 2.4 JanusGraph (on HBase)

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              JanusGraph                         │
│  ┌─────────────────────────────────────────┐    │
│  │         Gremlin Query Engine            │    │
│  │  (Apache TinkerPop)                     │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Storage Backend                 │    │
│  │  (HBase, Cassandra, BerkeleyDB)         │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Index Backend                   │    │
│  │  (Elasticsearch, Solr)                  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Setup with HBase:**
```java
// Connect to JanusGraph with HBase backend
JanusGraph graph = JanusGraphFactory.build()
    .set("storage.backend", "hbase")
    .set("storage.hostname", "skyeenn1,skyeenn2,skyeedn1")
    .set("storage.hbase.table", "janusgraph")
    .open();

GraphTraversalSource g = graph.traversal();
```

**Gremlin Query Examples:**
```groovy
// Single-hop query
g.V().has('cust_id', '12345')
    .outE('SAME_PHONE', 'SAME_EMAIL')
    .inV()
    .valueMap(true)

// Multi-hop query (3 hops)
g.V().has('cust_id', '12345')
    .repeat(outE().inV().simplePath())
    .times(3)
    .has('cust_id', '67890')
    .path()
    .by('cust_id')
    .by('edge_type')

// Find all connected nodes within 2 hops
g.V().has('cust_id', '12345')
    .repeat(out().simplePath())
    .times(2)
    .dedup()
    .valueMap('cust_id', 'cust_name', 'risk_level')

// Filter by edge type and strength
g.V().has('cust_id', '12345')
    .outE('SAME_PHONE')
    .has('strength', 'strong')
    .inV()
    .valueMap('cust_id', 'cust_name')

// Find shortest path
g.V().has('cust_id', '12345')
    .repeat(out().simplePath().until(has('cust_id', '67890')))
    .limit(1)
    .path()
    .by('cust_id')
```

**Pros:**
- ✅ Distributed graph database
- ✅ Native graph storage and indexing
- ✅ Gremlin query language (TinkerPop standard)
- ✅ Pluggable backends (HBase, Cassandra, etc.)
- ✅ Built-in graph algorithms
- ✅ OLTP and OLAP support
- ✅ Open source (Apache 2.0)

**Cons:**
- ❌ Complex setup and operations
- ❌ Requires HBase + Elasticsearch
- ❌ Gremlin learning curve
- ❌ Performance depends on backend configuration

**Performance:**
- Single-hop: ~1-10ms
- 3-hop: ~10-100ms
- 6-hop: ~100ms-1s

---

### 2.5 Neo4j

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│                  Neo4j                          │
│  ┌─────────────────────────────────────────┐    │
│  │         Cypher Query Engine             │    │
│  │  (Native graph processing)              │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Native Graph Storage            │    │
│  │  (Index-free adjacency)                 │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Cypher Query Examples:**
```cypher
// Single-hop query
MATCH (n1:Customer {cust_id: '12345'})-[e:SAME_PHONE|SAME_EMAIL]->(n2:Customer)
RETURN n2.cust_id, n2.cust_name, type(e), e.strength

// Multi-hop query (3 hops)
MATCH path = (n1:Customer {cust_id: '12345'})-[*1..3]->(n2:Customer {cust_id: '67890'})
RETURN path, length(path) as hops
ORDER BY hops
LIMIT 1

// Find all connected nodes within 2 hops
MATCH (n1:Customer {cust_id: '12345'})-[*1..2]-(n2:Customer)
WHERE n1 <> n2
RETURN DISTINCT n2.cust_id, n2.cust_name, n2.risk_level

// Filter by edge type and strength
MATCH (n1:Customer {cust_id: '12345'})-[e:SAME_PHONE]->(n2:Customer)
WHERE e.strength = 'strong'
RETURN n2.cust_id, n2.cust_name, e.edge_value

// Find shortest path
MATCH path = shortestPath(
    (n1:Customer {cust_id: '12345'})-[*]-(n2:Customer {cust_id: '67890'})
)
RETURN path, length(path) as hops

// Find fraud rings (connected components)
CALL gds.wcc.stream('customer-graph')
YIELD nodeId, componentId
RETURN componentId, collect(gds.util.asNode(nodeId).cust_id) as members
ORDER BY size(members) DESC
```

**Pros:**
- ✅ Best-in-class graph database
- ✅ Cypher query language (intuitive, ISO GQL standard)
- ✅ Native graph storage (index-free adjacency)
- ✅ Built-in graph algorithms (PageRank, Connected Components, etc.)
- ✅ Excellent tooling and visualization (Neo4j Browser)
- ✅ AuraDB managed service
- ✅ Strong community and ecosystem

**Cons:**
- ❌ Requires separate database
- ❌ Data synchronization needed
- ❌ Enterprise clustering requires license
- ❌ Memory intensive for large graphs

**Performance:**
- Single-hop: ~1-5ms
- 3-hop: ~5-50ms
- 6-hop: ~50-500ms

---

### 2.6 TigerGraph

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              TigerGraph                         │
│  ┌─────────────────────────────────────────┐    │
│  │         GSQL Query Engine               │    │
│  │  (Massively parallel processing)        │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Native Graph Storage            │    │
│  │  (Compressed, distributed)              │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**GSQL Query Examples:**
```sql
-- Single-hop query
CREATE QUERY getNeighbors(STRING custId) FOR GRAPH CustomerGraph {
    Start = {Customer.*};
    neighbors = SELECT t FROM Start:s-(SAME_PHONE|SAME_EMAIL:e)->Customer:t
                WHERE s.cust_id == custId;
    PRINT neighbors;
}

-- Multi-hop query (3 hops)
CREATE QUERY getThreeHops(STRING startId, STRING endId) FOR GRAPH CustomerGraph {
    Start = {Customer.*};
    paths = SELECT t FROM Start:s-(SAME_PHONE|SAME_EMAIL:e)->Customer:t
            WHERE s.cust_id == startId
            ACCUM t.@visited += 1;
    PRINT paths;
}

-- Find shortest path
CREATE QUERY findShortestPath(STRING startId, STRING endId) FOR GRAPH CustomerGraph {
    Start = {Customer.*};
    shortest = SELECT t FROM Start:s-(SAME_PHONE|SAME_EMAIL:e)->Customer:t
               WHERE s.cust_id == startId
               SHORTEST 3 TO t
               WHERE t.cust_id == endId;
    PRINT shortest;
}
```

**Pros:**
- ✅ High-performance deep-link analytics
- ✅ Massively parallel processing
- ✅ GSQL query language
- ✅ Built-in graph algorithms
- ✅ Real-time and batch processing
- ✅ TigerGraph Cloud managed service

**Cons:**
- ❌ Proprietary (not open source)
- ❌ Steeper learning curve
- ❌ Enterprise pricing
- ❌ Less community support

**Performance:**
- Single-hop: ~1-5ms
- 3-hop: ~5-50ms
- 6-hop: ~50-200ms

---

### 2.7 Apache HugeGraph

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              Apache HugeGraph                    │
│  ┌─────────────────────────────────────────┐    │
│  │         Gremlin Query Engine            │    │
│  │  (Apache TinkerPop)                     │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Multiple Storage Backends       │    │
│  │  (HBase, MySQL, RocksDB, etc.)          │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         RESTful API                    │    │
│  │  (Graph management & querying)          │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Setup with HBase:**
```properties
# hugegraph.properties
backend=hbase
serializer=hbase
hosts=skyeenn1,skyeenn2,skyeedn1
port=2181
```

**REST API Examples:**
```bash
# Single-hop query
GET /graphs/graph/vertices/12345?adjacent_edges=true

# Multi-hop query (Gremlin)
POST /graphs/graph/gremlin
{
  "gremlin": "g.V('12345').repeat(out().simplePath()).times(3).has('cust_id', '67890').path().by('cust_id')"
}

# Find all connected nodes
POST /graphs/graph/gremlin
{
  "gremlin": "g.V('12345').repeat(out().simplePath()).times(2).dedup().valueMap('cust_id', 'cust_name')"
}
```

**Pros:**
- ✅ Open source (Apache 2.0)
- ✅ Multiple storage backends (HBase, MySQL, RocksDB)
- ✅ RESTful API
- ✅ Built-in graph algorithms
- ✅ Integration with Spark and Flink
- ✅ GraphRAG capabilities for LLM

**Cons:**
- ❌ Newer project (less mature)
- ❌ Smaller community
- ❌ Performance varies by backend

**Performance:**
- Single-hop: ~1-10ms
- 3-hop: ~10-100ms
- 6-hop: ~100ms-1s

---

### 2.8 PuppyGraph (Graph Query Engine)

**Architecture:**
```
┌─────────────────────────────────────────────────┐
│              PuppyGraph                         │
│  ┌─────────────────────────────────────────┐    │
│  │         Graph Query Engine              │    │
│  │  (Gremlin/SQL support)                  │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Data Source Connectors          │    │
│  │  (Hudi, Iceberg, Delta, HBase, etc.)    │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Query Examples:**
```sql
-- Single-hop query
SELECT * FROM GRAPH_TABLE (
    my_graph
    MATCH (n1:Customer {cust_id: '12345'}) -[e:SAME_PHONE|SAME_EMAIL]-> (n2:Customer)
    COLUMNS (n2.cust_id, n2.cust_name, e.edge_type, e.strength)
);

-- Multi-hop query
SELECT * FROM GRAPH_TABLE (
    my_graph
    MATCH (n1:Customer {cust_id: '12345'}) -[e1]-> (n2) -[e2]-> (n3) -[e3]-> (n4:Customer {cust_id: '67890'})
    COLUMNS (n1.cust_id, n2.cust_id, n3.cust_id, n4.cust_id)
);
```

**Pros:**
- ✅ Zero ETL (reads directly from data lake)
- ✅ Supports Hudi, Iceberg, Delta, HBase
- ✅ Gremlin and SQL support
- ✅ Distributed query engine
- ✅ No data duplication needed

**Cons:**
- ❌ Newer product
- ❌ Commercial (not open source)
- ❌ Less community support

**Performance:**
- Single-hop: ~10-100ms (depends on data source)
- 3-hop: ~100ms-1s
- 6-hop: ~1-10s

---

## 3. Comparison Matrix

| Feature | DuckDB | PostgreSQL | HBase (Native) | JanusGraph | Neo4j | TigerGraph | HugeGraph | PuppyGraph |
|---------|--------|------------|----------------|------------|-------|------------|-----------|------------|
| **Deployment** | In-process | Server | Distributed | Distributed | Server | Distributed | Distributed | Engine |
| **Query Language** | SQL/PGQ | SQL | Java API | Gremlin | Cypher | GSQL | Gremlin | Gremlin/SQL |
| **Multi-hop** | Native PGQ | Recursive CTE | App code | Native | Native | Native | Native | Native |
| **Scalability** | Single node | Single node | Horizontal | Horizontal | Cluster | Horizontal | Horizontal | Horizontal |
| **Latency (1-hop)** | 1-10ms | 1-5ms | 1-10ms | 1-10ms | 1-5ms | 1-5ms | 1-10ms | 10-100ms |
| **Latency (3-hop)** | 10-100ms | 50-500ms | 10-100ms | 10-100ms | 5-50ms | 5-50ms | 10-100ms | 100ms-1s |
| **Data Size** | Memory bound | Disk bound | Petabyte | Petabyte | Memory | Petabyte | Petabyte | Petabyte |
| **HBase Integration** | None | FDW | Native | Native | None | None | Native | Connector |
| **Hudi Integration** | Native | FDW | None | None | None | None | None | Native |
| **Open Source** | Yes | Yes | Yes | Yes | Community | No | Yes | No |
| **Ops Complexity** | Low | Medium | High | High | Low | Medium | Medium | Low |

---

## 4. Recommendation

### For Current Scale (100K nodes, 1M edges)

**Recommended: DuckDB with DuckPGQ**

**Rationale:**
1. **Zero ETL** - Can read directly from Hudi/Parquet files
2. **Simple deployment** - No server needed, just pip install
3. **Fast enough** - 1-hop < 10ms, 3-hop < 100ms
4. **SQL/PGQ standard** - Future-proof syntax
5. **Prototyping friendly** - Easy to iterate

### For Production with HBase Infrastructure

**Recommended: JanusGraph on HBase**

**Rationale:**
1. **Native HBase integration** - Uses existing HBase cluster
2. **Distributed** - Scales horizontally
3. **Gremlin query language** - Powerful graph traversals
4. **Built-in algorithms** - PageRank, Connected Components, etc.
5. **Open source** - Apache 2.0 license

### For Future Scale (1M+ nodes, 100M+ edges)

**Recommended: Neo4j or TigerGraph**

**Rationale:**
1. **Best performance** - Native graph storage
2. **Rich algorithms** - Fraud detection, community detection
3. **Excellent tooling** - Visualization, monitoring
4. **Managed services** - AuraDB, TigerGraph Cloud

---

## 5. Implementation Plan

### Phase 1: DuckDB Prototype (Week 1-2)
- [ ] Install DuckDB with DuckPGQ
- [ ] Create property graph from Hudi tables
- [ ] Implement single-hop queries
- [ ] Implement 3-hop queries
- [ ] Performance benchmarking

### Phase 2: JanusGraph on HBase (Week 3-6)
- [ ] Deploy JanusGraph with HBase backend
- [ ] Import graph data from Hudi
- [ ] Implement Gremlin queries
- [ ] Performance benchmarking
- [ ] Integration with existing systems

### Phase 3: Production Deployment (Week 7-10)
- [ ] Set up monitoring and alerting
- [ ] Implement data sync pipeline (Hudi → JanusGraph)
- [ ] Build API layer
- [ ] Performance optimization
- [ ] Documentation

---

## 6. References

- [DuckDB Graph Queries](https://duckdb.org/docs/current/guides/graph_queries)
- [DuckPGQ Extension](https://duckdb.org/library/duckpgq/)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [JanusGraph Documentation](https://docs.janusgraph.org/)
- [JanusGraph on HBase](https://docs.janusgraph.org/storage-backend/hbase/)
- [Apache HugeGraph](https://hugegraph.apache.org/)
- [Neo4j](https://neo4j.com/)
- [TigerGraph](https://www.tigergraph.com/)
- [PuppyGraph](https://www.puppygraph.com/)
