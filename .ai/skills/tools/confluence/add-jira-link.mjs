#!/usr/bin/env node
// Usage: node add-jira-link.mjs PAGE_ID_OR_URL JIRA_KEY JIRA_URL

const [input, jiraKey, jiraUrl] = process.argv.slice(2)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!input || !jiraKey || !jiraUrl) fail('Usage: node add-jira-link.mjs PAGE_ID_OR_URL JIRA_KEY JIRA_URL')
if (!/^[A-Z][A-Z0-9]*-\d+$/.test(jiraKey)) fail(`Error: invalid Jira key format: ${jiraKey}`)

const pageId = /^https?:\/\//.test(input)
  ? input.match(/\/pages\/(\d+)/)?.[1]
  : input

if (!pageId || !/^\d+$/.test(pageId)) fail(`Error: unable to determine page ID from: ${input}`)

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }

const getRes = await fetch(`${BASE}/rest/api/content/${pageId}?expand=body.storage,version,title`, { headers })
const page = await getRes.json()

if (page.statusCode) fail(`Error: ${page.message ?? 'Unknown error'}`)

const jiraLink = `<p><strong>Jira story</strong>: <a href="${jiraUrl}">${jiraKey}</a></p>`
const putRes = await fetch(`${BASE}/rest/api/content/${pageId}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    version: { number: page.version.number + 1 },
    title: page.title,
    type: 'page',
    body: { storage: { value: jiraLink + page.body.storage.value, representation: 'storage' } }
  })
})

if (putRes.ok) {
  console.log(`Updated: ${BASE}/spaces/NRFDT/pages/${pageId}`)
} else {
  fail(`Error: Confluence API returned HTTP ${putRes.status}`)
}
