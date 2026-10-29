#!/usr/bin/env node
// Usage: node seed-request-to-use.mjs BASE_URL EMAIL
// Creates a quote, requests the retrieve-quote email over HTTP, reads it from Notify and prints
// {"reference","retrieveUrl"}. Open retrieveUrl in the browser to start at review-quote-details.
// The link is single-use, so this script never follows it.

import { createSession, fail } from './session.mjs'
import { findEmail } from './find-email.mjs'
import { seedQuote } from './seed-quote.mjs'

const [baseUrl, email] = process.argv.slice(2)
if (!baseUrl || !email) fail('Usage: node seed-request-to-use.mjs BASE_URL EMAIL')

const { reference } = await seedQuote(baseUrl, email)

const { postForm } = await createSession(baseUrl, '/manage/what-would-you-like-to-do')
await postForm('/manage/what-would-you-like-to-do', { whatWouldYouLikeToDo: 'request-to-use' })
await postForm('/request-to-use/have-nrl-reference', { hasNrlReference: 'yes' })
await postForm('/request-to-use/enter-nrl-reference', { nrlReference: reference })
const requestedAt = new Date().toISOString()
const confirmation = await postForm('/request-to-use/enter-email', { email })
if (!confirmation.headers.get('location')?.includes('email-confirmation')) {
  fail(`Retrieve email not requested, redirected to ${confirmation.headers.get('location')}`)
}

const body = await findEmail(email, 'retrieve', requestedAt, 40)
const retrieveUrl = body.match(/\((https?:\/\/[^)\s]*\/request-to-use\/retrieve\/[^)\s]+?)\)/)?.[1]
if (!retrieveUrl) fail('No retrieve link found in the retrieve-quote email')

console.log(JSON.stringify({ reference, retrieveUrl }))
