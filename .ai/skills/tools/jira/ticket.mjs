#!/usr/bin/env node
// Usage: node ticket.mjs TICKET [format]
// Formats: full (default), summary, json

const [ticket, format = 'full'] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

if (!ticket) fail('Usage: node ticket.mjs TICKET [format]\nFormats: full (default), summary, json')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const res = await fetch(`${BASE}/rest/api/2/issue/${ticket}?expand=renderedFields`, {
  headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
})
const data = await res.json()

if (data.errorMessages?.length) fail(data.errorMessages.join('\n'))

const { fields, renderedFields } = data

switch (format) {
  case 'json':
    console.log(JSON.stringify(data, null, 2))
    break
  case 'summary':
    console.log(JSON.stringify({
      key: data.key,
      summary: fields.summary,
      status: fields.status.name,
      type: fields.issuetype.name,
      priority: fields.priority?.name,
      assignee: fields.assignee?.displayName,
      parent: fields.parent?.key,
      labels: fields.labels
    }, null, 2))
    break
  default:
    console.log(`=== ${ticket} ===`)
    console.log(`Type: ${fields.issuetype.name}`)
    console.log(`Status: ${fields.status.name}`)
    console.log(`Priority: ${fields.priority?.name}`)
    console.log(`Summary: ${fields.summary}`)
    console.log(`Assignee: ${fields.assignee?.displayName ?? 'Unassigned'}`)
    console.log(`Parent: ${fields.parent?.key ?? 'None'}`)
    console.log(`Labels: ${fields.labels?.join(', ') ?? ''}`)
    console.log('\n=== Description ===')
    console.log(renderedFields?.description ?? 'No description')

    if (fields.subtasks?.length) {
      console.log(`\n=== Subtasks (${fields.subtasks.length}) ===`)
      for (const s of fields.subtasks) {
        console.log(`${s.key.padEnd(12)} ${s.fields.status.name.padEnd(15)} ${s.fields.summary}`)
      }
    }

    if (fields.issuelinks?.length) {
      console.log(`\n=== Linked Issues (${fields.issuelinks.length}) ===`)
      for (const l of fields.issuelinks) {
        const issue = l.outwardIssue ?? l.inwardIssue
        const dir = l.outwardIssue ? l.type.outward : l.type.inward
        console.log(`${issue.key.padEnd(12)} ${dir.padEnd(20)} ${issue.fields.status.name.padEnd(15)} ${issue.fields.summary}`)
      }
    }
}
