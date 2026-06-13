# PRD: Customer Risk Review Workbench

GitHub issue: https://github.com/1aboveio/skyee-ai-risk/issues/8

## Problem Statement

Risk reviewers need a single Customer Risk Review Workbench where they can enter one customer ID, inspect the latest customer and transaction evidence, review graph and confirmed-risk context, and make or preserve a review outcome without switching between raw databases, graph tools, spreadsheets, and historical notes.

The current graph demo proves part of the experience: a reviewer can search a customer ID and inspect graph associations. It does not yet provide the full Review Evidence Package needed for prescreening, workflow Human Review, second-round review, or ad hoc review. It also does not persist Review Evidence Snapshots, reviewer decisions, mandatory notes, or auditable FX normalization metadata.

The workbench must remain evidence-first. At this stage it must not show an AI-generated recommendation by default. The evidence shown to the reviewer should later be reusable as input to AI investigation, but the v1 workbench is a human visualization and review tool.

## Solution

Build a generic Customer Risk Review Workbench in the Business AI Workbench. The workbench accepts one `cust_id`, fetches evidence sections independently, displays a Review Evidence Package, and lets the reviewer either save an ad hoc snapshot or submit a workflow Human Review decision.

The Review Evidence Package has these default sections:

1. Customer Profile
2. Decision Summary
3. Risk Signals
4. Transaction Summary
5. Transaction List
6. Risk Graph
7. Evidence Timeline
8. Evidence Gaps
9. AI Investigation Input

The page uses a Review Context to determine available actions while keeping one shared evidence layout:

- Prescreening: evidence review only in v1; no Create Risk Case action.
- Workflow Human Review: `Accept` or `Reject`, with mandatory reviewer note.
- Second-Round Review: review evidence and confirm the workflow-provided action surface when available.
- Ad Hoc Review: `Save Snapshot`, with optional reviewer note.

The workbench uses server-side APIs only. The browser never connects directly to databases. The backend reads latest customer and transaction evidence from the Source Evidence Database, reads and writes workbench-owned data in the Review Store, uses a server-side Forex Rate Service for USD normalization, and reads graph/offline evidence from the existing graph/warehouse-side evidence paths.

The Review Store is Postgres. It stores review sessions, reviewer decisions, notes, Review Evidence Snapshots, cached evidence summaries, daily FX rates, and audit-supporting metadata. The Source Evidence Database is MySQL and provides latest operational customer and transaction facts. Warehouse/DWD/STG remain analytical sources for ETL, graph/offline evidence, validation, and reporting.

## User Stories

1. As a risk reviewer, I want to enter one customer ID, so that I can review evidence for the exact customer I am responsible for.
2. As a risk reviewer, I want the customer profile to load first, so that I can confirm I am reviewing the correct customer.
3. As a risk reviewer, I want evidence sections to load independently, so that one slow evidence source does not block the whole workbench.
4. As a risk reviewer, I want each evidence section to show loading, empty, error, and freshness states, so that I can trust what is and is not available.
5. As a risk reviewer, I want to see customer type, status, KYC status, country, registration time, activation time, risk level, and current flags, so that I can understand baseline customer context.
6. As a risk reviewer, I want to see risk signals, so that I can understand why the customer is suspicious or why the customer may be safe.
7. As a risk reviewer, I want to see confirmed-risk matches, so that I can identify customers matching known bad or fraud-related subjects.
8. As a risk reviewer, I want to see transaction summary metrics, so that I can quickly understand recent transaction behavior.
9. As a risk reviewer, I want a transaction list separate from transaction summary, so that I can inspect the underlying transactions behind summary metrics.
10. As a risk reviewer, I want the transaction list to show the most recent transactions first, so that the latest operational evidence is immediately visible.
11. As a risk reviewer, I want the transaction list to initially load the recent 20 transactions, so that the page is fast and focused.
12. As a risk reviewer, I want the transaction list to lazy-load more rows as I scroll, so that I can inspect more history without switching pages.
13. As a risk reviewer, I want transaction loading to use cursor-based pagination, so that live transaction data remains stable while I scroll.
14. As a risk reviewer, I want transaction order fixed to newest-first, so that snapshots and review evidence are consistent.
15. As a risk reviewer, I want to filter transactions by date range, so that I can focus on the relevant review window.
16. As a risk reviewer, I want to filter transactions by direction, so that I can distinguish inbound and outbound behavior.
17. As a risk reviewer, I want to filter transactions by USD-equivalent amount range using a range slider, so that I can quickly focus on relevant amount bands.
18. As a risk reviewer, I want each transaction to show original amount and currency, so that I can inspect the source transaction fact.
19. As a risk reviewer, I want each transaction to show normalized USD amount, so that I can compare transactions across currencies.
20. As a risk reviewer, I want each transaction to show FX rate, FX rate date, FX source, and conversion status, so that USD normalization is explainable.
21. As a risk reviewer, I want FX conversion warnings to be visible but non-blocking, so that I can continue review while understanding data-quality gaps.
22. As a risk reviewer, I want the transaction table to use Dice UI Data Table, so that the table has a consistent accessible UI with filters and server-backed data.
23. As a risk reviewer, I want transaction data fetching to use SWR cache, so that scrolling and filter changes feel responsive.
24. As a risk reviewer, I want SWR cache to be treated as UI cache only, so that audit records come from persisted snapshots rather than browser state.
25. As a risk reviewer, I want to see graph associations, so that I can understand relationships to high-risk or bad customers.
26. As a risk reviewer, I want graph relationships to distinguish strong and weak evidence, so that I do not over-read weak associations.
27. As a risk reviewer, I want transaction-flow evidence to remain distinct from shared-attribute graph evidence, so that I do not confuse money movement with association evidence.
28. As a risk reviewer, I want to see review history, so that I know whether this customer has been reviewed before.
29. As a risk reviewer, I want prior decision snapshots and ad hoc snapshots to be clearly distinguished, so that I do not mistake a saved snapshot for a disposition.
30. As a risk reviewer, I want ad hoc saved snapshots to be labeled `Snapshot Only`, so that review history is clear.
31. As a risk reviewer, I want to save an ad hoc snapshot without making an Accept or Reject decision, so that I can preserve evidence for later review.
32. As a risk reviewer, I want ad hoc snapshot notes to be optional, so that lightweight evidence preservation is not slowed down.
33. As a workflow reviewer, I want to submit `Accept` or `Reject`, so that I can complete a workflow Human Review decision.
34. As a workflow reviewer, I want reviewer notes to be mandatory for `Accept` and `Reject`, so that final disposition decisions have human explanation.
35. As a workflow reviewer, I do not want reason codes in v1, so that the first version keeps decision capture simple.
36. As a compliance reviewer, I want the Review Evidence Snapshot to persist what was shown at decision time, so that later audit can reconstruct the review.
37. As a compliance reviewer, I want snapshots to store rendered evidence summaries and source references, so that evidence is both readable and traceable.
38. As a compliance reviewer, I want snapshots to include loaded transaction rows, filters, cursor context, sort order, fetched-at timestamps, and FX metadata, so that transaction evidence is reproducible.
39. As a compliance reviewer, I want snapshots to record unavailable panels and warnings, so that missing evidence is not hidden.
40. As a risk operations manager, I want the workbench to support prescreening, workflow review, second-round review, and ad hoc review through one layout, so that reviewers learn one tool.
41. As a risk operations manager, I want actions to vary by Review Context, so that the same workbench does not bypass workflow controls.
42. As a platform engineer, I want all database access to happen server-side, so that database credentials and source systems are never exposed to the browser.
43. As a platform engineer, I want the Review Store to be separate from the Source Evidence Database, so that app-owned decisions and source-owned evidence do not blur together.
44. As a platform engineer, I want the Review Store to cache daily FX rates only, so that reusable reference data is fast without caching mutable transaction conversions outside snapshots.
45. As a platform engineer, I want the Forex Rate Service to support scheduled daily sync and lazy backfill, so that normal use is fast and old transactions can still be converted.
46. As a platform engineer, I want the Forex Rate Service to use latest prior rate at or before transaction date, so that conversions avoid lookahead bias.
47. As a platform engineer, I want the Forex Rate Service to store rates in `USD -> quote currency` direction, so that conversion semantics match the FX reference data.
48. As an AI engineer, I want the Review Evidence Package to include normalized facts and evidence references, so that it can later be used as AI investigation input.
49. As an AI engineer, I do not want AI recommendations to run automatically in v1, so that the first release remains evidence-first and avoids anchoring reviewers.
50. As a product stakeholder, I want v1 to exclude Create Risk Case, so that case intake and workflow ownership are not introduced before the workflow contract is explicit.
51. As a product stakeholder, I want v1 to support only one customer ID at a time, so that decision, snapshot, and audit semantics stay clear.
52. As a product stakeholder, I want the workbench to be generic rather than tied to one workflow stage, so that it can support prescreening, review, and ad hoc use.

## Implementation Decisions

- Build one generic Customer Risk Review Workbench parameterized by Review Context rather than separate pages for prescreening, workflow Human Review, second-round review, and ad hoc review.
- The workbench displays a Review Evidence Package. The package is evidence and AI-investigation input material, not a final decision by itself.
- The default Review Evidence Package sections are Customer Profile, Decision Summary, Risk Signals, Transaction Summary, Transaction List, Risk Graph, Evidence Timeline, Evidence Gaps, and AI Investigation Input.
- Evidence sections fetch independently. The page must support partial loading, partial failure, freshness timestamps, and panel-level warnings.
- The v1 minimum required evidence before workflow `Accept` or `Reject` is Customer Profile, Risk Signals, Transaction Summary, Transaction List, and Review History.
- Risk Graph, Evidence Timeline, Evidence Gaps, and AI Investigation Input can be shown when available and recorded as unavailable when not available.
- No AI-generated recommendation appears by default in v1.
- Workflow Human Review actions are `Accept` and `Reject`.
- `Accept` and `Reject` require reviewer notes.
- v1 does not require structured reason codes.
- Ad hoc mode supports `Save Snapshot` without `Accept` or `Reject`.
- Ad hoc snapshot notes are optional.
- Ad hoc saved snapshots appear in Review History labeled `Snapshot Only`.
- v1 does not include Create Risk Case.
- v1 supports one customer ID at a time only.
- Persist a Review Evidence Snapshot at decision time and when ad hoc `Save Snapshot` is used.
- A Review Evidence Snapshot stores rendered evidence summaries, source references, loaded transaction rows, section states, warnings, filters, sort/cursor context, and freshness metadata.
- The Review Store is Postgres and owns review sessions, reviewer decisions, required notes, Review Evidence Snapshots, cached evidence summaries, daily FX rates, and audit-supporting metadata.
- The Source Evidence Database is MySQL and is used by server-side application code for latest operational customer and transaction evidence.
- The browser never accesses Postgres, MySQL, warehouse, or FX tables directly. It only calls application APIs.
- Warehouse, DWD, and STG remain analytical sources for ETL, graph/offline evidence, validation, and reporting.
- Graph evidence must respect the existing distinction between shared-attribute Association Analysis and directional Transaction Flow Analysis.
- Transaction List uses Dice UI Data Table as the table surface.
- Transaction List defaults to recent 20 transactions.
- Transaction List uses cursor-based lazy loading on scroll, not page-number pagination.
- Transaction List order is fixed newest-first: user-visible `txn_time DESC`, with an internal deterministic tie-breaker if needed for cursor stability.
- Reviewers cannot change transaction sort order in v1.
- Transaction filters in v1 are date range, direction, and USD-equivalent amount range.
- USD amount filtering uses a range slider. Numeric min/max controls may be added for precision if the UI needs them.
- Amount tiers are not part of v1 filters.
- Each transaction row returns original amount, original currency, normalized USD amount, FX rate, FX rate date, FX source, and conversion status.
- Use SWR for client-side section and transaction-page caching. SWR cache is not audit storage.
- The Forex Rate Service is server-side.
- The Forex Rate Service caches daily FX rates in the Review Store.
- The Forex Rate Service stores rates in USD-base direction: `base_currency = USD`, `quote_currency = transaction currency`, `rate` means `1 USD = rate quote currency`.
- USD conversion is `usdAmount = originalAmount / rate` when original currency is the quote currency.
- The Forex Rate Service uses the latest prior FX rate at or before the transaction date.
- If no prior rate exists, conversion warning is non-blocking and must be included in the evidence package and snapshot.
- The Forex Rate Service refreshes rates on a scheduled daily sync and lazily backfills missing rate/date combinations from the FX reference source.
- Lazy backfill can query the warehouse FX reference directly in v1.
- Cache daily FX rates only. Do not persist reusable per-transaction conversion results outside Review Evidence Snapshots.

## Testing Decisions

- Tests should verify externally observable behavior: what the reviewer sees, what APIs return, what decisions/snapshots persist, and how warnings/actions behave. Tests should not assert internal component structure, private helper names, or database implementation details beyond public persistence behavior.
- End-to-end tests should cover entering a customer ID, loading independent evidence sections, scrolling transactions, applying filters, saving an ad hoc snapshot, and submitting Accept/Reject with required notes.
- End-to-end tests should verify no AI recommendation is displayed by default.
- End-to-end tests should verify `Accept` and `Reject` are blocked until mandatory notes are present.
- End-to-end tests should verify `Save Snapshot` in ad hoc mode allows an empty note and is labeled `Snapshot Only` in Review History.
- API tests should cover Customer Profile, Risk Signals, Transaction Summary, Transaction List, Risk Graph, Review History, snapshot creation, and decision submission as externally visible contracts.
- API tests should verify evidence sections can fail independently and return panel-level errors or warnings without breaking unrelated panels.
- Transaction API tests should verify recent-first ordering, cursor continuation, date range filtering, direction filtering, USD amount range filtering, and fixed sort behavior.
- Transaction API tests should verify each transaction includes original amount/currency and USD conversion metadata.
- Forex Rate Service tests should verify scheduled-cache lookup, lazy backfill, latest-prior-rate selection, USD-base direction semantics, conversion warnings, and no lookahead rate selection.
- Snapshot tests should verify rendered evidence, source references, filters, loaded transaction rows, section warning states, and FX metadata are persisted.
- Review Store tests should verify decisions, notes, snapshot-only records, and review history labels.
- Source Evidence Database tests should use test doubles or controlled fixtures so source database credentials and production data are not required in automated test runs.
- UI component tests should focus on reviewer-visible behavior for Dice UI Data Table usage: loaded rows, scrolling/lazy load, filter controls, disabled/active states, and warning presentation.
- Prior art in the codebase includes the existing graph customer search flow, authenticated API route pattern, graph query service boundary, and health endpoint. These should be reused as high-level seams where possible.

## Out of Scope

- AI-generated recommendation by default.
- Automatic AI final decision.
- Structured reason codes for v1 decisions.
- Batch or multi-customer review.
- Create Risk Case action.
- Full workflow/case intake integration.
- Direct browser access to MySQL, Postgres, warehouse, graph tables, or FX reference tables.
- Replacing workflow ownership of state transitions, permissions, SLA, or audit.
- Replacing the existing Risk Graph edge semantics.
- Arbitrary transaction sorting in v1.
- Amount tiers in v1 filters.
- Persisting reusable per-transaction FX conversion cache outside Review Evidence Snapshots.
- RFI material ingestion, field investigation images, external web checks, and strategy feedback unless already available as structured evidence sources.
- Deployment/Cloud Build changes.

## Further Notes

- This PRD uses the project glossary terms Customer Risk Review Workbench, Review Evidence Package, Review Evidence Snapshot, Review Store, Source Evidence Database, and Forex Rate Service.
- The database boundary follows the accepted Review Workbench Database Boundary ADR.
- The FX normalization boundary follows the accepted Forex Rate Service For Review Evidence ADR.
- The workbench is part of the Business AI Workbench. It supports Human Review but does not become the Workflow Orchestration Layer or final AI decision authority.
- The exact schema names for source MySQL tables and FX reference ingestion should be confirmed during implementation. In warehouse exploration, FX reference data was observed as a USD-base `dim_forex` shape with fields equivalent to quote currency, exchange rate, base currency, and date.
