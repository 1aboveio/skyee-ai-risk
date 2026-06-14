# PRD: Application Locale I18n

## Problem Statement

The Skyee AI Risk frontend currently has mixed language behavior. The Graph Network Search module contains a local English/Simplified Chinese toggle, while the shared shell, homepage, Customer Risk Review Workbench, auth error page, and review evidence surfaces are still English-only. This makes the reviewer experience inconsistent and prevents signed-in reviewers from keeping a stable language preference across modules.

Risk reviewers need a global Application Locale that applies to product UI across the whole frontend, with English and Simplified Chinese support. The locale must be reviewer-facing only: source evidence values remain audit material and must not be translated or rewritten.

## Solution

Add global i18n support for English (`en`) and Simplified Chinese (`zh-CN`) across the current frontend. The language switch appears as a compact dropdown/menu in the top header and applies immediately without a full page reload.

The Application Locale is a signed-in reviewer preference. Store it in the Review Store keyed to reviewer identity. On signed-in pages, resolve the initial locale server-side from the stored reviewer preference. If no preference exists, detect browser language; any Chinese primary language maps to `zh-CN`, English maps to `en`, and unsupported or unavailable detection falls back to `zh-CN`.

Auth error pages can appear before a trusted signed-in reviewer identity exists. They should still be localized, but they use browser detection/fallback only and must not persist a reviewer preference.

The locale changes product UI labels, navigation, controls, table headings, empty states, fixed enum labels, and user-facing error text. It does not translate source evidence values, customer names, raw risk-signal text, transaction descriptions, reviewer notes, or saved Review Evidence Snapshot contents.

## User Stories

1. As a signed-in reviewer, I want one language setting across the whole app, so that I do not need to switch language separately per module.
2. As a signed-in reviewer, I want the app to remember my language preference, so that future sessions open in the same language.
3. As a signed-in reviewer, I want the first page render to use my stored language preference, so that the UI does not visibly switch after hydration.
4. As a first-time reviewer with no saved preference, I want the app to detect my browser language, so that the initial language is likely correct.
5. As a first-time reviewer with unsupported browser language, I want the app to default to Simplified Chinese, so that the fallback matches the expected primary operating language.
6. As a reviewer using a Chinese browser locale such as `zh`, `zh-CN`, `zh-Hans`, `zh-HK`, or `zh-TW`, I want the UI to resolve to `zh-CN`, so that Chinese users get the supported Chinese interface.
7. As a reviewer using an English browser locale, I want the UI to resolve to `en`, so that English users get the supported English interface.
8. As a reviewer, I want a compact language dropdown/menu in the top header, so that I can change language without leaving the current workflow.
9. As a reviewer, I want language changes to apply immediately without a full page reload, so that ongoing review context is not disrupted.
10. As a reviewer, I want the app to keep my selected language for the current session even if preference persistence fails, so that a temporary backend issue does not undo my UI choice.
11. As a reviewer, I want a small non-blocking error if language preference persistence fails, so that I know the change may not survive a later reload.
12. As a reviewer, I want the homepage, sidebar, and shared navigation localized, so that module discovery is consistent.
13. As a reviewer, I want Graph Network Search localized through the global locale, so that the old graph-only language toggle is no longer isolated.
14. As a reviewer, I want the Customer Risk Review Workbench entry page localized, so that customer search and review setup are consistent.
15. As a reviewer, I want customer-specific review workbench panels localized, so that evidence review, transactions, actions, and errors are understandable.
16. As a reviewer, I want the transaction list headings and filter labels localized, so that reviewing transaction evidence works in either supported language.
17. As a reviewer, I want auth error pages localized, so that permission and login failures are understandable even before I reach the signed-in app.
18. As a risk reviewer, I want source evidence values to remain unchanged, so that audit material is not altered by UI language.
19. As an auditor, I want Review Evidence Snapshot contents to remain as captured, so that later language changes do not rewrite historical evidence.
20. As an engineer, I want both locale dictionaries to have the same message keys, so that missing translations are caught before release.

## Implementation Decisions

- Support exactly two locales for v1: `en` and `zh-CN`.
- Treat `zh-CN` as the default fallback locale when no stored preference exists and browser detection does not resolve to a supported locale.
- Map any Chinese primary browser language to `zh-CN`.
- Map English browser languages to `en`.
- Store signed-in reviewer locale preference in the Review Store, not in the identity provider.
- Key the preference by signed-in reviewer identity.
- Resolve signed-in page initial locale server-side using stored reviewer preference first, then browser detection, then `zh-CN` fallback.
- Localize auth error pages using browser detection/fallback only; do not write reviewer preference from auth error pages.
- Add a compact language dropdown/menu to the top header.
- Apply language switch immediately in the client without a full page reload.
- Persist language changes to the Review Store in the background.
- If persistence fails, keep the client UI in the selected language for the current session and show a small non-blocking error.
- Move Graph Network Search off its local language state and onto the global Application Locale.
- Translate product UI across the current frontend: app shell, homepage, Graph Network Search, Customer Risk Review Workbench entry, customer-specific workbench panels, auth error page, buttons, empty states, errors, table headings, and fixed enum labels.
- Do not translate source evidence values, customer names, raw risk-signal text, transaction descriptions, reviewer notes, or saved Review Evidence Snapshot contents.
- Keep i18n UI-only for v1; do not localize backend data, database values, or evidence snapshots.

## Testing Decisions

- Add locale resolver tests covering stored preference precedence, browser language detection, Chinese variant mapping, English mapping, unsupported language fallback, and absent-language fallback.
- Add Review Store tests for reading and updating reviewer locale preference keyed by reviewer identity.
- Add dictionary coverage tests ensuring `en` and `zh-CN` expose the same message keys.
- Add component or integration tests for the top-header language dropdown/menu.
- Add tests proving language switch updates visible UI immediately without a full page reload.
- Add tests proving a failed persistence call keeps the selected UI locale for the current session and shows a non-blocking error.
- Add signed-in rendering tests proving initial locale comes from stored reviewer preference before hydration.
- Add auth error page tests proving it localizes from browser detection/fallback and does not persist reviewer preference.
- Add Graph Network Search tests proving it uses global Application Locale rather than module-local language state.
- Add Customer Risk Review Workbench tests covering localized headings, controls, empty states, transaction table headings, and decision controls.
- Add negative assertions where practical that source evidence values, reviewer notes, transaction descriptions, and snapshot contents are not translated by the UI layer.

## Out of Scope

- Adding languages beyond English and Simplified Chinese.
- Translating source evidence values, customer names, raw risk-signal text, transaction descriptions, reviewer notes, or Review Evidence Snapshot contents.
- Storing locale preference in the identity provider.
- Per-module language preferences.
- AI-generated translation of evidence or reviewer notes.
- Localizing exported reports or downstream external systems.
- Full browser reload on language change.

## Further Notes

This PRD follows the Application Locale domain term and the accepted ADR for storing reviewer locale preference in the Review Store. The core boundary is that locale is a product UI preference, not an evidence transformation. Future implementation should keep translation dictionaries close enough to the UI to make missing keys visible during development while preserving server-side locale resolution for signed-in initial renders.
