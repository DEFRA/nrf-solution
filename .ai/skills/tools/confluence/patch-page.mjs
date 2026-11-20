#!/usr/bin/env node
// Usage: node patch-page.mjs PAGE_ID_OR_URL [--apply] -
// Edits JSON on stdin: [{ "before": "<exact storage text>", "after": "<replacement>" }, ...]
// Each "before" must occur exactly once in the page's storage body. Without --apply this only checks.
// Everything outside the edited strings is left byte-for-byte unchanged.

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const [input, bodyArg] = args.filter((a) => a !== '--apply')
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input || bodyArg !== '-') fail('Usage: node patch-page.mjs PAGE_ID_OR_URL [--apply] -  (edits JSON on stdin)')

const pageId = /^https?:\/\//.test(input) ? input.match(/\/pages\/(\d+)/)?.[1] : input
if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)

let edits
try { edits = JSON.parse(readFileSync(0, 'utf8')) } catch (e) { fail(`Error: stdin is not valid JSON: ${e.message}`) }
if (!Array.isArray(edits) || edits.length === 0) fail('Error: edits must be a non-empty JSON array')
for (const [i, e] of edits.entries()) {
  if (typeof e?.before !== 'string' || !e.before || typeof e?.after !== 'string') {
    fail(`Error: edit ${i + 1} needs non-empty string "before" and string "after"`)
  }
}

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }

const getRes = await fetch(`${BASE}/rest/api/content/${pageId}?expand=body.storage,version,title`, { headers })
const page = await getRes.json()
if (page.statusCode) fail(`Error: ${page.message ?? 'Unknown error'}`)

let body = page.body.storage.value
const problems = []
for (const [i, { before, after }] of edits.entries()) {
  const count = body.split(before).length - 1
  if (count !== 1) {
    problems.push(`Edit ${i + 1}: "before" text found ${count} times (need exactly 1): ${before.slice(0, 80)}`)
    continue
  }
  body = body.replace(before, () => after)
}

if (problems.length) fail(`No changes made.\n${problems.join('\n')}`)

if (!apply) {
  console.log(`Check passed: all ${edits.length} edit(s) match exactly once on version ${page.version.number}. Re-run with --apply to write.`)
  process.exit(0)
}

const putRes = await fetch(`${BASE}/rest/api/content/${pageId}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    version: { number: page.version.number + 1, message: `Applied ${edits.length} approved edit(s) from feature breakdown` },
    title: page.title,
    type: 'page',
    body: { storage: { value: body, representation: 'storage' } }
  })
})

if (putRes.ok) console.log(`Updated: ${BASE}/spaces/NRFDT/pages/${pageId} (${edits.length} edit(s))`)
else fail(`Error: Confluence API returned HTTP ${putRes.status}`)
