# AI agent tools

## Setup / pre-requisites

The skills and rules are intended to be useable by multiple agents, so are in a .ai folder rather than only .claude or .copilot. There is currently a .claude folder that symlinks to the shared .ai folder, so that it picks up the skills.

Several skills access Jira; [set Atlassian credentials](./atlassian-credentials.md) before using.

## Skills / agents

### Generating pages / features
- [Feature builder agent](./feature-builder.md)
- [Quote journey page (reference)](./quote-journey-page.md)
- [Page from prototype](./page-from-prototype.md)

### Code review
- [Code reviewer agent & skill](./code-reviewer.md)

### Housekeeping
- [Update npm deps](./update-npm-deps.md)
- [Upgrade Docker images](./upgrade-docker-images.md)

### Testing
- [Test in browser](./test-in-browser.md)
- [Check accessibility](./check-accessibility.md)

### Documentation
- [Sync Swagger](./sync-swagger.md)
- [Generate DB diagram](./generate-db-diagram.md)
- [Screenshots](./screenshots.md)

## Rules

Used by agents (and human devs) to write code, tests, and to guide code review
- [Rules](../../.ai/rules/index.md)
