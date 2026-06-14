# Review Workbench Database Boundary

Accepted.

The Customer Risk Review Workbench will use Postgres as the application-owned Review Store and server-side MySQL access as the realtime Source Evidence Database. The Review Store owns review sessions, reviewer decisions, required notes, Review Evidence Snapshots, cached evidence summaries, and audit-supporting metadata; the Source Evidence Database provides latest customer and transaction evidence for frontend review assembly.

This is a deliberate exception to the default warehouse-read convention for realtime workbench evidence. Warehouse, DWD, and STG remain the analytical source for ETL, graph/offline evidence, validation, and reporting, while the workbench backend may query MySQL server-side when latest operational evidence is required for human review.
