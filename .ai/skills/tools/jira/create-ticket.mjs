#!/usr/bin/env node
// Usage: node create-ticket.mjs -s "summary" [-d "description"|"-"] [-t type] [-P priority] [-l labels] [--parent KEY] [--sprint NAME]

const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString().trim()
}

const args = process.argv.slice(2)
let project = 'NRF2', summary = '', description = '', type = 'Story', priority = '', labels = '', parent = '', sprint = ''

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-p': case '--project':     project = args[++i]; break
    case '-s': case '--summary':     summary = args[++i]; break
    case '-d': case '--description': description = args[++i]; break
    case '-t': case '--type':        type = args[++i]; break
    case '-P': case '--priority':    priority = args[++i]; break
    case '-l': case '--labels':      labels = args[++i]; break
    case '--parent':                 parent = args[++i]; break
    case '--sprint':                 sprint = args[++i]; break
    case '-h': case '--help':
      console.log('Usage: node create-ticket.mjs -s "summary" [-d "description"] [-t type] [-P priority] [-l labels] [--parent KEY] [--sprint NAME]')
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

async function findSprintId(name) {
  const boards = await (await fetch(`${BASE}/rest/agile/1.0/board?projectKeyOrId=${project}`, { headers })).json()
  for (const board of boards.values ?? []) {
    let startAt = 0
    for (;;) {
      const page = await (await fetch(`${BASE}/rest/agile/1.0/board/${board.id}/sprint?state=active,future&startAt=${startAt}`, { headers })).json()
      const match = (page.values ?? []).find(s => s.name === name)
      if (match) return match.id
      if (page.isLast !== false || !page.values?.length) break
      startAt += page.values.length
    }
  }
  return null
}

if (res.status === 201) {
  console.log(`Created: ${data.key}`)
  console.log(`URL: ${BASE}/browse/${data.key}`)
  if (sprint) {
    const sprintId = await findSprintId(sprint)
    if (!sprintId) fail(`Error: ticket created, but no active or future sprint named '${sprint}' was found for ${project}`)
    const sprintRes = await fetch(`${BASE}/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ issues: [data.key] })
    })
    if (!sprintRes.ok) fail(`Error: ticket created, but adding it to sprint '${sprint}' failed (HTTP ${sprintRes.status}): ${await sprintRes.text()}`)
    console.log(`Sprint: ${sprint}`)
  }
} else {
  const msg = data.errorMessages?.join('\n') ?? JSON.stringify(data.errors ?? data)
  fail(`Error creating ticket (HTTP ${res.status}):\n${msg}`)
}
