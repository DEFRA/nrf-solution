#!/usr/bin/env node
// Usage: node comments.mjs TICKET [format]
// Formats: list (default), json, count

const [ticket, format = 'list'] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net'

function fail(msg) { console.error(msg); process.exit(1) }

if (!ticket) fail('Usage: node comments.mjs TICKET [format]\nFormats: list (default), json, count')
if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const res = await fetch(`${BASE}/rest/api/2/issue/${ticket}?fields=comment`, {
  headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
})
const data = await res.json()

if (data.errorMessages?.length) fail(data.errorMessages.join('\n'))

const comments = data.fields.comment.comments

switch (format) {
  case 'json':
    console.log(JSON.stringify(comments, null, 2))
    break
  case 'count':
    console.log(comments.length)
    break
  default:
    if (!comments.length) { console.log(`No comments on ${ticket}`); break }
    console.log(`=== Comments on ${ticket} (${comments.length}) ===`)
    for (const c of comments) {
      console.log(`--- ${c.author.displayName} (${c.created.split('T')[0]}) ---`)
      console.log(c.body)
      console.log()
    }
}
