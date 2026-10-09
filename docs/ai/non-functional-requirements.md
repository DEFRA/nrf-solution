# Non-functional requirements

The NFR catalogue lives in Confluence so the whole cross-disciplinary team can see and edit it, not just developers. The guidance **content** stays in Confluence (single source of truth, updates flow through automatically).

- **Guidance index (for humans / cache refresh):** https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6598723643/Guidance+for+page-level+development

**Cached category list** (keep in sync with the guidance index above — if you fetch the index and find it has diverged, update this list and mention it to the user):

| Category | Confluence page |
|---|---|
| Accessibility | https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6538166273/Page-level+accessibility+guidance |
| Security | https://eaflood.atlassian.net/wiki/spaces/NRFDT/pages/6598689168/Page-level+security+guidance |

Browser & device compatibility and Page load performance exist in the guidance index but are deliberately not listed as NFRs on any story, for any page type. Do not add them to the cached list or to a ticket.

## Page types

For a `question page` these NFRs apply:
- Accessibility
- Security

For a `dropout page` or `confirmation page` these NFRs apply (no form, so Security is not relevant):
- Accessibility
