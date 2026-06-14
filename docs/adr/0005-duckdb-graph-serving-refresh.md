# DuckDB Graph Serving Refresh

Superseded by ADR-0006.

The earlier DuckDB graph serving refresh decision assumed `dwd_graph_nodes` and `dwd_graph_edges` were the canonical DuckDB serving inputs. ADR-0006 replaces that serving contract with the Association Inverted Index and carries forward the still-valid DuckDB snapshot rules: use clean serving snapshots, never raw-scan Hudi table storage directories, build a candidate DuckDB file, validate it, and atomically promote it over the live read-only serving file.
