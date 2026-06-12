# Separate Transaction Flow from Association Graph

Accepted.

Risk Graph supports two analysis modes with different semantics: Association Analysis over shared-attribute relationships and Transaction Flow Analysis over directional transaction counterparty relationships. We will keep the customer-oriented association tables separate from the transaction-flow tables because transaction counterparties are not always known customers, transaction edges are directional, and transaction fanout should not inflate default association degree or interactive association expansion limits.

## Consequences

The existing customer graph tables remain scoped to shared-attribute relationships. Transaction Flow Analysis will use broader graph party nodes and directional transaction edge tables, while the product can still present both modes under one Risk Graph experience. Transaction Flow Analysis views and traversal should use aggregated transaction relationships by default; raw transaction events remain available for drill-down, audit, timeline, and RFI reconstruction. Transaction edge direction follows money or value flow; for POBO activity, the default flow edge starts from the ultimate debtor and keeps the servicing customer as transaction context.
