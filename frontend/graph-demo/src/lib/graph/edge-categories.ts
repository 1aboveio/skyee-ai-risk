/**
 * Edge type categorization for the risk graph.
 *
 * Shared-attribute edges represent identity overlap (same phone, email, address, etc.)
 * between customers.  Transaction-flow edges (future) will represent actual payment or
 * counterparty relationships.
 *
 * Keeping these categories distinct is critical: shared-attribute proximity is a
 * different risk signal than transaction counterparties.
 */

export type EdgeCategory = "shared-attribute" | "transaction-flow" | "unknown";

/**
 * Transaction-flow prefixes.
 * Currently no transaction-flow edges exist in the data, but the taxonomy is
 * established here so future additions are categorised correctly.
 */
const TRANSACTION_FLOW_PREFIXES = ["TXN_", "PAYMENT_", "TRANSFER_", "COUNTERPARTY_"] as const;

/**
 * Classify an edge type string into its semantic category.
 *
 * - All `SAME_*` types are **shared-attribute** (identity overlap).
 * - `TXN_*`, `PAYMENT_*`, `TRANSFER_*`, `COUNTERPARTY_*` are **transaction-flow**.
 * - Everything else is **unknown** (should be investigated and assigned).
 */
export function categorizeEdgeType(edgeType: string): EdgeCategory {
  if (edgeType.startsWith("same_")) {
    return "shared-attribute";
  }

  if (edgeType.startsWith("SAME_")) {
    return "shared-attribute";
  }
  if (TRANSACTION_FLOW_PREFIXES.some((prefix) => edgeType.startsWith(prefix))) {
    return "transaction-flow";
  }
  return "unknown";
}

/**
 * Human-readable label for an edge category.
 */
export function edgeCategoryLabel(category: EdgeCategory): string {
  switch (category) {
    case "shared-attribute":
      return "Shared Attribute";
    case "transaction-flow":
      return "Transaction Flow";
    case "unknown":
      return "Uncategorized";
  }
}

/**
 * Badge variant for edge category display.
 */
export function edgeCategoryVariant(category: EdgeCategory): "default" | "secondary" | "outline" {
  switch (category) {
    case "shared-attribute":
      return "default";
    case "transaction-flow":
      return "secondary";
    case "unknown":
      return "outline";
  }
}
