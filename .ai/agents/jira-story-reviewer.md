---
name: jira-story-reviewer
description: Reviews a Jira story for completeness, testability, and compliance with the jira-story-writer conventions
tools: Read, Grep, Glob, Bash, Agent
model: inherit
skills:
  - read-jira-ticket
  - jira-story-reviewer
---

Use `jira-story-reviewer` with the provided ticket reference or URL and return the structured report.
