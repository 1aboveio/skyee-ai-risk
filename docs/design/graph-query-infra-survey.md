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

## 2. Simplified Option Comparison

**Note:** HBase-based solutions (JanusGraph, HugeGraph) excluded due to operational complexity.

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

| Feature | DuckDB | PostgreSQL | Neo4j | TigerGraph | PuppyGraph |
|---------|--------|------------|-------|------------|------------|
| **Deployment** | In-process | Server | Server | Distributed | Engine |
| **Query Language** | SQL/PGQ | SQL | Cypher | GSQL | Gremlin/SQL |
| **Multi-hop** | Native PGQ | Recursive CTE | Native | Native | Native |
| **Scalability** | Single node | Single node | Cluster | Horizontal | Horizontal |
| **Latency (1-hop)** | 1-10ms | 1-5ms | 1-5ms | 1-5ms | 10-100ms |
| **Latency (3-hop)** | 10-100ms | 50-500ms | 5-50ms | 5-50ms | 100ms-1s |
| **Data Size** | Memory bound | Disk bound | Memory | Petabyte | Petabyte |
| **Hudi Integration** | Native | FDW | None | None | Native |
| **Open Source** | Yes | Yes | Community | No | No |
| **Ops Complexity** | Low | Medium | Low | Medium | Low |

---

## 4. Recommendation

### For Prototyping & Small Scale (< 1M edges)

**Recommended: DuckDB with DuckPGQ**

**Rationale:**
1. **Zero ETL** - Can read directly from Hudi/Parquet files
2. **Simple deployment** - No server needed, just pip install
3. **Fast enough** - 1-hop < 10ms, 3-hop < 100ms
4. **SQL/PGQ standard** - Future-proof syntax
5. **Prototyping friendly** - Easy to iterate

### For Production (1M - 100M edges)

**Recommended: Neo4j**

**Rationale:**
1. **Best performance** - Native graph storage, index-free adjacency
2. **Cypher query language** - Intuitive, ISO GQL standard
3. **Rich algorithms** - PageRank, Connected Components, Shortest Path
4. **Excellent tooling** - Neo4j Browser, Bloom visualization
5. **Managed service** - AuraDB (serverless option)

### For Large Scale Analytics (100M+ edges)

**Recommended: TigerGraph**

**Rationale:**
1. **Deep-link analytics** - Optimized for multi-hop traversals
2. **Massively parallel** - Distributed processing
3. **GSQL** - Powerful graph query language
4. **Real-time** - Low latency even at scale
5. **TigerGraph Cloud** - Managed service available

---

## 5. Implementation Plan

### Phase 1: DuckDB Prototype (Week 1-2)
- [ ] Install DuckDB with DuckPGQ
- [ ] Create property graph from Hudi tables
- [ ] Implement single-hop queries
- [ ] Implement 3-hop queries
- [ ] Performance benchmarking

### Phase 2: Production Deployment (Week 3-6)
- [ ] Deploy Neo4j (AuraDB or self-hosted)
- [ ] Import graph data from Hudi
- [ ] Implement Cypher queries
- [ ] Performance benchmarking
- [ ] Integration with existing systems

### Phase 3: Optimization (Week 7-10)
- [ ] Set up monitoring and alerting
- [ ] Implement data sync pipeline (Hudi → Neo4j)
- [ ] Build API layer
- [ ] Performance optimization
- [ ] Documentation

---

## 6. References

- [DuckDB Graph Queries](https://duckdb.org/docs/current/guides/graph_queries)
- [DuckPGQ Extension](https://duckdb.org/library/duckpgq/)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [Neo4j](https://neo4j.com/)
- [Neo4j AuraDB](https://neo4j.com/cloud/aura/)
- [TigerGraph](https://www.tigergraph.com/)
- [PuppyGraph](https://www.puppygraph.com/)
