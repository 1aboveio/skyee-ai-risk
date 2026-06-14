# Test Criteria: Association Inverted Index Serving

## Source

- Input: `docs/prd/association-inverted-index-serving.md`, GitHub issue #28, ADR-0006 Association Inverted Index Serving
- Version/date: 2026-06-14
- Author/owner: Product/engineering discussion captured in repository PRD and ADR

## Scope

- In scope: v1 Association Link Lookup from customer to Attribute to customer; DuckDB Association Snapshot schema and refresh; graph query service behavior; live enrichment boundary; frontend graph search compatibility; link type filters and evidence display; fanout limits; failure handling.
- Out of scope: arbitrary multi-hop traversal, graph algorithms, HBase serving, incremental DuckDB patching, raw Hudi directory serving, mandatory pairwise `dwd_graph_edges`, Transaction Flow Analysis, non-customer anchor UI lookup.
- Assumptions: Existing graph demo endpoints may keep current route names if response semantics satisfy the new Association Link Result contract. Existing frontend graph shape may continue to use node/edge terminology as a presentation adapter while backend serving is Attribute Link based.
- Blockers: None for criteria creation.

## Acceptance Criteria

- AC1: Given a valid customer ID with shared Attributes, the graph query service returns linked customer IDs discovered by exactly two-hop traversal: customer Attribute to shared Attribute to customer Attribute.
- AC2: Given a customer ID with no shared Attributes, the service returns an empty linked-customer result with a successful response and valid stats.
- AC3: Given unrelated customers in the snapshot, the service does not return them as linked customers.
- AC4: Given two customers sharing multiple Attributes, the service returns one linked customer with multiple evidence groups or result rows preserving all shared Attribute evidence.
- AC5: Given a filter for each v1 Same-Attribute Link Type, the service restricts results to the corresponding Association Attribute Type.
- AC6: Given Attribute Link rows with Attribute Link Type and source provenance, the response includes enough provenance for display and annotation without exposing Attribute Link Type as the v1 filter dimension.
- AC7: Given Attribute Link rows, the service derives Same-Attribute Link Type at query time and does not require stored customer-to-customer edge type.
- AC8: Given Attribute Link rows, the service does not require stored link strength in the index table; any strength/ranking returned is derived at result time.
- AC9: Given high-fanout Attributes beyond the configured limit, the service caps or rejects expansion with a clear response that prevents interactive overload.
- AC10: Given a missing DuckDB snapshot file, the graph query service returns a clear unavailable error instead of an unhandled failure.
- AC11: Given a valid DuckDB snapshot, the graph query service opens it read-only and does not mutate it during lookup.
- AC12: Given clean snapshot inputs, the refresh builds a candidate DuckDB file, validates required schema/counts, and promotes it atomically only after validation passes.
- AC13: Given a failed candidate snapshot validation, the refresh does not replace the previous live DuckDB snapshot.
- AC14: Given Hudi-managed warehouse table directories, the DuckDB refresh does not raw-scan those directories as serving inputs.
- AC15: Given linked customer IDs, live enrichment is performed in batches against the online Source Evidence Database or its test fake, not by one query per neighbor.
- AC16: Given enrichment timeout or failure after DuckDB lookup succeeds, the API returns usable graph evidence with a clear partial-enrichment indication or nullable enrichment fields.
- AC17: Given existing frontend graph search behavior, the review workbench or graph demo can still search by customer ID and render linked customers after the backend model changes.
- AC18: Given link type filters in the UI/API, each v1 filter maps to the expected Association Attribute Type: same mobile phone, same email, same business name, same person name, same identity number, same address, same store URL, and same IP.
- AC19: Given evidence annotations in the UI, reviewers can inspect source/provenance labels for a displayed association.
- AC20: Given the feature is delivered, pairwise `dwd_graph_edges` is not required for the v1 serving path.
- AC21: Given all available directed Attribute Links, non-customer links may be stored in the snapshot, but v1 customer lookup only traverses customer to Attribute to customer.
- AC22: Given CI and review gates, the new backend, refresh, and frontend behavior are covered by automated tests at the required levels without skipped tests or mocks of first-party internal seams.

## Critical User/System Journeys

- J1: A reviewer searches for a customer ID, receives linked customers grouped by same-attribute result category, and sees evidence values and provenance.
- J2: A reviewer filters the lookup to one same-attribute link type and sees only matching associations.
- J3: The query service resolves linked customers from DuckDB Attribute Links without using precomputed customer-to-customer edges.
- J4: The query service handles no-result, high-fanout, missing-snapshot, and enrichment-failure paths with user-meaningful responses.
- J5: The snapshot refresh builds and validates a candidate DuckDB file and only then promotes it over the live read-only snapshot.
- J6: The frontend graph panel renders the revised response and lets the reviewer inspect annotations without layout or interaction regressions.

## Test Matrix

| Scenario | AC/Journey | Test Level | Mock/Fake Policy | Setup/Input | Assertions | Required Evidence |
|---|---|---|---|---|---|---|
| Two-hop linked customer lookup | AC1, AC3, J3 | Service integration | Real temporary DuckDB file; no internal service mock | Customer A and B share one Attribute; C does not | B returned, C absent, result contains shared Attribute evidence | Python/FastAPI or CLI service test name and command output |
| Empty lookup | AC2, J4 | Service integration | Real temporary DuckDB file | Customer has no shared Attributes | 200 response, empty edges/results, valid stats | Test name and command output |
| Multi-evidence linked customer | AC4, J1 | Service integration | Real temporary DuckDB file | Same two customers share email and mobile phone | Both evidence groups/result rows preserved | Test name and command output |
| Same-attribute filters | AC5, AC18, J2 | Contract/API + service integration | Real temporary DuckDB file | Seed all v1 Association Attribute Types | Each filter returns only matching type | Test name and command output |
| Provenance display data | AC6, AC19, J1 | Contract/API + UI E2E | API fake may stand in for external graph service at frontend boundary; service test uses real DuckDB | Attribute Link Type and source field labels exist | Response carries annotation fields; UI renders inspectable annotation | API contract test plus Playwright trace/screenshot |
| Derived result semantics | AC7, AC8, AC20, J3 | Service integration | Real temporary DuckDB file | Snapshot has no pairwise edge table and no stored strength | Lookup succeeds and derives result link type; no edge table required | Test name and command output |
| High-fanout guard | AC9, J4 | Service integration | Real temporary DuckDB file | Attribute linked to more customers than limit | Expansion capped or rejected with documented error code | Test name and command output |
| Missing snapshot | AC10, J4 | API/contract | No DuckDB file | Request health/lookup | Clear unavailable status and error body | Test name and command output |
| Read-only serving | AC11, J3 | Service integration | Real temporary DuckDB file, read-only connection | Lookup request | Snapshot row counts/checksum unchanged; no write SQL path needed | Test name and command output |
| Candidate refresh success | AC12, J5 | Command/job integration | Local clean snapshot fixture; filesystem temp dir | Valid exported Attribute Link data | Candidate created, validated, live file atomically replaced | Command output and resulting file checks |
| Candidate refresh failure | AC13, J5 | Command/job integration | Local clean snapshot fixture; filesystem temp dir | Invalid/missing required columns | Live file remains previous version | Command output and file checks |
| No raw Hudi scan | AC14, J5 | Unit/command contract + review evidence | No live Hudi needed | Refresh invoked with disallowed Hudi warehouse path | Command rejects path or tests assert refresh only accepts clean snapshot path | Test name and code evidence |
| Batched enrichment | AC15, J1 | Integration/contract | Fake external Source Evidence Database adapter only | Multiple linked customer IDs | One batch call or bounded batch calls; no per-neighbor calls | Test name and fake call assertion |
| Partial enrichment failure | AC16, J4 | Integration/contract | Fake external Source Evidence Database adapter failure | DuckDB lookup succeeds; enrichment fails | Evidence returned with partial indicator or nullable enrichment fields | Test name and command output |
| Frontend search compatibility | AC17, J1, J6 | UI E2E | Frontend may mock external graph API at network boundary, not internal UI modules | Authenticated reviewer opens graph panel and searches | Linked customers render; stats and graph canvas usable | Playwright test name, screenshot/trace |
| Frontend filter and annotation | AC18, AC19, J2, J6 | UI E2E + presentation | Frontend may mock external graph API at network boundary | Mock response includes multiple link types and annotations | Filter changes visible results; annotation control is visible and inspectable | Playwright test name, screenshot/trace |
| V1 traversal boundary | AC21, J3 | Service integration | Real temporary DuckDB file | Non-customer links exist beyond two hops | Customer lookup does not traverse arbitrary multi-hop paths | Test name and command output |
| CI/review gate | AC22 | CI/enforcement audit | No mocks | CI config and package scripts | Required service/frontend tests run in blocking gates or documented follow-up issue exists | CI link or local command evidence |

## Mock And Integration Policy

- Mock acceptable: external Source Evidence Database enrichment adapter, network boundary between frontend and graph query service for frontend-only tests, failure injection for external dependency timeouts.
- Integration required: DuckDB lookup behavior, refresh file promotion, API request/response contracts, fanout enforcement, filter semantics, and any schema migration/export logic.
- External dependency strategy: use real temporary DuckDB files and local fixture exports for service tests; use fake external enrichment adapter; use Playwright network fixtures only at the frontend-to-backend boundary.
- Mock-only exceptions: none approved. Mocking first-party internal seams such as the query service logic, DuckDB repository, internal API route, or refresh command is not acceptable for required integration coverage.

## Required Automated Tests

- Unit: mapping from Association Attribute Type to Same-Attribute Link Type; validation of allowed filter values; disallowed raw Hudi path detection if implemented as a pure guard.
- Integration: DuckDB two-hop lookup, filters, fanout limits, missing snapshot, read-only serving, batch enrichment, partial enrichment, snapshot refresh success/failure.
- Contract/API: graph lookup response schema, error schema, filter request schema, partial enrichment schema, health/stats behavior.
- API E2E: graph query endpoint with real temporary DuckDB and fake external enrichment where practical.
- UI E2E: authenticated reviewer searches graph, applies link type filters, inspects annotation controls, and sees stable rendered results.
- Journey E2E: review workbench or graph demo path from customer entry/opening through graph lookup and result inspection.

## Coverage Mapping

| Requirement/Journey | ACs | Test Case/File | Status |
|---|---|---|---|
| Association Link Lookup two-hop behavior | AC1, AC2, AC3, AC4, AC21 / J1, J3 | `tests/test_duckdb_graph_service.py` | Implemented |
| Same-attribute filter behavior | AC5, AC18 / J2 | `tests/test_duckdb_graph_service.py`; `frontend/graph-demo/e2e/graph-demo.spec.ts` | Implemented |
| Provenance and annotation behavior | AC6, AC19 / J1, J6 | `tests/test_duckdb_graph_service.py`; `frontend/graph-demo/e2e/graph-demo.spec.ts`; `frontend/graph-demo/e2e/workbench.spec.ts` | Implemented |
| Derived result semantics and no required pairwise edge table | AC7, AC8, AC20 / J3 | `tests/test_duckdb_graph_service.py`; ADR-0006 | Implemented |
| Fanout and failure behavior | AC9, AC10, AC16 / J4 | `tests/test_duckdb_graph_service.py`; `frontend/graph-demo/e2e/graph-demo.spec.ts` | Partial: legacy degree guard and partial-warning display are covered; dedicated `/neighbors` high-fanout, missing snapshot, and enrichment-failure contract tests remain to be added by the serving/enrichment slices. |
| Read-only DuckDB serving and snapshot replacement | AC11, AC12, AC13, AC14 / J5 | `tests/test_duckdb_graph_service.py`; `tests/test_duckdb_snapshot_refresh.py` | Implemented |
| Live enrichment boundary | AC15, AC16 / J1, J4 | `tests/test_duckdb_graph_service.py`; `frontend/graph-demo/e2e/graph-demo.spec.ts` | Partial: frontend partial-enrichment presentation is covered; batched live Source Evidence Database enrichment is owned by the live-enrichment slice and is not implemented in this PR. |
| Frontend compatibility and presentation | AC17, AC18, AC19 / J1, J2, J6 | `frontend/graph-demo/e2e/graph-demo.spec.ts`; `frontend/graph-demo/e2e/workbench.spec.ts` | Implemented |
| CI/review enforcement | AC22 | `.github/workflows/association-serving.yml`; [#42](https://github.com/1aboveio/skyee-ai-risk/issues/42) | Partial: workflow is implemented and runs on PR/dev; GitHub-required status enforcement is tracked in #42. |

## Test Skipping

- Skipped tests: None allowed. Missing data must be seeded; external dependencies must use fakes at the boundary; unsupported environment checks must be routed to a reporting lane rather than skipped.

## Behavior-First Validation

- ACs describe externally observable behavior, not private functions.
- Test matrix scenarios validate outcomes, contracts, side effects, failure behavior, and rendered UI behavior.
- Unit tests are scoped to public mapping/validation behavior.
- Mock-only coverage does not bypass the core DuckDB lookup, refresh, or API behavior under test.
- Existing coverage claims must be verified against actual test code during audit mode.
- Route discovery and reachability analysis must be performed before final E2E audit for changed browser/API surfaces.
- Production-readiness verdict will be stated in the final audit as an explicit ship/no-ship call.
- Status: PASS
- Required revisions before approval: None known.

## Reviewer Checklist

- Obligation impact stated: changed backend query service, DuckDB snapshot refresh, frontend graph search, and graph display surfaces must map to this criteria document.
- No orphan surface introduced: every new or changed route/command/table surface must map to at least one AC row.
- Every changed/new page with graph controls must have a UI E2E or Journey E2E proving visible controls and response rendering.
- Every AC maps to an automated test or approved exception.
- Tests assert behavior/state, not implementation details only.
- No tests are skipped/weakened to make CI pass.
- Substitutes appear only at external trust boundaries; no internal seam is mocked.
- Failure, duplicate/no-result, permission/auth where applicable, and fanout cases are covered.
- Test evidence must include CI link, command output, logs, screenshots, or traces.

## Blocking Decisions

- None.
