#!/usr/bin/env node
// Usage: node add-comment.mjs PAGE_ID_OR_URL -   (comment body in Confluence storage format on stdin)
//        node add-comment.mjs PAGE_ID_OR_URL --parent COMMENT_ID -   (reply in a thread)

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const parentIdx = args.indexOf('--parent')
const parentId = parentIdx >= 0 ? args.splice(parentIdx, 2)[1] : undefined
const [input, bodyArg] = args
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input || bodyArg !== '-') fail('Usage: node add-comment.mjs PAGE_ID_OR_URL [--parent COMMENT_ID] -  (body on stdin)')

const pageId = /^https?:\/\//.test(input) ? input.match(/\/pages\/(\d+)/)?.[1] : input
if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)
if (parentId && !/^\d+$/.test(parentId)) fail(`Error: invalid parent comment ID: ${parentId}`)

const body = readFileSync(0, 'utf8').trim()
if (!body) fail('Error: comment body on stdin is empty')

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const payload = {
  type: 'comment',
  container: { id: pageId, type: 'page' },
  body: { storage: { value: body, representation: 'storage' } }
}
if (parentId) payload.ancestors = [{ id: parentId }]

const res = await fetch(`${BASE}/rest/api/content`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(payload)
})
const data = await res.json().catch(() => ({}))

if (!res.ok) fail(`Error: Confluence API returned HTTP ${res.status}: ${data.message ?? 'Unknown error'}`)
console.log(`Comment ${data.id} added: ${BASE}/spaces/NRFDT/pages/${pageId}?focusedCommentId=${data.id}`)
