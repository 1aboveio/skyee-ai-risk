# Test Criteria: Application Locale I18n

## Source
- Input: `docs/prd/application-locale-i18n.md`
- Version/date: 2026-06-14
- Author/owner: product/1aboveio

## Scope
- In scope: Global `en` / `zh-CN` locale support for reviewer-facing UI in the Skyee AI Risk frontend; server-side initial locale resolution for signed-in pages; browser detection fallback; header language dropdown; immediate client-side locale switch; background persistence to Review Store; localization of shared shell, homepage, Graph Network Search, Customer Risk Review Workbench entry + customer-specific panels, auth error page, buttons, empty states, errors, table headings, and fixed enum labels.
- Out of scope: Additional languages; translation of source evidence values, customer names, raw risk-signal text, transaction descriptions, reviewer notes, or saved Review Evidence Snapshot contents; identity-provider locale storage; per-module language preferences; AI-generated translations; exported reports; full page reload on language change.
- Assumptions: The Graph Network Search page currently has a local `中文` toggle (see `frontend/graph-demo/src/app/graph/page.tsx` and related graph components); it will be migrated to the global locale. The Review Store already exists and can store key/value preferences keyed by reviewer identity. Next.js App Router is used throughout.
- Blockers: None.

## Acceptance Criteria
- AC1: A signed-in reviewer sees the initial page render in their stored locale preference, without a visible language switch after hydration.
- AC2: If no stored preference exists, the app detects the browser primary language; any Chinese primary language (`zh`, `zh-CN`, `zh-Hans`, `zh-HK`, `zh-TW`) resolves to `zh-CN`; English (`en`) resolves to `en`; unsupported or unavailable detection falls back to `zh-CN`.
- AC3: Auth error pages resolve locale from browser detection/fallback only and do not persist a reviewer preference.
- AC4: A compact language dropdown/menu appears in the top header on signed-in pages.
- AC5: Selecting a language from the header dropdown immediately updates all product UI labels on the current page without a full page reload.
- AC6: Language changes are persisted to the Review Store in the background keyed by the signed-in reviewer identity.
- AC7: If persistence fails, the selected language remains active for the current session and a small non-blocking error is shown.
- AC8: Source evidence values, customer names, raw risk-signal text, transaction descriptions, reviewer notes, and saved snapshot contents are never translated by the UI locale layer.
- AC9: The Graph Network Search page uses the global Application Locale and its old module-local toggle is removed.
- AC10: The `en` and `zh-CN` dictionaries expose exactly the same message keys, so missing translations are caught in CI.
- AC11: The homepage, app shell, sidebar navigation, auth error page, Graph Network Search, Customer Risk Review Workbench entry page, and customer-specific workbench panels display translated labels for the active locale.

## Critical User/System Journeys
- J1: First-time reviewer with `zh-CN` browser opens `/` signed-in → initial render is `zh-CN` (no flash).
- J2: Reviewer with stored `en` preference opens `/review/1017637037561025` → workbench panels render in English.
- J3: Reviewer on Graph Network Search changes language from header dropdown → graph controls/labels switch immediately.
- J4: Reviewer triggers an auth error (e.g. access_denied) → error page renders in browser-detected locale.
- J5: Persistence API returns 500 after language change → UI stays in selected language; non-blocking error appears.

## Test Matrix
| Scenario | AC/Journey | Test Level | Mock/Fake Policy | Setup/Input | Assertions | Required Evidence |
|---|---|---|---|---|---|---|
| Stored preference wins over browser | AC1 / J2 | Unit + Integration/API | Real DB for Review Store preference | reviewer with `en` stored pref, browser `zh-CN` | server returns `en` locale, page first render uses `en` | test log, server-rendered HTML snapshot |
| Browser Chinese variants map to zh-CN | AC2 | Unit | none (pure function) | `zh`, `zh-CN`, `zh-Hans`, `zh-HK`, `zh-TW` | all resolve to `zh-CN` | unit test log |
| Browser English maps to en | AC2 | Unit | none | `en`, `en-US`, `en-GB` | resolves to `en` | unit test log |
| Unsupported browser language falls back to zh-CN | AC2 | Unit | none | `fr`, `ja`, undefined | resolves to `zh-CN` | unit test log |
| Auth error page uses browser locale only | AC3 / J4 | Integration/API + UI | mock session missing | request with `Accept-Language: zh-CN` | page renders `zh-CN`, no DB preference read/write | test log, HTML snapshot |
| Header dropdown visible and functional | AC4 / AC5 / J3 | UI E2E | real app server + fake persistence optional | signed-in reviewer on `/graph` | dropdown opens, selection changes visible label text without reload | E2E log, screenshot |
| Locale change persists in background | AC6 | Integration/API | real DB | reviewer selects `en` from dropdown | Review Store preference updated to `en` keyed by reviewer | test log, DB assertion |
| Failed persistence keeps session locale and shows error | AC7 / J5 | Integration/API + UI | mock persistence to fail | reviewer selects `en`, persistence 500 | UI stays `en`; non-blocking error visible | test log, screenshot |
| Evidence values not translated | AC8 | UI E2E | real app server | customer `1017637037561025` in `zh-CN` locale | customer name, transaction descriptions, risk signals remain unchanged | E2E log, screenshot |
| Graph uses global locale | AC9 | UI E2E | real app server | reviewer toggles locale via header on `/graph` | graph labels switch; old module toggle absent | E2E log, screenshot |
| Dictionary key parity | AC10 | Unit | none | `en.json`, `zh-CN.json` | key sets are identical | unit test log |
| Core surfaces localized | AC11 | UI E2E + snapshot | real app server | `/`, `/graph`, `/review`, `/review/:id` in both locales | key labels translated in both locales | E2E log, screenshots |

## Mock And Integration Policy
- Mock acceptable: pure locale resolution logic; external/provider failures for persistence; asserting persistence is not called on auth error pages.
- Integration required: Review Store preference read/write; server-side locale resolution on real request path; DB state transitions for persistence.
- External dependency strategy: no live third-party calls in tests.
- Mock-only exceptions: N/A for stateful workflows; persistence failure path may use a fake/failing store adapter but the happy path must exercise real DB.

## Required Automated Tests
- Unit: `resolveLocale(preference, acceptLanguage)` covering AC2 edge cases; dictionary key parity; locale matcher utilities.
- Integration/API: `GET/POST /api/locale/preference` read/update with real DB; server-rendered pages return correct `lang` attribute and initial locale in HTML.
- UI E2E: header dropdown switches language; graph page uses global locale; workbench panels render translated labels; auth error page renders in detected locale.
- Journey E2E: sign in → change language → navigate to Graph and Workbench → verify consistent locale.

## Coverage Mapping
| Requirement/Journey | ACs | Test Case/File | Status |
|---|---|---|---|
| Locale resolver | AC1, AC2 | `lib/locale/resolve-locale.test.ts` | Required |
| Dictionary parity | AC10 | `lib/locale/dictionaries.test.ts` | Required |
| Preference API | AC6, AC7 | `app/api/locale/preference/route.test.ts` | Required |
| Server-side initial locale | AC1, AC3 | `app/page.test.tsx` (SSR HTML) | Required |
| Header locale menu | AC4, AC5 | `e2e/locale/header-locale.spec.ts` | Required |
| Graph global locale | AC9 | `e2e/locale/graph-locale.spec.ts` | Required |
| Workbench localization | AC11 | `e2e/locale/workbench-locale.spec.ts` | Required |
| Auth error localization | AC3 | `e2e/locale/auth-error-locale.spec.ts` | Required |
| Evidence non-translation | AC8 | `e2e/locale/evidence-not-translated.spec.ts` | Required |

## Surface Census (Audit Mode Only — every surface, not just the gaps)
| Surface | kind/class | Required level | Status | Proving test (or — ) |
|---|---|---|---|---|
| / | route/render | browser-journey + presentation | Required | e2e/locale/home-locale.spec.ts |
| /graph | route/render | browser-journey + presentation | Required | e2e/locale/graph-locale.spec.ts |
| /review | route/render | browser-journey + presentation | Required | e2e/locale/workbench-locale.spec.ts |
| /review/[custId] | route/render | browser-journey + presentation | Required | e2e/locale/workbench-locale.spec.ts |
| /auth/error | route/render | browser-journey + presentation | Required | e2e/locale/auth-error-locale.spec.ts |
| /api/locale/preference | api/mutation | api + integration | Required | app/api/locale/preference/route.test.ts |
| Header locale menu | component | UI E2E / component | Required | e2e/locale/header-locale.spec.ts |

## Existing Coverage Assessment (Audit Mode Only)
- Production-readiness verdict: N/A (create-mode criteria document).

## Test Skipping
- Skipped tests: None.

## Behavior-First Validation
- ACs describe externally observable behavior, not private functions.
- Test matrix scenarios validate outcomes, durable state, contracts, side effects, permissions, and failure behavior.
- Unit tests are scoped to public behavior, pure decision logic, or stable public contracts.
- Mock-only coverage does not bypass the core behavior under test.
- Existing coverage claims were verified against actual test code, not trusted from prior docs/reports.
- Route discovery and reachability analysis were performed before E2E audit, if applicable.
- Production-readiness verdict is stated as an explicit ship/no-ship call with named first-week bug-report scenarios, not a vibe.
- Status: PASS / FAIL / BLOCKED
- Required revisions before approval: <None or list>

## Reviewer Checklist
- Obligation impact stated: which obligations/surfaces this change touches, their `requirementRefs`, and the evidence that proves each.
- No `Orphan surface` introduced: every changed/new surface is referenced by at least one requirement and has a Coverage Ledger row.
- Every changed/new page with a write form has a mutation-form journey test that fills the real UI and asserts the backend accepts the submission; split-contract forms (fields and validator from different sources) are not signed off on seam tests alone.
- Every AC maps to an automated test or approved exception.
- Tests assert behavior/state, not implementation details only.
- No tests are skipped/weakened to make CI pass.
- Every skipped test has an allowed category, evidence/blocker link, and replacement verification.
- Substitutes appear only at external trust boundaries; no internal seam (DB, service layer, internal endpoint, event bus) is mocked.
- Fakes/stubs are used to keep failure-path and edge cases fast and deterministic, and tests never call a live third party in CI — both are good.
- Mocks/fakes do not bypass the core behavior being validated.
- Mock-only coverage is rejected for stateful workflow, money movement, auth, idempotency, concurrency, event/outbox, or orchestrator recovery unless explicitly approved; money movement, auth, and idempotency can never be mock-only even with approval.
- Failure, retry, duplicate, permission, and concurrency cases are covered where relevant.
- Test evidence is attached: CI link, command output, logs, screenshots, or traces.

## Blocking Decisions
- Decision: Should the locale preference API be `/api/locale/preference` (new route) or folded into an existing reviewer preference endpoint? · Why it blocks: determines surface census and route tests. · If new route → add `/api/locale/preference` GET/POST. · If existing → criteria/tests update to match. Default if no answer: new route `/api/locale/preference` (RESTful and aligned with storing a reviewer preference in Review Store).
