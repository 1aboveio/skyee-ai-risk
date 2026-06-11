# AI Case Investigation System Boundaries

Accepted.

We will position the first-phase product as an AI Case Investigation Automation System, not a full AI risk control platform. The system will supplement the customer's existing risk operations flow by adding the modules needed to carry case intake, workflow-driven task orchestration, AI-assisted investigation execution, human review, disposition, follow-up tasks, and feedback capture.

## Decision

The customer's existing flowchart remains the business baseline. We will not replace it with a new AI-native process; instead, we will build system modules that map onto and carry the existing flow:

- Case source adapters for KYC, rule triggers, field checks, internal reports, batch reviews, RFI, offline rules, and graph associations.
- A case intake layer for standardization, deduplication, merging, and case creation.
- A case pool for priority, SLA, queueing, and assignment entry.
- A workflow task queue for executable tasks created from cases.
- A workflow orchestration layer for deterministic case routing, task assignment, state transitions, SLA, approvals, audit logs, and follow-up task creation.
- A Coordinator that consumes workflow tasks, selects executors, tracks execution, and aggregates investigation outputs without owning primary case state.
- Executors that perform role-specific investigation tasks using configured skills and controlled tool access.
- Connectors that provide controlled access to KYC, transactions, RFI materials, blacklists, graph relationships, field checks, and historical risk records.
- An AI investigation execution layer for evidence retrieval, material analysis, timeline reconstruction, relationship analysis, gap identification, report drafting, and RFI response drafting.
- A human review layer for confirming escalation, account closure, acceptance, RFI response approval, and strategy-team handoff.
- A feedback capture layer for effective signals, false-positive reasons, disposition outcomes, rule suggestions, and case knowledge.

Workflow owns task orchestration and primary case state. The Coordinator consumes tasks from the workflow task queue, not directly from the case pool. AI does not decide the main process path. AI works inside workflow-created investigation tasks and produces reviewable investigation packages. Humans confirm final disposition actions.

## Considered Options

Option 1 was to make AI the investigation orchestration layer. We rejected this because task orchestration needs deterministic state transitions, permissions, SLA, auditability, and replayability. Those are workflow responsibilities, not AI responsibilities.

Option 2 was to build a separate top-down AI architecture independent of the customer's original flowchart. We rejected this because it increases customer communication cost and makes the solution look like a replacement process. The project should be presented as system support for the customer's existing operating model.

Option 3 was to treat RFI response and strategy-team feedback as primary case states. We rejected this because they can be conditional, optional, and parallel follow-up tasks. Primary case state should remain limited to investigation stages and final disposition results.

## Consequences

The architecture must clearly separate case source, risk type, risk signal, primary case state, disposition outcome, and follow-up task.

The architecture must also separate the case pool from the workflow task queue. The case pool is the case-level view; the workflow task queue is the executable task-level view.

The first phase should not promise automated final closure, automated account shutdown, automated formal RFI sending, rule replacement, or full replacement of KYC, transaction monitoring, rule engines, and final disposition authority.

Customer-facing diagrams should use the customer's original flow as the reference point. The primary architecture diagram should show which system modules carry the existing process, while separate zoom-in diagrams may explain the workflow and AI execution split.

Scope should be communicated with three delivery categories: Business AI Workbench, Agent Engineering Platform, and Case Workflow System Platform. Customer-existing capabilities should remain visible as context and integration targets, but not as a delivery category.
