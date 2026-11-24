#!/usr/bin/env node
// Usage: node get-template.mjs TEMPLATE_ID [@personalisation.json]
// Prints a GOV.UK Notify email template as JSON. Without a personalisation file it is the stored
// template ({ id, name, version, type, subject, body }). With one (a JSON object of placeholder
// values, given inline or as an @-prefixed file path) it is the rendered email
// ({ subject, body, html }). Nothing is sent.
// The API key is read as find-email.mjs reads it; it is never printed.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fail } from './session.mjs'
import { createNotifyClient } from './find-email.mjs'

const readPersonalisation = (source) => {
  if (!source) return undefined
  const personalisation = JSON.parse(source.startsWith('@') ? readFileSync(source.slice(1), 'utf8') : source)
  if (typeof personalisation !== 'object' || personalisation === null) {
    fail('Error: personalisation must be a JSON object')
  }
  return personalisation
}

export async function getTemplate({ templateId, personalisation }) {
  const client = createNotifyClient()
  const { data } = personalisation
    ? await client.previewTemplateById(templateId, personalisation)
    : await client.getTemplateById(templateId)
  return data
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [templateId, personalisationSource] = process.argv.slice(2)
  if (!templateId) fail('Usage: node get-template.mjs TEMPLATE_ID [@personalisation.json]')
  try {
    const template = await getTemplate({
      templateId,
      personalisation: readPersonalisation(personalisationSource)
    })
    console.log(JSON.stringify(template, null, 2))
  } catch (error) {
    // Only the Notify response is printed: the error also carries the signed request.
    fail(`Error: Notify request failed: ${JSON.stringify(error.response?.data ?? error.message)}`)
  }
}
