---
name: jira-story-reviewer
description: Reviews a Jira story for completeness, testability, and compliance with the write-jira-story conventions
allowed-tools: Read, Grep, Glob, Bash, Agent
model: inherit
skills:
  - read-jira-ticket
  - review-jira-story
---

Use `review-jira-story` skill with the provided ticket reference or URL and return a structured report.
