#!/usr/bin/env node
// Usage: node add-comment.mjs TICKET "comment text"
//        echo "comment" | node add-comment.mjs TICKET -
//        node add-comment.mjs TICKET -f comment.txt

const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString().trim()
}

const args = process.argv.slice(2)
let ticket = '', comment = '', fromFile = '', fromStdin = false

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-f': case '--file': fromFile = args[++i]; break
    case '-':                 fromStdin = true; break
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
const res = await fetch(`${BASE}/rest/api/2/issue/${ticket}/comment`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ body: comment })
})
const data = await res.json()

if (res.ok) {
  console.log(`Comment added to ${ticket} (comment ID: ${data.id})`)
  console.log(`URL: ${BASE}/browse/${ticket}?focusedCommentId=${data.id}`)
} else {
  fail(`Error: Failed to add comment (HTTP ${res.status})\n${data.errorMessages?.join('\n') ?? JSON.stringify(data)}`)
}
