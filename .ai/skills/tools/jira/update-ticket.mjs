#!/usr/bin/env node
// Usage: node update-ticket.mjs TICKET [-s summary] [-d "description"|"-"] [-P priority] [-l labels] [--add-label LABEL]

const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString().trim()
}

const args = process.argv.slice(2)
let ticket = '', summary = '', description = '', priority = '', labels = ''
const addLabels = []

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-s': case '--summary':     summary = args[++i]; break
    case '-d': case '--description': description = args[++i]; break
    case '-P': case '--priority':    priority = args[++i]; break
    case '-l': case '--labels':      labels = args[++i]; break
    case '--add-label':              addLabels.push(args[++i]); break
    case '-h': case '--help':
      console.log('Usage: node update-ticket.mjs TICKET [-s summary] [-d description] [-P priority] [-l labels] [--add-label LABEL]')
      process.exit(0)
    default:
      if (!ticket && /^[A-Z][A-Z0-9]*-\d+$/.test(args[i])) ticket = args[i]
      else fail(`Unknown option: ${args[i]}`)
  }
}

if (!ticket) fail('Error: Ticket key is required')
if (!summary && !description && !priority && !labels && !addLabels.length) fail('Error: Nothing to update. Provide at least one option.')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

if (priority && !['Lowest', 'Low', 'Medium', 'High', 'Highest'].includes(priority)) {
  fail(`Error: Invalid priority '${priority}'. Must be Lowest, Low, Medium, High, or Highest`)
}

if (description === '-') description = await readStdin()

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }

const fields = {}
if (summary) fields.summary = summary
if (description) fields.description = description
if (priority) fields.priority = { name: priority }

if (labels) {
  fields.labels = labels.split(',').map(l => l.trim())
} else if (addLabels.length) {
  const existing = await fetch(`${BASE}/rest/api/2/issue/${ticket}?fields=labels`, { headers })
    .then(r => r.json())
    .then(d => d.fields?.labels ?? [])
  fields.labels = [...new Set([...existing, ...addLabels])]
}

const res = await fetch(`${BASE}/rest/api/2/issue/${ticket}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ fields })
})

if (res.status === 204 || res.status === 200) {
  console.log(`Updated: ${ticket}`)
  console.log(`URL: ${BASE}/browse/${ticket}`)
} else {
  const data = await res.json().catch(() => ({}))
  const msg = data.errorMessages?.join('\n') ?? JSON.stringify(data.errors ?? data)
  fail(`Error updating ticket (HTTP ${res.status}):\n${msg}`)
}
