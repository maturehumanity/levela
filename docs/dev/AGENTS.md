# AGENTS Notes

This file stores project-specific notes for future AI agent work.

## 1. Front Card Layout Preservation

- Treat the user-approved `/settings/profile` World Citizen front card layout as a fixed baseline unless the user explicitly asks to restructure it.
- Do not move existing front-card elements between layers, parent groups, or rows while implementing a small feature.
- For category-related work, only change the category-related element itself and the minimum supporting storage/admin wiring required.
- Before changing anything on the front card, inspect the current JSX and preserve:
  - parent-child relationships used by Build mode
  - existing `data-build-key` targets
  - existing spacing/alignment of non-category elements
- If a requested feature could affect layout structure, stop and isolate the change behind the smallest possible insertion point instead of refactoring the card.
- After any front-card change, verify that:
  - `ID Number`, `Given Name`, `Surname`, `Place of Birth`, `Date of Birth`, `Sex`, `Card Expires`, `Member Since`, and footer arrows remain in their existing visual structure
  - no duplicate or hidden replacement build targets were introduced
  - Build mode still maps the same visible element to the same intended layer

## 2. Repository File Hygiene

- Do not create new top-level or unrelated files in the repository unless they are clearly necessary for the requested task.
- Do not create stray tool/agent folders or files such as `.codex` inside the project unless there is a clear, user-requested purpose for them.
- Before creating any new file, prefer:
  - reusing an existing project file
  - placing notes/docs in `docs/dev/` instead of the repo root
  - keeping temporary or tool-specific artifacts out of the project tree whenever possible
- If a new file is genuinely needed, choose the narrowest, most appropriate location and keep its purpose directly tied to the user’s request.

## 3. Persistent User Directives

- When the user gives recursive or standing instructions using phrases such as `Always`, `Never`, `make sure`, `don't`, `keep`, `preserve`, or similar strong directive language, treat them as persistent project rules, not one-off comments.
- Capture those instructions in context and continue following them across later requests unless the user explicitly changes or cancels them.
- Before making a change, check whether it conflicts with any previously stated standing instruction from the user.
- If a new request appears to conflict with an older standing instruction, pause and resolve that conflict narrowly instead of silently overriding the older rule.
- Especially preserve standing instructions about:
  - layout stability
  - keeping specific screens or components as the baseline
  - avoiding unrelated files or side effects
  - limiting scope to the exact requested area
- Never make unrequested changes. If a requested feature needs adjacent adjustments, keep them minimal and directly necessary, and say so clearly.
- Never use code-like or translation-key-like text on user-facing screens. Replace it with short, human-friendly labels that clearly describe the element.
- Never place one visible element on top of another unless overlap is part of the element's intended design or the user explicitly asks for it.
- Make sure all user-visible assets and editable elements on every page are explicitly registered in Build mode and Layers, labeled in user-friendly language, and nested in the correct parent order so they can be selected and edited reliably.
- In Build mode, clicking a visible asset should select it without triggering its normal app interaction first, and the current selection should be shown in both the Build panel and the Layers panel.
- When an element is selected in Build mode, make sure the Layers tree auto-expands the relevant parent chain and visibly highlights and scrolls to that selected item.
- When tightening Build mode / Layers coverage on a page, audit earlier existing elements on that same page too, not just newly added elements, so older text/value nodes do not get left behind as group-only targets.
- Do not wait for the user to name missed sub-elements one by one. When a composite field is touched, audit and register its obvious inner parts in the same pass.
- Proactively enforce all standing instructions and notes in this file on future work. Do not wait for the user to repeat them when they clearly apply.
