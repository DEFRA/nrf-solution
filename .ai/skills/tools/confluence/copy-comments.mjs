#!/usr/bin/env node
// Usage: node copy-comments.mjs SOURCE_PAGE_ID TARGET_PAGE_ID COMMENT_ID[=ANCHOR TEXT] [...]
// ANCHOR TEXT overrides the original highlight, for when the rewrite changed that text: use words from the target that occur exactly once.
// Re-asks the listed top-level comments (and their replies) on the target page, prefixed with the original author and date.
// An inline comment is re-anchored on the same text when that text occurs exactly once in the target; otherwise it becomes a footer comment quoting it.

const [sourceId, targetId, ...commentArgs] = process.argv.slice(2)
const anchors = Object.fromEntries(commentArgs.map((a) => { const i = a.indexOf('='); return i < 0 ? [a, null] : [a.slice(0, i), a.slice(i + 1)] }))
const commentIds = Object.keys(anchors)
const { ATLASSIAN_USER: user, ATLASSIAN_TOKEN: token } = process.env
const BASE = 'https://eaflood.atlassian.net/wiki'

function fail(msg) { console.error(msg); process.exit(1) }

if (!user || !token) fail('Error: ATLASSIAN_USER and ATLASSIAN_TOKEN must be set')
if (!sourceId || !targetId || commentIds.length === 0) fail('Usage: node copy-comments.mjs SOURCE_PAGE_ID TARGET_PAGE_ID COMMENT_ID[=ANCHOR TEXT] [...]')
for (const id of [sourceId, targetId, ...commentIds]) if (!/^\d+$/.test(id)) fail(`Error: invalid ID: ${id}`)

const auth = Buffer.from(`${user}:${token}`).toString('base64')
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }
const expand = 'body.storage,extensions.inlineProperties,ancestors,history'

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const plainText = (html) => html.replace(/<[^>]*>/g, '')
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, '&')

const comments = []
for (let start = 0; ; start += 100) {
  const res = await fetch(`${BASE}/rest/api/content/${sourceId}/child/comment?expand=${expand}&limit=100&start=${start}`, { headers })
  const data = await res.json()
  if (!res.ok) fail(`Error: ${data.message ?? `HTTP ${res.status}`}`)
  comments.push(...data.results)
  if (data.results.length < 100) break
}

const pageRes = await fetch(`${BASE}/rest/api/content/${targetId}?expand=body.storage`, { headers })
const target = await pageRes.json()
if (!pageRes.ok) fail(`Error: ${target.message ?? `HTTP ${pageRes.status}`}`)
const targetText = decode(plainText(target.body.storage.value))

function prefix(c) {
  const date = c.history?.createdDate?.slice(0, 10) ?? ''
  return `<p><em>Re-asked from the original page (${escapeHtml(c.history?.createdBy?.displayName ?? 'unknown')}, ${date}):</em></p>`
}

async function postFooter(body, parentId) {
  const payload = { type: 'comment', container: { id: targetId, type: 'page' }, body: { storage: { value: body, representation: 'storage' } } }
  if (parentId) payload.ancestors = [{ id: parentId }]
  const res = await fetch(`${BASE}/rest/api/content`, { method: 'POST', headers, body: JSON.stringify(payload) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) fail(`Error: Confluence API returned HTTP ${res.status}: ${data.message ?? 'Unknown error'}`)
  return data.id
}

async function postInline(body, selection) {
  const res = await fetch(`${BASE}/api/v2/inline-comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pageId: targetId,
      body: { representation: 'storage', value: body },
      inlineCommentProperties: { textSelection: selection, textSelectionMatchCount: 1, textSelectionMatchIndex: 0 }
    })
  })
  const data = await res.json().catch(() => ({}))
  return res.ok ? data.id : null
}

for (const id of commentIds) {
  const c = comments.find((x) => x.id === id && !x.ancestors?.length)
  if (!c) fail(`Error: top-level comment ${id} not found on page ${sourceId}`)

  const original = decode(c.extensions?.inlineProperties?.originalSelection ?? '').trim()
  const selection = anchors[id] ?? original
  const occurrences = selection ? targetText.split(selection).length - 1 : 0
  const body = prefix(c) + c.body.storage.value

  let newId = null
  let mode = 'footer'
  if (occurrences === 1) {
    newId = await postInline(body, selection)
    if (newId) mode = 'inline'
  }
  if (!newId) {
    const quote = original ? `<blockquote><p>${escapeHtml(original)}</p></blockquote>` : ''
    newId = await postFooter(prefix(c) + quote + c.body.storage.value)
  }
  console.log(`${id} -> ${newId} (${mode})`)

  const replies = comments.filter((x) => x.ancestors?.at(-1)?.id === id)
  for (const r of replies) {
    const replyId = await postFooter(prefix(r) + r.body.storage.value, newId)
    console.log(`  reply ${r.id} -> ${replyId}`)
  }
}
