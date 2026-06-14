import { defineDictionary } from "./keys";

export const en = defineDictionary({
  // Common shell
  home: "Home",
  graphNetworkSearch: "Graph Network Search",
  reviewWorkbench: "Review Workbench",
  signOut: "Sign out",
  saveSnapshot: "Save Snapshot",
  decision: "Decision",
  customerProfile: "Customer Profile",
  riskSignals: "Risk Signals",
  transactionSummary: "Transaction Summary",
  transactionList: "Transaction List",
  graphNetworkSearchTitle: "Graph Network Search",

  // Shell layout
  operationsConsole: "Operations Console",
  primaryNavigation: "Primary",
  moduleNavigation: "Module navigation",
  signedIn: "Signed in",
  currentLanguage: "Current language",
  changeLanguage: "Change language",
  active: "Active",
  failedToSaveLanguagePreference: "Failed to save language preference.",
  english: "English",
  simplifiedChinese: "简体中文",

  // Homepage
  riskOperations: "Risk Operations",
  customerRiskReviewConsole: "Customer Risk Review Console",
  homeHeroDescription:
    "Start from customer identity, then move between graph evidence and human review without changing tools.",
  reviewer: "Reviewer",
  access: "Access",
  live: "Live",
  graphNetworkSearchDescription:
    "Search a customer and inspect relationship nodes, links, source fields, and high-risk neighbors.",
  reviewWorkbenchDescription:
    "Open a customer evidence package for human review, notes, snapshots, and final disposition.",
  openSearch: "Open search",
  evidenceBoundary: "Evidence Boundary",
  graphData: "Graph data",
  graphDataDescription: "Network search and relationship evidence.",
  sourceEvidence: "Source evidence",
  sourceEvidenceDescription: "Customer profile, risk signals, and transactions.",
  reviewStore: "Review store",
  reviewStoreDescription: "Notes, snapshots, review sessions, and disposition.",
  workflowPosition: "Workflow Position",
  prescreening: "Prescreening",
  secondRoundHumanReview: "Second round human review",
  adHocInvestigation: "Ad hoc investigation",

  // Auth error page
  authentication: "Authentication",
  authAccessDeniedTitle: "Access denied",
  authAccessDeniedBody:
    "Your identity is valid, but your account is not authorized for this Skyee AI Risk workspace.",
  authApplicationNotConfiguredTitle: "Application is not configured",
  authApplicationNotConfiguredBody:
    "The identity provider does not recognize this application client.",
  authLoginSessionExpiredTitle: "Login session expired",
  authLoginSessionExpiredBody:
    "The sign-in request could not be verified. Start a new login flow.",
  authTokenExchangeFailedTitle: "Login could not be completed",
  authTokenExchangeFailedBody:
    "The application could not exchange the identity authorization code.",
  authWrongOrganizationTitle: "Wrong organization",
  authWrongOrganizationBody:
    "The signed-in account belongs to a different organization.",
  authEmailDomainNotAllowedTitle: "Email domain not allowed",
  authEmailDomainNotAllowedBody:
    "Use an account from the configured Skyee email domain.",
  authUserProfileIncompleteTitle: "User profile incomplete",
  authUserProfileIncompleteBody:
    "The identity provider returned a user profile without the required account fields.",
  authLoginFailedTitle: "Login failed",
  authLoginFailedBody:
    "The identity provider returned an authentication error.",
  loginWithAnotherAccount: "Login with another account",

  // Graph Network Search
  accountBalance: "Account balance",
  allTypes: "All link types",
  balanceUnavailable: "Unavailable",
  customerGraph: "Customer Graph",
  customerId: "Customer ID",
  dataSource: "Data source",
  edgeTypes: "Edge Types",
  edges: "Edges",
  graph: "Graph",
  highRiskNeighbors: "High-Risk Neighbors",
  includeWeak: "Weak links",
  language: "中文",
  lastSeen: "Last seen",
  link: "Link",
  linkType: "Link type",
  linkTypes: "Link types",
  noMatches: "No matches",
  nodes: "Nodes",
  records: "Records",
  relationshipSearch: "Relationship search",
  relationshipView: "Relationship View",
  risk: "Risk",
  search: "Search",
  searchFailed: "Search failed",
  selected: "selected",
  strength: "Strength",
  strong: "Strong",
  suspend: "Suspend",
  suspendMocked: "Mock suspend queued",
  table: "Table",
  weak: "Weak",
  weakIncluded: "Weak links included",
  strongOnly: "Strong links only",
  warnings: "Warnings",
});
