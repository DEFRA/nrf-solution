#!/usr/bin/env node
// Usage: node create-ticket.mjs -s "summary" [-d "description"|"-"] [-t type] [-P priority] [-l labels] [--parent KEY]

const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString().trim()
}

const args = process.argv.slice(2)
let project = 'NRF2', summary = '', description = '', type = 'Story', priority = '', labels = '', parent = ''

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-p': case '--project':     project = args[++i]; break
    case '-s': case '--summary':     summary = args[++i]; break
    case '-d': case '--description': description = args[++i]; break
    case '-t': case '--type':        type = args[++i]; break
    case '-P': case '--priority':    priority = args[++i]; break
    case '-l': case '--labels':      labels = args[++i]; break
    case '--parent':                 parent = args[++i]; break
    case '-h': case '--help':
      console.log('Usage: node create-ticket.mjs -s "summary" [-d "description"] [-t type] [-P priority] [-l labels] [--parent KEY]')
      process.exit(0)
    default:
      fail(`Unknown option: ${args[i]}`)
  }
}

if (!summary) fail('Error: --summary is required')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

if (description === '-') description = await readStdin()

if (priority && !['Lowest', 'Low', 'Medium', 'High', 'Highest'].includes(priority)) {
  fail(`Error: Invalid priority '${priority}'. Must be Lowest, Low, Medium, High, or Highest`)
}

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }

const fields = { project: { key: project }, summary, issuetype: { name: type } }
if (description) fields.description = description
if (priority) fields.priority = { name: priority }
if (labels) fields.labels = labels.split(',').map(l => l.trim())
if (parent) fields.parent = { key: parent }

const res = await fetch(`${BASE}/rest/api/2/issue`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ fields })
})
const data = await res.json()

if (res.status === 201) {
  console.log(`Created: ${data.key}`)
  console.log(`URL: ${BASE}/browse/${data.key}`)
} else {
  const msg = data.errorMessages?.join('\n') ?? JSON.stringify(data.errors ?? data)
  fail(`Error creating ticket (HTTP ${res.status}):\n${msg}`)
}
