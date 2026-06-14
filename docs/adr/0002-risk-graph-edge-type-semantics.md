# Risk Graph Edge Type Semantics

Accepted.

Risk Graph supports two analysis modes with different edge semantics: Association Analysis over shared-attribute relationships and Transaction Flow Analysis over directional transaction relationships. We will keep customer-oriented shared-attribute association edges separate from transaction-flow edges because transaction counterparties are not always known customers, transaction edges are directional, and transaction fanout should not inflate default association degree or interactive association expansion limits.

Association edge types should describe the matched attribute, not overstate identity. Name-only association evidence is weak by default because a shared name string is not proof that two subjects are the same business or person; stronger evidence should come from identifiers such as certificate numbers, phones, emails, or transaction-flow context.

## Consequences

The existing customer graph tables remain scoped to shared-attribute relationships. Transaction Flow Analysis will use broader graph party nodes and directional transaction edge tables, while the product can still present both modes under one Risk Graph experience. Transaction Flow Analysis views and traversal should use aggregated transaction relationships by default; raw transaction events remain available for drill-down, audit, timeline, and RFI reconstruction. Transaction edge direction follows money or value flow; for POBO activity, the default flow edge starts from the ultimate debtor and keeps the servicing customer as transaction context.

Association name edges use `SAME_BUSINESS_NAME` instead of `SAME_ENTITY_NAME` for shared company, merchant, sole-proprietor, or other business-name strings. `SAME_BUSINESS_NAME` is limited to business-name fields such as company customer names and enterprise realname names. Legal-person names remain person-name evidence, account holder names should use account-holder name evidence, and buyer/seller names should use trade-party name evidence.

Transaction counterparty-name evidence belongs to Transaction Flow Analysis, not the default shared-attribute association graph. It may be strong transaction evidence when attached to transaction context, but it should not be represented as a strong shared-name association edge.
