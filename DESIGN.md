# Design

## Source

This design system is derived from Skyee's English website: https://en.skyee360.com/.

Observed source signals:

- Primary action and interface blue: `#00A6FD`, used repeatedly in website CSS.
- Light sky gradient endpoint: `#78D2FF`.
- CTA yellow: `#FFC500`, with a related gradient from `#FFAE00` to `#FFD821`.
- Blue-gray text and controls: `#507390`.
- Light blue surface: `#F0F6FA`.
- Neutral page surface: `#F7F7F7`.
- Logo sampling from `logo-blue.png` confirms the brand blue family around `#10A0E0`.

## Visual Direction

Physical scene: a compliance and risk team reviews an architecture proposal on a bright office monitor during a customer workshop, with business stakeholders scanning scope, control boundaries, and delivery modules.

Design register: product documentation with brand alignment. The document should feel structured, trustworthy, and commercially clear, not decorative.

Color strategy: restrained product palette. Customer-owned modules stay neutral or existing-process colored. Skyee brand color is reserved for modules we add or operate.

## Color Tokens

Use OKLCH as the canonical design-token format. Hex values are included for compatibility with SVG and office-document workflows.

| Token | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| `--skyee-blue` | `oklch(69.7% 0.169 243.2)` | `#00A6FD` | Primary Skyee system capability, key arrows, active states |
| `--skyee-logo-blue` | `oklch(66.8% 0.142 236.6)` | `#10A0E0` | Brand reinforcement when primary blue needs a softer edge |
| `--skyee-sky` | `oklch(82.4% 0.107 231.8)` | `#78D2FF` | Light blue fills, secondary highlights |
| `--skyee-yellow` | `oklch(85.2% 0.174 87.0)` | `#FFC500` | Agent capability and CTA emphasis |
| `--skyee-bluegray` | `oklch(54.1% 0.061 244.2)` | `#507390` | Secondary text, muted labels, supporting strokes |
| `--skyee-mist` | `oklch(97.0% 0.008 236.6)` | `#F0F6FA` | System module fill, panels, diagram bands |
| `--skyee-page` | `oklch(97.6% 0.000 89.9)` | `#F7F7F7` | Page background and quiet separators |
| `--skyee-ink` | `oklch(32.1% 0.000 89.9)` | `#333333` | Body text when brand documents need stronger contrast |

## Diagram Scope Categories

For the architecture SVG:

- Customer-existing capabilities keep the neutral gray treatment and are shown only as context or integration targets.
- Business AI Workbench modules use the orange enhancement treatment. This is where operators, reviewers, risk managers, and strategy teams use AI in case investigation, review, disposition support, and feedback.
- Case Workflow System Platform modules use Skyee blue rounded modules. These carry intake, case pool, workflow, task queue, disposition flow, follow-up tasks, and audit writeback.
- Agent Engineering Platform modules use Skyee yellow cut-corner modules. These cover Coordinator, Executor, Connector, AgentSpec, Skills, Evaluation, permissions, release governance, and technical monitoring.
- Black `F/A/W` tags identify concrete project scope items by delivery category: `F` for Case Workflow System Platform, `A` for Agent Engineering Platform, and `W` for Business AI Workbench. Do not tag customer-existing intake objects that are only integrated, such as KYC, transaction rule alerts, field checks, internal triggers, or external triggers.

Do not recolor customer original modules when applying brand colors. Brand color should clarify our delivery scope, not overwrite the customer's operating model.

Scope categories:

| Category | Users | Visual treatment |
| --- | --- | --- |
| Customer-existing capability | Upstream or existing customer process | Gray rectangle |
| Business AI Workbench | Operators, reviewers, risk managers, strategy teams | Orange rectangle |
| Case Workflow System Platform | Workflow/process administrators, downstream systems | Skyee blue rounded module |
| Agent Engineering Platform | AI/platform/data/backend engineers, technical administrators | Skyee yellow cut-corner module |

## Typography

Use system sans-serif for diagrams and architecture documents:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
```

Keep headings bold and compact. Keep diagram labels short enough to survive SVG export and document embedding.

## Shape And Layout

- Prefer clear bands, explicit arrows, and labeled scope marks over decorative containers.
- Use 8 to 12 px corner radius for modules.
- Avoid nested card styling in diagrams.
- Keep source groups and workflow boundaries visible with dashed outlines or muted strokes.

## Accessibility

- Do not rely on color alone: maintain labels in the legend and module titles.
- Use stroke contrast strong enough for projected meeting-room screens.
- Avoid saturated fills for large diagram areas; use saturated color mainly on borders and arrows.
