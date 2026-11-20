#!/usr/bin/env node
// Usage: node comments.mjs PAGE_ID_OR_URL
// Lists footer and inline comments with resolution status (open, resolved, reopened, dangling) as JSON.

const [input] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input) fail('Usage: node comments.mjs PAGE_ID_OR_URL')

const pageId = /^https?:\/\//.test(input) ? input.match(/\/pages\/(\d+)/)?.[1] : input
if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const expand = 'body.storage,extensions.inlineProperties,extensions.resolution,ancestors,history'
const results = []

for (let start = 0; ; start += 100) {
  const res = await fetch(`${BASE}/rest/api/content/${pageId}/child/comment?expand=${expand}&limit=100&start=${start}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
  })
  const data = await res.json()
  if (!res.ok) fail(`Error: ${data.message ?? `HTTP ${res.status}`}`)
  results.push(...data.results)
  if (data.results.length < 100) break
}

const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

console.log(JSON.stringify(results.map((c) => ({
  id: c.id,
  status: c.extensions?.resolution?.status ?? 'none',
  inline: Boolean(c.extensions?.inlineProperties),
  replyTo: c.ancestors?.at(-1)?.id ?? null,
  author: c.history?.createdBy?.displayName,
  onText: c.extensions?.inlineProperties?.originalSelection ?? null,
  comment: text(c.body.storage.value)
})), null, 2))
