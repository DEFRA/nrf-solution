#!/usr/bin/env node
// Creates a quote by driving the frontend's HTTP routes. Used by seed-request-to-use.mjs.
// Mirrors journey-tests/test/support/seed-quote.js — keep the form fields in step.

import { createSession, fail } from './session.mjs'

const POLYGON = {
  type: 'Polygon',
  coordinates: [[[1.248, 52.793], [1.254, 52.793], [1.251, 52.798], [1.248, 52.793]]]
}

export async function seedQuote(baseUrl, email) {
  const { request, postForm, postJson } = await createSession(baseUrl, '/manage/what-would-you-like-to-do')

  await postForm('/manage/what-would-you-like-to-do', { whatWouldYouLikeToDo: 'quote' })
  await postForm('/quote/planning-type', { planningType: 'full-planning-permission' })
  await postForm('/quote/confirm-housing', { isHousing: 'yes' })
  await postForm('/quote/unit-number', { housingUnits: '10' })
  await postForm('/quote/boundary-type', { boundaryEntryType: 'draw' })

  const check = await postJson('/quote/draw-boundary/check', { geometry: POLYGON })
  if (check.status !== 200) fail(`Boundary check returned ${check.status}`)
  const boundaryGeojson = await check.json()
  if (!boundaryGeojson.boundaryGeometryWgs84) fail('Boundary check returned no boundaryGeometryWgs84')

  const save = await postJson('/quote/draw-boundary/save', { boundaryGeojson })
  if (save.status !== 303 || save.headers.get('location') !== '/quote/email') {
    fail(`Boundary save returned ${save.status} ${save.headers.get('location') ?? ''}`)
  }

  await postForm('/quote/email', { email })
  const submit = await postForm('/quote/check-your-answers', {})
  const confirmation = await request(submit.headers.get('location'))
  const reference = (await confirmation.text()).match(/NRL-\d{6}/)?.[0]
  if (!reference) fail('No NRL reference found on the quote confirmation page')

  return { reference }
}
