#!/usr/bin/env node
// Usage: node add-comment.mjs TICKET "comment text"
//        echo "comment" | node add-comment.mjs TICKET -
//        node add-comment.mjs TICKET -f comment.txt
// Add --replace-prefix "text" to replace your existing comment(s) starting with that text
// (updates the newest, deletes older duplicates) instead of adding a new one.

const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString().trim()
}

const args = process.argv.slice(2)
let ticket = '', comment = '', fromFile = '', fromStdin = false, replacePrefix = ''

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-f': case '--file': fromFile = args[++i]; break
    case '-':                 fromStdin = true; break
    case '--replace-prefix':  replacePrefix = args[++i]; break
    case '-h': case '--help':
      console.log('Usage: node add-comment.mjs TICKET "comment"\n       echo "comment" | node add-comment.mjs TICKET -\n       node add-comment.mjs TICKET -f comment.txt')
      process.exit(0)
    default:
      if (!ticket) ticket = args[i]
      else if (!comment) comment = args[i]
  }
}

if (!ticket) fail('Error: Ticket ID required')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

if (fromFile) {
  const { readFileSync } = await import('node:fs')
  comment = readFileSync(fromFile, 'utf8').trim()
} else if (fromStdin) {
  comment = await readStdin()
}

if (!comment) fail('Error: Comment text required')

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }
const commentUrl = `${BASE}/rest/api/2/issue/${ticket}/comment`

if (replacePrefix) {
  const me = await (await fetch(`${BASE}/rest/api/2/myself`, { headers })).json()
  const list = await (await fetch(commentUrl, { headers })).json()
  const mine = (list.comments ?? [])
    .filter(c => c.author?.accountId === me.accountId && c.body.startsWith(replacePrefix))
    .sort((a, b) => b.created.localeCompare(a.created))
  if (mine.length) {
    const [newest, ...older] = mine
    const upd = await fetch(`${commentUrl}/${newest.id}`, { method: 'PUT', headers, body: JSON.stringify({ body: comment }) })
    if (!upd.ok) fail(`Error: Failed to update comment (HTTP ${upd.status})`)
    for (const c of older) {
      const del = await fetch(`${commentUrl}/${c.id}`, { method: 'DELETE', headers })
      if (!del.ok) fail(`Error: Failed to delete older comment ${c.id} (HTTP ${del.status})`)
    }
    console.log(`Comment ${newest.id} on ${ticket} replaced (${older.length} older removed)`)
    console.log(`URL: ${BASE}/browse/${ticket}?focusedCommentId=${newest.id}`)
    process.exit(0)
  }
}

const res = await fetch(commentUrl, { method: 'POST', headers, body: JSON.stringify({ body: comment }) })
const data = await res.json()

if (res.ok) {
  console.log(`Comment added to ${ticket} (comment ID: ${data.id})`)
  console.log(`URL: ${BASE}/browse/${ticket}?focusedCommentId=${data.id}`)
} else {
  fail(`Error: Failed to add comment (HTTP ${res.status})\n${data.errorMessages?.join('\n') ?? JSON.stringify(data)}`)
}
