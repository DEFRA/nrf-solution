/**
 * A minimal XML reader, sufficient for Liquibase changelogs.
 *
 * Liquibase changes nest — `<createTable>` holds `<column>` holds
 * `<constraints/>` — and the nullability of a column lives on the innermost
 * element. Flat regex matching loses that association, so we build a real tree.
 * No dependency is taken: this must run in CI with nothing installed.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e])

function attributes(src) {
  const attrs = {}
  for (const m of src.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g)) {
    attrs[m[1] ?? m[3]] = decode(m[2] ?? m[4])
  }
  return attrs
}

/**
 * Parse XML into `{ name, attrs, children, text }` nodes.
 * Namespace prefixes are stripped: `<pro:foo>` reads as `foo`.
 */
export function parseXml(xml) {
  const src = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c.replace(/[<&]/g, (ch) => (ch === '<' ? '&lt;' : '&amp;')))

  const root = { name: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  const tag = /<\s*(\/?)\s*([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g

  let last = 0
  let m
  while ((m = tag.exec(src))) {
    const [full, closing, rawName, attrSrc, selfClose] = m
    const text = src.slice(last, m.index)
    if (text.trim()) stack[stack.length - 1].text += decode(text)
    last = m.index + full.length

    const name = rawName.includes(':') ? rawName.split(':').pop() : rawName

    if (closing) {
      // Tolerate a stray close tag rather than corrupting the tree
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === name) {
          stack.length = i
          break
        }
      }
      continue
    }

    const node = { name, attrs: attributes(attrSrc), children: [], text: '' }
    stack[stack.length - 1].children.push(node)
    if (!selfClose) stack.push(node)
  }

  const tail = src.slice(last)
  if (tail.trim()) root.text += decode(tail)
  return root
}

/** Direct children with the given name. */
export const kids = (node, name) => node.children.filter((c) => c.name === name)

/** Every descendant with the given name, depth-first. */
export function find(node, name, out = []) {
  for (const c of node.children) {
    if (c.name === name) out.push(c)
    find(c, name, out)
  }
  return out
}
