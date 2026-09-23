#!/usr/bin/env node
// Usage: node page.mjs PAGE_ID_OR_URL [format]
// Formats: full (default), summary, json

const [input, format = 'full'] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input) fail('Usage: node page.mjs PAGE_ID_OR_URL [format]\nFormats: full (default), summary, json')

const pageId = /^https?:\/\//.test(input)
  ? input.match(/\/pages\/(\d+)/)?.[1]
  : input

if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const res = await fetch(`${BASE}/rest/api/content/${pageId}?expand=body.view,version,space,history,metadata.labels`, {
  headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
})
const data = await res.json()

if (data.statusCode) fail(data.message ?? 'Unknown error')

switch (format) {
  case 'json':
    console.log(JSON.stringify(data, null, 2))
    break
  case 'summary':
    console.log(JSON.stringify({
      id: data.id,
      title: data.title,
      space: data.space.key,
      version: data.version.number,
      updated: data.version.when,
      updatedBy: data.version.by.displayName,
      url: `${BASE}/spaces/${data.space.key}/pages/${data.id}`
    }, null, 2))
    break
  default:
    console.log(`=== Page ${pageId} ===`)
    console.log(`Title: ${data.title}`)
    console.log(`Space: ${data.space.key}`)
    console.log(`Version: ${data.version.number} (Updated: ${data.version.when})`)
    console.log(`Updated by: ${data.version.by.displayName}`)
    console.log(`URL: ${BASE}/spaces/${data.space.key}/pages/${data.id}`)
    console.log('\n=== Labels ===')
    for (const label of data.metadata?.labels?.results ?? []) console.log(label.name)
    console.log('\n=== Body (HTML) ===')
    console.log(data.body?.view?.value ?? 'No content')
}
