#!/usr/bin/env node
// Usage: node copy-page.mjs PAGE_ID_OR_URL
// Creates "[ANALYSIS COPY] <title>" (or "[ANALYSIS COPY 2] <title>", 3, ... if that title is taken) as a child of the page, with the same storage body (comments are not copied).
// Prints the new page's ID and URL. Delete the child page to discard it.

const [input] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input) fail('Usage: node copy-page.mjs PAGE_ID_OR_URL')

const pageId = /^https?:\/\//.test(input) ? input.match(/\/pages\/(\d+)/)?.[1] : input
if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }

const getRes = await fetch(`${BASE}/rest/api/content/${pageId}?expand=body.storage,space`, { headers })
const page = await getRes.json()
if (page.statusCode) fail(`Error: ${page.message ?? 'Unknown error'}`)

async function titleTaken(title) {
  const params = new URLSearchParams({ spaceKey: page.space.key, title, status: 'any' })
  const res = await fetch(`${BASE}/rest/api/content?${params}`, { headers })
  const data = await res.json()
  return (data.results ?? []).length > 0
}

let n = 1
let title
do {
  title = `[ANALYSIS COPY${n > 1 ? ` ${n}` : ''}] ${page.title}`
  n++
} while (await titleTaken(title))

const postRes = await fetch(`${BASE}/rest/api/content`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    type: 'page',
    title,
    space: { key: page.space.key },
    ancestors: [{ id: pageId }],
    body: { storage: { value: page.body.storage.value, representation: 'storage' } }
  })
})
const created = await postRes.json()
if (!postRes.ok) fail(`Error: Confluence API returned HTTP ${postRes.status}: ${created.message ?? ''}`)

console.log(`${created.id} ${BASE}/spaces/${page.space.key}/pages/${created.id}`)
