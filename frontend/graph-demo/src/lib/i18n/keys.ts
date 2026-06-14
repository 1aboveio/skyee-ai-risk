export const dictionaryKeys = [
  // Common shell keys
  "home",
  "graphNetworkSearch",
  "reviewWorkbench",
  "signOut",
  "saveSnapshot",
  "decision",
  "customerProfile",
  "riskSignals",
  "transactionSummary",
  "transactionList",
  "graphNetworkSearchTitle",

  // Graph Network Search keys (migrated from the local graph-demo.tsx dictionary)
  "accountBalance",
  "allTypes",
  "balanceUnavailable",
  "customerGraph",
  "customerId",
  "dataSource",
  "edgeTypes",
  "edges",
  "graph",
  "highRiskNeighbors",
  "includeWeak",
  "language",
  "lastSeen",
  "link",
  "linkType",
  "linkTypes",
  "noMatches",
  "nodes",
  "records",
  "relationshipSearch",
  "relationshipView",
  "risk",
  "search",
  "searchFailed",
  "selected",
  "strength",
  "strong",
  "suspend",
  "suspendMocked",
  "table",
  "weak",
  "weakIncluded",
  "strongOnly",
  "warnings",
] as const;

export type DictionaryKey = (typeof dictionaryKeys)[number];

export function defineDictionary(dict: Record<DictionaryKey, string>) {
  return dict;
}
