#!/usr/bin/env node
// Usage: node find-email.mjs RECIPIENT [TEXT] [SENT_AFTER_ISO] [MAX_ATTEMPTS]
// Polls GOV.UK Notify for an email to RECIPIENT whose body contains TEXT (created
// after SENT_AFTER_ISO, minus 30s clock-skew buffer) and prints the body.
// The API key is read from NOTIFY_API_KEY, else from compose.override.yml (the single place the
// key lives locally); it is never printed.
// Mirrors journey-tests/test/support/find-notify-email.js — keep the two in step.

import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fail } from './session.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

function loadApiKey() {
  if (process.env.NOTIFY_API_KEY) return process.env.NOTIFY_API_KEY
  const file = join(root, 'compose.override.yml')
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8').match(/^\s*NOTIFY_API_KEY["']?\s*[:=]\s*["']?([^"'\s#]+)/m)?.[1] ?? null
}

export async function findEmail(recipient, text = '', sentAfter, maxAttempts = 30) {
  const apiKey = loadApiKey()
  if (!apiKey) fail('Error: NOTIFY_API_KEY is not set and was not found in compose.override.yml')

  const clientPath = ['journey-tests', 'backend']
    .map((repo) => join(root, repo, 'node_modules/notifications-node-client/client/notification.js'))
    .find(existsSync)
  if (!clientPath) fail('Error: notifications-node-client is not installed (run npm install in journey-tests)')

  const { NotifyClient } = createRequire(import.meta.url)(clientPath)
  const client = new NotifyClient(apiKey)
  const afterTime = sentAfter ? new Date(sentAfter).getTime() - 30_000 : 0

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.getNotifications('email')
    const match = (response.data?.notifications ?? []).find(
      (n) =>
        n.email_address === recipient &&
        new Date(n.created_at).getTime() >= afterTime &&
        ['sending', 'delivered'].includes(n.status) &&
        n.body?.includes(text)
    )
    if (match) return match.body
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000))
  }
  return fail(`No email to ${recipient} containing "${text}" after ${maxAttempts} attempts`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [recipient, text, sentAfter, maxAttempts] = process.argv.slice(2)
  if (!recipient) fail('Usage: node find-email.mjs RECIPIENT [TEXT] [SENT_AFTER_ISO] [MAX_ATTEMPTS]')
  console.log(await findEmail(recipient, text, sentAfter, maxAttempts && Number(maxAttempts)))
}
