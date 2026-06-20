# System patterns

## Secondary navigation (arc)

- **Component:** `NavSecondaryCarousel` (+ geometry module)
- **Spec:** `docs/04-operations/dev/nav-secondary-carousel.md`
- **Context:** `PageSecondaryNavContext` — pages register config via `usePageSecondaryNav`
- **Shell:** `MobileNav` renders arc or strip; FAB when `config.fab` set
- **Pages:** Home (text tabs), Study, Market (icon+label loop)

## Agent workflow

- Project rules: `docs/04-operations/dev/AGENTS.md`
- Cursor rules: `.cursor/rules/levela-project.mdc`
- Post-dev gate: `npm run verify:post-dev`
