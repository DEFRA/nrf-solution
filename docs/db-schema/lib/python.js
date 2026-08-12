/**
 * Just enough Python reading to follow an Alembic revision.
 *
 * These are generated-then-edited files in a very regular style, but three
 * habits defeat naive matching and all three appear in the current revisions:
 *
 *   - adjacent string literals concatenate, so one SQL statement is split
 *     across several quoted fragments;
 *   - f-strings interpolate module constants (`f"ix_public_{TABLE}_name"`);
 *   - tables are created in a `for` loop over a module-level tuple, so seven
 *     real tables appear as a single `op.create_table(table, ...)` call.
 *
 * Everything here exists to make those three readable. It is not a Python
 * parser and does not try to be.
 */

/** Split an argument list on top-level commas, respecting brackets and strings. */
export function splitArgs(src) {
  const out = []
  let depth = 0
  let buf = ''
  let quote = null

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (quote) {
      buf += ch
      if (ch === '\\') {
        buf += src[++i] ?? ''
      } else if (src.startsWith(quote, i)) {
        buf += quote.slice(1)
        i += quote.length - 1
        quote = null
      }
      continue
    }

    const triple = /^("""|''')/.exec(src.slice(i))
    if (triple) {
      quote = triple[1]
      buf += triple[1]
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      buf += ch
      continue
    }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--

    if (ch === ',' && depth === 0) {
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/**
 * Read a Python string expression: one or more adjacent literals, with
 * `{NAME}` in f-strings resolved from `consts`. Returns null if `src` is not a
 * string expression (e.g. a bare identifier).
 */
export function pyString(src, consts = new Map()) {
  const s = src.trim()
  let i = 0
  let out = ''
  let found = false

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++
    if (i >= s.length) break

    const prefix = /^([rbfuRBFU]{0,2})("""|'''|"|')/.exec(s.slice(i))
    if (!prefix) break

    const isF = /f/i.test(prefix[1])
    const q = prefix[2]
    let j = i + prefix[0].length
    let lit = ''
    while (j < s.length) {
      if (s[j] === '\\' && !/r/i.test(prefix[1])) {
        const next = s[j + 1]
        lit += next === 'n' ? '\n' : next === 't' ? '\t' : next
        j += 2
        continue
      }
      if (s.startsWith(q, j)) break
      lit += s[j++]
    }
    if (j >= s.length) break

    out += isF ? lit.replace(/\{(\w+)\}/g, (m, n) => (consts.has(n) ? consts.get(n) : m)) : lit
    found = true
    i = j + q.length
  }

  // Anything left that is not whitespace means this was not a pure string expr
  return found && !s.slice(i).trim() ? out : found ? out : null
}

/**
 * Read one Python expression starting at `i`, ending at a newline that is not
 * inside a bracket or a string. A value must be read as a whole: `LAYER_TABLES`
 * spans eight lines and `_BACKFILL_SQL` is a triple-quoted block whose SQL
 * contains lines starting at column 0, so any line-based rule truncates them.
 */
export function readValue(src, i) {
  let depth = 0
  let quote = null
  let out = ''

  for (; i < src.length; i++) {
    const ch = src[i]

    if (quote) {
      out += ch
      if (ch === '\\' && quote.length === 1) out += src[++i] ?? ''
      else if (src.startsWith(quote, i)) {
        out += quote.slice(1)
        i += quote.length - 1
        quote = null
      }
      continue
    }

    const triple = /^("""|''')/.exec(src.slice(i))
    if (triple) {
      quote = triple[1]
      out += triple[1]
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      out += ch
      continue
    }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === '\n' && depth <= 0) break
    else if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++
      if (depth <= 0) break
      out += '\n'
      continue
    }

    out += ch
  }
  return out
}

/** Module-level constants: `NAME = "x"`, `NAME = ("a", "b")`, `NAME = sa.text("y")`. */
export function moduleConstants(src) {
  const consts = new Map()
  const lists = new Map()

  for (const m of src.matchAll(/^([A-Z_][A-Z0-9_]*)\s*(?::[^=\n]+)?=\s*/gm)) {
    const name = m[1]
    const value = readValue(src, m.index + m[0].length).trim()

    const tuple = /^[([]([\s\S]*)[)\]]$/.exec(value)
    if (tuple && /["']/.test(tuple[1]) && !/^\s*["'`]/.test(value)) {
      const items = splitArgs(tuple[1])
        .map((x) => pyString(x, consts))
        .filter((x) => x !== null)
      if (items.length) {
        lists.set(name, items)
        continue
      }
    }

    // sa.text("now()") / sa.false() unwrap to what Postgres will store
    const text = /^sa\.text\(([\s\S]*)\)$/.exec(value)
    if (text) {
      const inner = pyString(text[1], consts)
      if (inner !== null) consts.set(name, inner)
      continue
    }
    if (/^sa\.(false|true)\(\)$/.test(value)) {
      consts.set(name, value.includes('false') ? 'false' : 'true')
      continue
    }

    const str = pyString(value, consts)
    if (str !== null) consts.set(name, str)
  }

  return { consts, lists }
}

/**
 * Extract a top-level function body by indentation.
 * Alembic revisions define both `upgrade()` and `downgrade()`; reading the
 * wrong one inverts every change, the Python equivalent of parsing a Liquibase
 * `<rollback>` as if it were real.
 */
export function functionBody(src, name) {
  const start = new RegExp(`^def\\s+${name}\\s*\\([^)]*\\)\\s*(?:->[^:]*)?:[ \\t]*\\n`, 'm').exec(src)
  if (!start) return null
  const rest = src.slice(start.index + start[0].length)
  const lines = rest.split('\n')
  const body = []
  for (const line of lines) {
    if (line.trim() === '') {
      body.push(line)
      continue
    }
    if (!/^[ \t]/.test(line)) break // dedented to column 0: function is over
    body.push(line)
  }
  return body.join('\n')
}

/**
 * Flatten `for VAR in CONST:` loops by repeating the body once per value.
 * `reversed(CONST)` is accepted because downgrade bodies use it; order does not
 * matter to us since we only need the set of operations.
 */
export function unrollLoops(body, lists) {
  const lines = body.split('\n')
  const out = []

  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)for\s+(\w+)\s+in\s+(?:reversed\()?([A-Z_][A-Z0-9_]*)\)?\s*:\s*$/.exec(lines[i])
    if (!m || !lists.has(m[3])) {
      out.push(lines[i])
      continue
    }

    const [, indent, varName, listName] = m
    const block = []
    let j = i + 1
    for (; j < lines.length; j++) {
      if (lines[j].trim() === '') {
        block.push(lines[j])
        continue
      }
      if (lines[j].length > indent.length && lines[j].startsWith(indent + ' ')) {
        block.push(lines[j])
        continue
      }
      break
    }

    for (const value of lists.get(listName)) {
      for (const line of block) {
        out.push(
          line
            // f-string interpolation of the loop variable
            .replace(new RegExp(`\\{${varName}\\}`, 'g'), value)
            // the bare identifier used as an argument
            .replace(new RegExp(`(?<!["'\\w.])${varName}(?![\\w"'])`, 'g'), `"${value}"`)
        )
      }
    }
    i = j - 1
  }

  return out.join('\n')
}

/**
 * Find `receiver.method(...)` calls with balanced parentheses.
 * @returns {Array<{method: string, args: string}>}
 */
export function calls(src, receiver = 'op') {
  const out = []
  const re = new RegExp(`\\b${receiver}\\.(\\w+)\\s*\\(`, 'g')
  let m
  while ((m = re.exec(src))) {
    let depth = 1
    let i = m.index + m[0].length
    let quote = null
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i]
      if (quote) {
        if (ch === '\\') i++
        else if (src.startsWith(quote, i)) {
          i += quote.length - 1
          quote = null
        }
        continue
      }
      const triple = /^("""|''')/.exec(src.slice(i))
      if (triple) {
        quote = triple[1]
        i += 2
        continue
      }
      if (ch === '"' || ch === "'") quote = ch
      else if (ch === '(') depth++
      else if (ch === ')') depth--
    }
    out.push({ method: m[1], args: src.slice(m.index + m[0].length, i - 1) })
    re.lastIndex = i
  }
  return out
}

/**
 * Read an expression that should yield a string: a literal, or a bare
 * identifier naming a module constant (`op.create_table(TABLE, ...)`).
 */
export function resolve(expr, consts = new Map()) {
  const s = (expr ?? '').trim()
  if (!s) return null
  const literal = pyString(s, consts)
  if (literal !== null) return literal
  return consts.has(s) ? consts.get(s) : null
}

/** Keyword arguments of a call, as raw source strings. */
export function kwargs(args) {
  const out = new Map()
  for (const a of splitArgs(args)) {
    const m = /^(\w+)\s*=\s*([\s\S]+)$/.exec(a)
    if (m) out.set(m[1], m[2].trim())
  }
  return out
}

/** Positional arguments of a call, as raw source strings. */
export const positional = (args) => splitArgs(args).filter((a) => !/^\w+\s*=[^=]/.test(a))
