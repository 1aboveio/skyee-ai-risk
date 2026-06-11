# AI Risk Operations

This context defines the language used to describe AI-assisted risk operations for customer risk review, investigation, disposition, and feedback.

## Language

**AI Case Investigation Automation System**:
The first-phase product scope for automating risk case intake, evidence gathering, investigation reasoning, disposition recommendation, and feedback capture.
_Avoid_: AI risk control platform, full risk control middle platform

**Workflow Orchestration Layer**:
The part of the system that controls deterministic case routing, task assignment, state transitions, SLA, and review handoffs.
_Avoid_: AI reasoning layer, final decision authority

**Investigation Execution Layer**:
The part of the system that performs automatable investigation tasks, such as retrieving records, analyzing evidence, drafting conclusions, identifying gaps, and preparing recommended actions. AI may assist or execute tasks within this layer, but workflow controls task orchestration.
_Avoid_: Final disposition authority, account closure authority

**Investigation Action**:
An automatable action performed during an investigation, such as retrieving data, analyzing evidence, drafting a response, identifying missing materials, or creating a review task.
_Avoid_: Disposition action

**Disposition Action**:
A high-impact action confirmed by a human after investigation, such as account closure, escalation, or formal approval of an external response.
_Avoid_: Investigation action

**Risk Case**:
An investigation container for a customer or merchant risk concern. A risk case may be opened from multiple intake sources and may contain one or more triggering events, risk signals, and investigation tasks.
_Avoid_: Alert, rule hit, transaction case

**Case Pool**:
The queue of risk cases waiting to be triaged, investigated, disposed, or archived.
_Avoid_: Alert pool, event pool

**Workflow Task Queue**:
The queue of executable workflow tasks created from risk cases, such as RFI investigation, transaction analysis, onsite review, human review, RFI response drafting, or strategy feedback.
_Avoid_: Case pool

**Case Source Adapter**:
The integration component that converts a specific upstream source, such as KYC, rule triggers, RFI, internal reports, batch reviews, or graph associations, into standardized case intake events.
_Avoid_: Case intake layer

**Case Intake Layer**:
The component that turns standardized intake events into risk cases by validating, normalizing, deduplicating, merging, creating cases, or attaching new risk signals to existing cases.
_Avoid_: Case source adapter

**Coordinator**:
The component that consumes workflow tasks, selects suitable executors, tracks execution, and aggregates investigation outputs. It does not own primary case state or final disposition authority.
_Avoid_: Workflow orchestration layer, final decision engine

**Executor**:
An investigation worker or agent that performs a specific investigation task using assigned skills and available connectors.
_Avoid_: Coordinator, human reviewer

**AI Execution Capability**:
The implementation capability for automated investigation work, made of Agent, Skills, Connector permissions, output contracts, and quality checks.
_Avoid_: Single skill, workflow orchestrator

**Connector**:
The Agent Engineering Platform component that provides controlled access to investigation data and tools, such as KYC, transactions, RFI materials, blacklists, graph relationships, field checks, historical risk records, and evidence tag packages exposed by system platform APIs or MCP services.
_Avoid_: Executor, case source adapter

**Human Review**:
The review step where a human evaluates investigation outputs and confirms escalation, acceptance, account closure, external response approval, or follow-up tasks.
_Avoid_: AI investigation execution

**Intake Source**:
The origin by which a risk case enters the case pool, such as process input, rule trigger, internal report, batch review, external report, RFI, offline rule, or graph association.
_Avoid_: Risk type, case type

**Risk Type**:
The suspected category of substantive risk being investigated, such as fraud, large-scale money laundering, or prohibited business activity.
_Avoid_: Intake source, trigger condition

**Business Judgment Direction**:
The business question the investigator needs to answer in the AI workbench, such as fraud suspicion, large-scale money laundering suspicion, prohibited business activity, or channel/RFI transaction reconstruction.
_Avoid_: Intake source, workflow state

**Investigation Type**:
The depth or mode of investigation work performed in the AI workbench, such as shallow investigation, deep investigation/EDD, RFI response investigation, or review and feedback.
_Avoid_: Risk type, intake source

**Evidence Tag Package**:
A grouped package made of risk tags plus supporting evidence. It is produced by the system platform or risk data service through APIs or MCP services, then consumed by the Agent Engineering Platform through Connectors for AI workbench presentation and skill execution.
_Avoid_: Scoring model, final decision, agent-generated source facts

**Scenario Package**:
A deliverable unit for the Business AI Workbench that combines trigger logic, investigation type, evidence tag package, output template, and quality checks for a concrete business scenario.
_Avoid_: Single page, single skill

**Risk Signal**:
An observed fact, pattern, rule hit, report, or anomaly that supports suspicion within a risk case.
_Avoid_: Intake source, risk type

**Investigation**:
The work of collecting, connecting, and interpreting evidence for a risk case before a disposition outcome is confirmed.
_Avoid_: Disposition, rule execution

**Disposition Outcome**:
The confirmed result for a risk case, such as acceptance, escalation, or account closure.
_Avoid_: Risk type, intake source

**Primary Case State**:
The main lifecycle state of a risk case, limited to investigation stages and final disposition results.
_Avoid_: Follow-up task, intake source

**Follow-up Task**:
An action created after or alongside a disposition outcome, such as preparing an RFI response or sending feedback to the strategy team.
_Avoid_: Primary case state

**Escalation**:
A disposition outcome that sends a risk case into deeper review because the current investigation cannot safely resolve it.
_Avoid_: Closure, RFI response

**RFI**:
An external request or notification that asks for information, materials, explanation, or cooperation about a customer, merchant, transaction, or funds movement.
_Avoid_: Typical case, rule trigger

**RFI Response**:
A follow-up task that prepares or sends a response to an external request for information after the relevant investigation and approvals.
_Avoid_: RFI, external report

**Delivery Scope Marking**:
A business-facing annotation used to explain whether a module is a customer-existing capability, business AI workbench capability, case workflow system platform capability, or agent engineering platform capability.
_Avoid_: Delivery scope tier, scope category, module type, technical layer

**Business AI Workbench**:
The business-facing workspace where operators, reviewers, risk managers, and strategy teams use AI to investigate cases, review evidence, confirm recommendations, and provide feedback.
_Avoid_: Agent engineering platform, skill management console

**Agent Engineering Platform**:
The technical platform for building and governing AI agent capabilities, including Coordinator, Executor, Connector, AgentSpec, Skills, Evaluation, permissions, release governance, and monitoring.
_Avoid_: Business AI workbench, case workflow system

**Case Workflow System Platform**:
The system platform that carries case intake, case pool, workflow, task queue, state transitions, SLA, disposition flow, follow-up tasks, audit, and writeback.
_Avoid_: Agent engineering platform, business AI workbench

**Risk Graph**:
The internal-trigger capability that detects relationships among customers, accounts, transactions, channels, blacklists, historical risk records, and associated bad actors, then turns graph hits into standardized case intake events. It can also be consumed as evidence during deep investigation.
_Avoid_: Dashboard, post-case-pool workflow state

**Dashboard**:
The Business AI Workbench view for monitoring case volume, source distribution, queue backlog, SLA, risk distribution, investigation productivity, disposition results, RFI response progress, and feedback closure.
_Avoid_: Workflow state engine, final decision authority
