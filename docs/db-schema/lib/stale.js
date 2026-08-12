/**
 * Find hand-maintained ER diagrams elsewhere in the tree that no longer match
 * the schema.
 *
 * This is the check that would have caught gap G14. `quote-database-diagram.md`
 * fell four changesets behind — it listed four dropped columns and omitted two
 * added ones — and went on to become the source of a wrong data dictionary.
 * Nothing detected it, because a stale diagram looks exactly like a fresh one.
 *
 * The comparison is exact rather than heuristic: another Mermaid `erDiagram` is
 * written in the same notation this generator emits, so its entity blocks parse
 * the same way and the table and column sets can be diffed directly.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  '__pycache__',
  'dist',
  'build',
  '.public',
  'coverage',
  'test-results'
])

function markdownFiles(dir, depth, out = []) {
  if (depth < 0) return out
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) markdownFiles(full, depth - 1, out)
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
  }
  return out
}

/** Parse `table { type name ... }` blocks out of a Mermaid erDiagram. */
export function parseErDiagram(markdown) {
  const tables = new Map()
  for (const [, block] of markdown.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) {
    if (!/^\s*erDiagram/m.test(block)) continue
    for (const [, name, body] of block.matchAll(/^\s*(\w+)\s*\{\s*\n([\s\S]*?)^\s*\}/gm)) {
      const columns = new Set()
      for (const line of body.split('\n')) {
        const m = /^\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)/.exec(line)
        if (m) columns.add(m[2])
      }
      if (columns.size) tables.set(name, columns)
    }
  }
  return tables
}

/**
 * @param {string} repo
 * @param {Map<string, {columns: Array}>} schema every real table, by name
 * @param {string[]} ignore absolute paths to skip (the generated document)
 */
export function findStaleDiagrams(repo, schema, ignore = []) {
  const skip = new Set(ignore.map((f) => path.resolve(f)))
  const findings = []

  for (const file of markdownFiles(repo, 4)) {
    if (skip.has(path.resolve(file))) continue
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (!src.includes('erDiagram')) continue

    const documented = parseErDiagram(src)
    if (!documented.size) continue

    const problems = []
    for (const [table, columns] of documented) {
      const real = schema.get(table)
      if (!real) {
        // Only report a table we can be confident is meant to be one of ours —
        // an unrelated diagram in a design doc is not drift.
        if ([...documented.keys()].some((t) => schema.has(t))) {
          problems.push(`\`${table}\` is documented but does not exist`)
        }
        continue
      }
      const realColumns = new Set(real.columns.map((c) => c.name))
      const dropped = [...columns].filter((c) => !realColumns.has(c))
      const missing = [...realColumns].filter((c) => !columns.has(c))
      if (dropped.length) {
        problems.push(`\`${table}\` lists dropped columns: ${dropped.join(', ')}`)
      }
      if (missing.length) {
        problems.push(`\`${table}\` omits columns: ${missing.join(', ')}`)
      }
    }

    if (problems.length) {
      findings.push({ file: path.relative(repo, file).split(path.sep).join('/'), problems })
    }
  }

  return findings.sort((a, b) => a.file.localeCompare(b.file))
}
