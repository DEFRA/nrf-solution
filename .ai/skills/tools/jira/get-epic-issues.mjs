#!/usr/bin/env node
// Usage: node get-epic-issues.mjs EPIC_KEY [format]
// Formats: list (default), summary, json

const [epicKey, format = 'list'] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

if (!epicKey) fail('Usage: node get-epic-issues.mjs EPIC_KEY [format]\nFormats: list (default), summary, json')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, Accept: 'application/json' }

const allIssues = []
let startAt = 0

while (true) {
  const res = await fetch(`${BASE}/rest/agile/1.0/epic/${epicKey}/issue?startAt=${startAt}&maxResults=100`, { headers })
  const data = await res.json()

  if (data.errorMessages?.length) fail(data.errorMessages.join('\n'))

  allIssues.push(...data.issues)
  startAt += data.issues.length

  if (startAt >= data.total || data.issues.length === 0) break
  process.stderr.write(`Fetched ${startAt} of ${data.total} issues...\n`)
}

switch (format) {
  case 'json':
    console.log(JSON.stringify({ issues: allIssues, total: allIssues.length }, null, 2))
    break
  case 'summary':
    for (const issue of allIssues) {
      console.log(JSON.stringify({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        type: issue.fields.issuetype.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
        labels: issue.fields.labels
      }, null, 2))
    }
    break
  default:
    console.log(`=== Issues in Epic ${epicKey} ===`)
    for (const issue of allIssues) {
      console.log(`${issue.key.padEnd(12)} ${issue.fields.status.name.padEnd(15)} ${issue.fields.issuetype.name.padEnd(10)} ${issue.fields.summary}`)
    }
    console.log(`\nTotal: ${allIssues.length} issues`)
}
