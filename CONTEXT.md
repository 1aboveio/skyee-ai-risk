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

**Confirmed Risk Registry**:
A curated registry of confirmed risk entries for business subjects such as customers, companies, accounts, contact points, or other future risk subjects. It is used as confirmed risk material for investigation, validation, evaluation, and future monitoring use cases, not as a live operational blacklist by itself.
_Avoid_: Ground truth dataset, blacklist, risk signal feed, evidence feature store

**Confirmed Risk Entry**:
A confirmed risk statement attached to a business subject, such as a customer being a bad customer. It records what is known to be true about the subject for reference use.
_Avoid_: Risk signal, model score, inferred label

**Risk Subject**:
A business subject that can receive a confirmed risk entry, such as a customer, company, account, phone, email, or IP.
_Avoid_: Entity, graph node, transaction counterparty

**Company**:
A resolved business subject representing a company with a stable customer or identity record.
_Avoid_: Company name

**Company Name**:
A name string that may identify, alias, or resemble a company but is not itself a resolved company subject.
_Avoid_: Company

**Business Name Relationship**:
A shared-attribute relationship inferred because two subjects share a company, merchant, sole-proprietor, or other business-name string. It is evidence of possible association, not proof that the subjects are the same business.
_Avoid_: Same company, same entity, entity name relationship

**Bad Customer**:
A customer that has been confirmed as bad in the Confirmed Risk Registry.
_Avoid_: Suspected customer, high-risk neighbor, rule hit

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
The internal-trigger capability that detects relationships among merchants, accounts, transactions, channels, blacklists, historical risk records, and associated bad actors, then turns graph hits into standardized case intake events. It can also be consumed as evidence during deep investigation.
_Avoid_: Dashboard, post-case-pool workflow state

**Association Analysis**:
A Risk Graph analysis mode that examines shared-attribute relationships to find related parties, likely common control, or risk propagation paths.
_Avoid_: Transaction flow analysis, payment tracing

**Transaction Flow Analysis**:
A Risk Graph analysis mode that examines directional transaction counterparty relationships to reconstruct money movement, payout fanout, collection fan-in, or circular flow.
_Avoid_: Association analysis, shared-attribute matching

**Graph Party**:
An entity that can appear as a node in the Risk Graph. A graph party may be a known merchant or a transaction counterparty that has not been resolved to a merchant.
_Avoid_: Merchant when the party is not known to be a merchant

**Merchant Party**:
A graph party resolved to a known merchant record.
_Avoid_: Counterparty party, unresolved party

**Counterparty Party**:
A graph party observed in transaction activity but not necessarily resolved to a known merchant record.
_Avoid_: Merchant party, shared-attribute match

**Shared-Attribute Relationship**:
A relationship inferred because two parties share an identifying or descriptive attribute, such as a phone number, email, identity document, address, store URL, or login IP. It is evidence of association, not direct transactional activity.
_Avoid_: Transaction counterparty, payment edge

**Transaction Counterparty Relationship**:
A directional relationship from the initiating customer or account to the transaction counterparty observed in payment or collection activity. It represents transaction flow evidence and should not be treated as the same kind of association as a shared-attribute relationship.
_Avoid_: Shared-attribute relationship, undirected counterparty match, generic customer connection

**Aggregated Transaction Relationship**:
A transaction counterparty relationship summarized between two graph parties across one or more transaction events. It is the default relationship used for Transaction Flow Analysis views and traversal.
_Avoid_: Raw transaction event, shared-attribute relationship

**Debtor Party**:
The party whose account or customer relationship directly initiates a payment. In POBO activity, the debtor party may service the payment without being the ultimate source of funds.
_Avoid_: Ultimate debtor party, beneficiary party

**Ultimate Debtor Party**:
The party on whose behalf a payment is made when the direct debtor differs from the actual payer. It is the source side of the money-flow relationship for POBO activity.
_Avoid_: Debtor party, servicing party

**Beneficiary Party**:
The party receiving funds or value in a transaction flow.
_Avoid_: Counterparty when the receiving role is known, debtor party

**Servicing Party**:
The customer or account relationship that facilitates a transaction on behalf of another party. In POBO activity, the servicing party is retained as transaction context but is not the default source node of the money-flow edge.
_Avoid_: Ultimate debtor party, beneficiary party

**POBO**:
Pay On Behalf Of activity where the ultimate debtor differs from the direct debtor or servicing party.
_Avoid_: Same-name payment as a graph direction, ordinary outbound payment

**Dashboard**:
The Business AI Workbench view for monitoring case volume, source distribution, queue backlog, SLA, risk distribution, investigation productivity, disposition results, RFI response progress, and feedback closure.
_Avoid_: Workflow state engine, final decision authority
