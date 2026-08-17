# Design instructions for agents

The canonical ECHO design specification is [`docs/design.md`](../docs/design.md).

## Product boundaries

- The homepage is the opportunity catalogue and each opportunity has a detail
  page.
- Do not add an About page or About navigation item unless explicitly requested.
- ECHO links to official consultation sources rather than storing documents.
- Opportunity details do not include contact information or a documents
  section.
- User dashboards and subscription flows are outside the current prototype.

These are implementation constraints rather than visual-design guidance. Keep
them here unless a future task explicitly changes the product scope.

## Workflow

Before implementing or reviewing any user-interface change:

1. Read the canonical design specification and the affected components.
2. Preserve its visual tokens, content hierarchy, responsive behavior,
   accessibility rules, and explicit product boundaries unless the task changes
   them.
3. If an approved change alters the design system or a documented interaction,
   update `docs/design.md` in the same change.
4. Treat the design as provisional until the document says stakeholder review
   is complete; do not independently reinterpret that status as approval to
   redesign the product.
