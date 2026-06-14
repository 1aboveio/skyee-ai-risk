# Association Inverted Index Serving for Link Lookup

GitHub issue: https://github.com/1aboveio/skyee-ai-risk/issues/28

## Problem Statement

Risk reviewers need an interactive Association Link Lookup: given a customer ID, they need to see other linked customer IDs through different shared attributes such as mobile phone, email, business name, person name, identity number, address, store URL, and IP. The current graph serving path is shaped around precomputed customer-to-customer edges, which makes the system depend on expensive pairwise materialization before a user can answer the core question.

The product goal is not arbitrary graph algorithms in v1. The v1 goal is explainable two-hop association lookup: customer Attribute to shared Attribute to customer Attribute. The serving contract should therefore be an Association Inverted Index, not a required `dwd_graph_edges` customer edge snapshot.

## Solution

Build the v1 Association Link Lookup around a DuckDB Association Snapshot containing directed Attribute Link rows. The graph query service will use the snapshot read-only and derive customer-to-customer Association Link Results at query time by traversing customer to Attribute to customer.

The user-facing experience remains simple: a reviewer enters or opens a customer ID, filters by same-attribute link type, and sees linked customers grouped by derived result category. The index stores neutral Attribute Links and provenance. Customer-to-customer result semantics, including same-attribute link type and any strength/ranking, are derived at query time rather than stored as edge rows.

The DuckDB snapshot is refreshed by full replacement: build a complete candidate snapshot from clean warehouse exports, validate it, and atomically promote it over the live read-only snapshot. Live enrichment such as customer profile, account balance, status, and risk fields can be fetched from the online Source Evidence Database after linked customer IDs are found.

## User Stories

1. As a risk reviewer, I want to enter a customer ID and see linked customer IDs, so that I can quickly identify related customers during investigation
2. As a risk reviewer, I want linked customers grouped by same-attribute link type, so that I can understand why each customer is associated
3. As a risk reviewer, I want to filter links by same mobile phone, so that I can focus on strong contact-point associations
4. As a risk reviewer, I want to filter links by same email, so that I can identify customers sharing contact emails
5. As a risk reviewer, I want to filter links by same business name, so that I can identify potentially related business subjects
6. As a risk reviewer, I want to filter links by same person name, so that I can inspect weaker name-based associations separately
7. As a risk reviewer, I want to filter links by same identity number, so that I can identify high-confidence identity overlaps
8. As a risk reviewer, I want to filter links by same address, so that I can investigate customers sharing registration, residence, or payee addresses
9. As a risk reviewer, I want to filter links by same store URL, so that I can identify merchants sharing web storefronts
10. As a risk reviewer, I want to filter links by same IP, so that I can inspect login or access overlap without mixing it with stronger identity evidence
11. As a risk reviewer, I want each linked customer result to show the shared Attribute value, so that I can explain the association
12. As a risk reviewer, I want each linked customer result to show source/provenance subtype labels, so that I can distinguish primary mobile, contact mobile, bank reserved mobile, and similar source meanings
13. As a risk reviewer, I want source field annotations to be available for link evidence, so that I can understand where the association came from
14. As a risk reviewer, I want the system to avoid expanding extremely high-fanout Attributes, so that common or noisy values do not overwhelm the investigation
15. As a risk reviewer, I want the lookup result to remain available even if live enrichment is partially unavailable, so that graph evidence is not blocked by profile hydration failures
16. As a risk reviewer, I want live customer enrichment to be fresh, so that displayed status, balance, and risk context reflect the online Source Evidence Database where appropriate
17. As a risk reviewer, I want graph results to be explainable without relying on hidden graph algorithms, so that I can defend review decisions
18. As a risk reviewer, I want two customers sharing multiple Attributes to show multiple evidence groups, so that I can judge the combined association context
19. As a risk reviewer, I want weak association categories to be visually or semantically distinguishable from stronger categories, so that I can avoid over-interpreting weak matches
20. As a risk reviewer, I want customer-to-customer result categories such as same mobile phone to be derived consistently, so that filters and counts behave predictably
21. As a risk operations manager, I want the v1 lookup to avoid pairwise customer edge explosion, so that the system remains feasible as the number of customers and Attributes grows
22. As a risk operations manager, I want the DuckDB snapshot to be replaceable atomically, so that users never query a half-built graph snapshot
23. As a risk operations manager, I want the previous snapshot to remain usable when refresh fails, so that lookup availability is not tied to a successful daily build
24. As a risk operations manager, I want snapshot counts and validation checks, so that refresh failures are detectable before promotion
25. As a risk operations manager, I want the system to avoid raw-scanning Hudi storage directories, so that DuckDB does not read stale or duplicate Hudi-managed files
26. As a data engineer, I want the serving snapshot built from clean warehouse exports, so that DuckDB reads resolved table state rather than Hudi internals
27. As a data engineer, I want Attribute Link rows to store source table and source field provenance, so that downstream annotations and debugging remain possible
28. As a data engineer, I want Attribute Link rows to store first seen, last seen, and record count, so that the lookup result can explain evidence timing and support
29. As a data engineer, I want Attribute identity separated from customer-to-customer interpretation, so that the index stays reusable beyond the current customer lookup UI
30. As a data engineer, I want all available directed Attribute Links to be stored, so that the same contract can support future non-customer anchor lookups without redesigning the storage model
31. As a data engineer, I want v1 query traversal limited to customer to Attribute to customer, so that the initial implementation remains explainable and bounded
32. As a data engineer, I want user-facing same-attribute link types derived from neutral Association Attribute Types, so that storage remains generic while UI filters stay business-friendly
33. As a data engineer, I want Attribute Link Type to remain a provenance subtype, so that it can support display without becoming a v1 filter dimension
34. As a backend engineer, I want the graph query service to open DuckDB read-only, so that the serving process does not mutate the snapshot
35. As a backend engineer, I want the API to preserve the current graph search surface where practical, so that the frontend can migrate with minimal disruption
36. As a backend engineer, I want a direct endpoint for linked customer lookup, so that the UI does not need to know the internal DuckDB query shape
37. As a backend engineer, I want the service to enforce fanout and result limits, so that one high-degree Attribute cannot degrade interactive performance
38. As a backend engineer, I want live enrichment batched by linked customer IDs, so that the system avoids one query per neighbor
39. As a backend engineer, I want enrichment failures to be represented clearly, so that the frontend can render partial graph results instead of a total failure
40. As a frontend engineer, I want the response to include derived same-attribute link types, so that the filter controls can use stable values
41. As a frontend engineer, I want the response to include evidence groups per linked customer, so that the UI can show why each customer appears
42. As a frontend engineer, I want source/provenance labels suitable for information icons, so that reviewers can inspect field-level annotation without reading internal table names
43. As a frontend engineer, I want node and edge counts to remain available, so that existing graph summary UI can continue to work
44. As a frontend engineer, I want high-risk neighbor indicators to continue working, so that the review workbench can prioritize suspicious associations
45. As a platform engineer, I want the same logical Association Inverted Index contract to be portable to HBase later, so that DuckDB v1 does not block a future scalable serving engine
46. As a platform engineer, I want deployment to use full snapshot replacement rather than incremental DuckDB patching, so that operational recovery is straightforward
47. As an auditor, I want the lookup result to show evidence provenance and observation timing, so that association evidence can be traced back to source material
48. As an auditor, I want customer-to-customer strength or ranking to be derived from documented rules, so that the result does not imply unsupported certainty
49. As a product owner, I want the v1 implementation to focus on customer lookup rather than arbitrary graph traversal, so that the first release solves the immediate investigation workflow
50. As a product owner, I want pairwise customer edge tables treated as optional derived artifacts, so that the team does not spend effort on outputs not needed for the current product

## Implementation Decisions

- Use the project vocabulary from the domain glossary: Association Link Lookup, Association Inverted Index, Attribute, Association Attribute Type, Attribute Link Type, Attribute Link, Same-Attribute Link Type, Association Link Result, DuckDB Association Snapshot, and Association Snapshot Replacement.
- Follow the accepted architecture decision that Association Link Lookup serves from an Association Inverted Index rather than a required precomputed customer-to-customer edge snapshot.
- Implement the v1 serving snapshot as a local read-only DuckDB database file.
- Refresh DuckDB by full snapshot replacement: build a complete candidate database, validate it, and atomically promote it over the live file.
- Build DuckDB only from clean serving snapshots exported from resolved warehouse state. Do not query raw Hudi table storage directories directly from DuckDB.
- Store directed Attribute Link rows in a table equivalent to `association_attribute_links`.
- Attribute Link rows include source Attribute identity, destination Attribute identity, Attribute Link Type, source provenance, first seen, last seen, and record count.
- Use neutral Association Attribute Types in storage: mobile phone, email, business name, person name, identity number, address, store URL, and IP.
- Use Attribute Link Type as a provenance/display subtype, not as a v1 user-facing filter.
- Derive Same-Attribute Link Types at query time, such as same mobile phone, same email, same business name, same person name, same identity number, same address, same store URL, and same IP.
- Do not store link strength in the Attribute Link table. If strength or ranking is needed in the response, derive it as part of the Association Link Result.
- Store all available directed Attribute Links, including future non-customer relations, but constrain v1 customer lookup to two-hop customer to Attribute to customer traversal.
- Do not require `dwd_graph_edges` for the current product serving path.
- Keep pairwise customer edges as optional future derived outputs for offline analytics, exports, reconciliation, or demo compatibility.
- Keep live customer profile, account balance, status, and risk enrichment out of the DuckDB snapshot by default. Fetch enrichment from the online Source Evidence Database after linked customer IDs are found.
- Batch enrichment by linked customer IDs and apply graph fanout limits before enrichment.
- Preserve existing user-facing graph search behavior where practical, while changing the backend query shape from pairwise edge lookup to Attribute Link traversal.
- Existing graph service concepts such as neighbor lookup, shared evidence lookup, high-risk neighbor listing, degree/count statistics, and health checks should be reinterpreted over the Association Inverted Index.
- Existing graph demo UI concepts such as graph canvas, edge annotations, link type filters, high-risk neighbors, and review evidence panels should continue to work against the revised API contract.
- The service should provide useful partial results when enrichment fails after DuckDB lookup succeeds.
- The implementation should leave room for a future HBase serving engine by keeping the logical contract independent from DuckDB-specific details.

## Testing Decisions

- Tests should validate external behavior: given known Attribute Link rows and known enrichment data, the service returns the expected linked customers, derived same-attribute link types, evidence groups, counts, and failure behavior.
- Do not test private SQL string construction or internal helper implementation details except where necessary to pin down schema contracts.
- Add service-level tests around DuckDB lookup using a small temporary snapshot containing representative Attribute Links.
- Cover the two-hop traversal behavior: customer A shares an Attribute with customer B and appears as a linked customer; unrelated customers do not appear.
- Cover multi-evidence behavior: the same linked customer can be returned with multiple evidence groups when it shares multiple Attributes.
- Cover filter behavior for each v1 Same-Attribute Link Type.
- Cover Attribute Link Type behavior as display/provenance metadata, not as a user-facing filter.
- Cover high-fanout guard behavior so high-degree Attributes are capped or rejected according to the product limit.
- Cover snapshot absence behavior so the service returns a clear unavailable response when the DuckDB file is missing.
- Cover read-only serving behavior so query requests do not mutate the DuckDB snapshot.
- Cover snapshot refresh behavior at the command/job seam: a candidate snapshot is built, validated, and only then promoted.
- Cover validation failure behavior: a bad candidate snapshot must not replace the previous live snapshot.
- Cover clean snapshot input behavior by testing against exported Parquet-style inputs rather than Hudi storage internals.
- Cover live enrichment batching behavior with mocked online Source Evidence Database responses.
- Cover partial enrichment failure behavior: linked customer IDs and evidence still return when enrichment fails or times out.
- Cover API compatibility behavior so existing frontend calls can still render graph results after the backend model changes.
- Cover frontend behavior with Playwright at the review workbench or graph demo seam: entering a customer ID, applying link type filters, inspecting annotations, and seeing linked customers.
- Reuse the existing frontend end-to-end testing setup and mock API route patterns for UI behavior.
- Use Python service tests for DuckDB/FastAPI behavior if a Python test harness is introduced; otherwise keep the first high-value verification at the API command/service seam.
- Keep warehouse/Spark validation focused on generated schema and row semantics for Attribute Link export, not on pairwise customer edge generation.

## Out of Scope

- Arbitrary multi-hop graph traversal beyond customer to Attribute to customer.
- Graph algorithms such as connected components, PageRank, community detection, or shortest path.
- Neo4j, TigerGraph, PuppyGraph, or other graph database deployment.
- HBase serving implementation for v1.
- Incremental DuckDB patching.
- Serving directly from raw Hudi storage directories.
- Requiring pairwise `dwd_graph_edges` as the current product serving input.
- Transaction Flow Analysis and directional transaction counterparty traversal.
- Treating transaction counterparty-name evidence as default shared-attribute association evidence.
- Making Attribute Link Type a user-facing v1 filter dimension.
- Storing customer-to-customer link strength in the Attribute Link table.
- Building a general entity-resolution system.
- Replacing the online Source Evidence Database as the source for live customer/account enrichment.
- Adding non-customer anchor lookup to the v1 UI, even though the index may store non-customer Attribute Links.

## Further Notes

This PRD follows the accepted ADR for Association Inverted Index serving. The important product boundary is that v1 solves Association Link Lookup, not full graph analytics. The physical DuckDB implementation is a v1 serving engine; the durable contract is the Association Inverted Index over directed Attribute Links.

The current docs and implementation still contain older pairwise graph language. Implementation should update names and comments where they would otherwise mislead future maintainers, but broad unrelated rewrites are not required for the first delivery.
