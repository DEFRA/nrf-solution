/**
 * Replay a Liquibase changelog into the schema it produces.
 *
 * Two traps, both of which produced wrong results the first time they were hit
 * and are the reason this is a shared module rather than a regex in each caller:
 *
 * 1. A `<rollback>` block holds the INVERSE of its changeset — an `addColumn`
 *    changeset contains a `dropColumn` rollback. Treating rollbacks as real
 *    operations cancels out every column ever added. They are stripped first.
 *
 * 2. Schema-changing DDL also arrives as raw `<sql>`: `quotes.reference` is a
 *    generated column that exists only there, and `quote_edp_results` was
 *    dropped and recreated in raw SQL with a different column set. Raw SQL is
 *    parsed (see ./sql.js), never skipped.
 *
 * Anything this module does not recognise is recorded in `unsupported` rather
 * than ignored, so the generator can refuse to emit a document it cannot vouch
 * for.
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { parseXml, kids, find } from './xml.js'
import { parseSql } from './sql.js'

/** Change types that cannot alter the tables or columns we document. */
const NO_SCHEMA_EFFECT = new Set([
  'comment',
  'validCheckSum',
  'preConditions',
  'rollback',
  'createIndex',
  'dropIndex',
  'insert',
  'update',
  'delete',
  'loadData',
  'loadUpdateData',
  'tagDatabase',
  'empty',
  // Schema objects that are not tables. A sequence still shows up wherever a
  // column defaults to `nextval(...)`, so nothing is lost by not listing it.
  'createSequence',
  'dropSequence',
  'alterSequence',
  'createView',
  'dropView',
  'createProcedure',
  'dropProcedure'
])

const bool = (v) => v === 'true' || v === true

function columnFromXml(el) {
  const c = kids(el, 'constraints')[0]
  const a = el.attrs
  const k = c?.attrs ?? {}

  let dflt = null
  if (a.defaultValue !== undefined) dflt = `'${a.defaultValue}'`
  else if (a.defaultValueNumeric !== undefined) dflt = a.defaultValueNumeric
  else if (a.defaultValueBoolean !== undefined) dflt = a.defaultValueBoolean
  else if (a.defaultValueComputed !== undefined) dflt = a.defaultValueComputed
  else if (a.defaultValueDate !== undefined) dflt = a.defaultValueDate

  const refs = k.references ? /^([\w.]+)\s*\(\s*(\w+)\s*\)$/.exec(k.references) : null

  return {
    name: a.name,
    type: a.type,
    // Liquibase defaults nullable to true when the attribute is absent.
    notNull: k.nullable === 'false' || bool(k.primaryKey),
    primaryKey: bool(k.primaryKey),
    unique: bool(k.unique),
    identity: bool(a.autoIncrement),
    generatedAs: null,
    default: dflt,
    remarks: a.remarks ?? null,
    references: refs ? { table: refs[1].toLowerCase(), column: refs[2].toLowerCase() } : null,
    onDeleteCascade: bool(k.deleteCascade),
    constraintName: k.foreignKeyName ?? null
  }
}

/** Apply one classified raw-SQL statement to the working schema. */
function applySql(st, S, ctx) {
  switch (st.op) {
    case 'createTable':
      S.tables.set(st.table, {
        name: st.table,
        columns: st.columns.map((c) => ({ ...c, remarks: null, constraintName: null })),
        source: ctx
      })
      for (const c of st.constraints) {
        const fk =
          /FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+([\w.]+)\s*\(\s*(\w+)\s*\)/i.exec(c)
        if (fk) {
          const col = S.tables.get(st.table).columns.find((x) => x.name === fk[1].toLowerCase())
          if (col) {
            col.references = {
              table: fk[2].replace(/^public\./i, '').toLowerCase(),
              column: fk[3].toLowerCase()
            }
            col.onDeleteCascade = /ON\s+DELETE\s+CASCADE/i.test(c)
            col.constraintName = /CONSTRAINT\s+(\w+)/i.exec(c)?.[1] ?? null
          }
        }
        const uq = /^(?:CONSTRAINT\s+(\w+)\s+)?UNIQUE\s*\(([^)]+)\)/i.exec(c)
        if (uq) {
          S.constraints.push({
            table: st.table,
            name: uq[1] ?? null,
            kind: 'UNIQUE',
            columns: uq[2].split(',').map((x) => x.trim().toLowerCase())
          })
        }
      }
      break
    case 'addColumn': {
      const t = S.tables.get(st.table)
      if (t) t.columns.push({ ...st.column, remarks: null, constraintName: null })
      break
    }
    case 'dropColumn': {
      const t = S.tables.get(st.table)
      if (t) t.columns = t.columns.filter((c) => c.name !== st.column)
      break
    }
    case 'renameTable': {
      const t = S.tables.get(st.from)
      if (t) {
        S.tables.delete(st.from)
        t.name = st.to
        S.tables.set(st.to, t)
      }
      break
    }
    case 'renameColumn': {
      const col = S.tables.get(st.table)?.columns.find((c) => c.name === st.from)
      if (col) col.name = st.to
      break
    }
    case 'alterColumn': {
      const col = S.tables.get(st.table)?.columns.find((c) => c.name === st.column)
      if (col) {
        if (st.type !== undefined) col.type = st.type
        if (st.notNull !== undefined) col.notNull = st.notNull
        if ('default' in st) col.default = st.default
      }
      break
    }
    case 'dropTable':
      S.tables.delete(st.table)
      break
    case 'addConstraint':
      S.constraints.push({ table: st.table, name: st.name, kind: 'RAW', body: st.body })
      break
    case 'ignore':
      break
    default:
      S.unsupported.push({ ...ctx, detail: `raw SQL: ${st.sql.slice(0, 120)}` })
  }
}

/** Ordered changelog files, following `<include>` from the master file. */
export function changelogFiles(dir, master = 'db.changelog.xml') {
  const masterPath = path.join(dir, master)
  if (!existsSync(masterPath)) return []
  const root = parseXml(readFileSync(masterPath, 'utf8'))
  const files = []
  for (const inc of find(root, 'include')) {
    const f = inc.attrs.file
    if (f) files.push(path.join(dir, path.basename(f)))
  }
  return files.filter(existsSync)
}

/**
 * Replay `dir`'s changelog.
 * @returns {{tables: Map, constraints: Array, indexes: Array, unsupported: Array, changesets: number}}
 */
export function readLiquibase(dir) {
  const S = {
    tables: new Map(),
    constraints: [],
    indexes: [],
    unsupported: [],
    // Changeset <comment> elements carry the reasoning behind a change — why a
    // constraint exists, why a sequence is offset. That is the part of the
    // schema a reader most needs and the part a column list cannot convey, so
    // it is carried through to the document rather than discarded.
    notes: [],
    changesets: 0
  }

  for (const file of changelogFiles(dir)) {
    const raw = readFileSync(file, 'utf8')
    // Trap 1: rollbacks hold the inverse operation.
    const xml = raw.replace(/<rollback\b[\s\S]*?<\/rollback>/g, '').replace(/<rollback\s*\/>/g, '')
    const root = parseXml(xml)
    const rel = path.basename(file)

    for (const cs of find(root, 'changeSet')) {
      S.changesets++
      const ctx = { file: rel, changeset: cs.attrs.id, author: cs.attrs.author }
      const comment = kids(cs, 'comment')[0]?.text?.trim().replace(/\s+/g, ' ') ?? null
      const touched = new Set()

      for (const ch of cs.children) {
        for (const key of ['tableName', 'baseTableName', 'oldTableName']) {
          if (ch.attrs[key]) touched.add(ch.attrs[key])
        }
        if (ch.name === 'sql') {
          for (const st of parseSql(ch.text)) {
            if (st.table) touched.add(st.table)
          }
        }
        const a = ch.attrs
        switch (ch.name) {
          case 'createTable':
            S.tables.set(a.tableName, {
              name: a.tableName,
              columns: kids(ch, 'column').map(columnFromXml),
              remarks: a.remarks ?? null,
              source: ctx,
              comment
            })
            break

          case 'addColumn': {
            const t = S.tables.get(a.tableName)
            if (t) t.columns.push(...kids(ch, 'column').map(columnFromXml))
            else S.unsupported.push({ ...ctx, detail: `addColumn on unknown table ${a.tableName}` })
            break
          }

          case 'dropColumn': {
            const t = S.tables.get(a.tableName)
            if (!t) break
            const names = a.columnName
              ? [a.columnName]
              : kids(ch, 'column').map((c) => c.attrs.name)
            t.columns = t.columns.filter((c) => !names.includes(c.name))
            break
          }

          case 'dropTable':
            S.tables.delete(a.tableName)
            break

          case 'renameTable': {
            const t = S.tables.get(a.oldTableName)
            if (t) {
              S.tables.delete(a.oldTableName)
              t.name = a.newTableName
              S.tables.set(a.newTableName, t)
            }
            break
          }

          case 'renameColumn': {
            const col = S.tables.get(a.tableName)?.columns.find((c) => c.name === a.oldColumnName)
            if (col) col.name = a.newColumnName
            break
          }

          case 'modifyDataType': {
            const col = S.tables.get(a.tableName)?.columns.find((c) => c.name === a.columnName)
            if (col) col.type = a.newDataType
            break
          }

          case 'addNotNullConstraint':
          case 'dropNotNullConstraint': {
            const col = S.tables.get(a.tableName)?.columns.find((c) => c.name === a.columnName)
            if (col) col.notNull = ch.name === 'addNotNullConstraint'
            break
          }

          case 'addDefaultValue': {
            const col = S.tables.get(a.tableName)?.columns.find((c) => c.name === a.columnName)
            if (col) {
              col.default =
                a.defaultValueComputed ??
                a.defaultValueNumeric ??
                a.defaultValueBoolean ??
                (a.defaultValue !== undefined ? `'${a.defaultValue}'` : col.default)
            }
            break
          }

          case 'dropDefaultValue': {
            const col = S.tables.get(a.tableName)?.columns.find((c) => c.name === a.columnName)
            if (col) col.default = null
            break
          }

          case 'addUniqueConstraint':
            S.constraints.push({
              table: a.tableName,
              name: a.constraintName ?? null,
              kind: 'UNIQUE',
              columns: (a.columnNames ?? '').split(',').map((c) => c.trim()),
              comment,
              source: ctx
            })
            break

          case 'dropUniqueConstraint':
            S.constraints = S.constraints.filter(
              (c) => !(c.table === a.tableName && c.name === a.constraintName)
            )
            break

          case 'addForeignKeyConstraint': {
            const col = S.tables
              .get(a.baseTableName)
              ?.columns.find((c) => c.name === a.baseColumnNames)
            if (col) {
              col.references = {
                table: a.referencedTableName,
                column: a.referencedColumnNames
              }
              col.onDeleteCascade = /cascade/i.test(a.onDelete ?? '')
              col.constraintName = a.constraintName ?? null
            }
            break
          }

          case 'createIndex':
            S.indexes.push({
              table: a.tableName,
              name: a.indexName,
              unique: bool(a.unique),
              columns: kids(ch, 'column').map((c) => c.attrs.name),
              source: ctx
            })
            break

          case 'dropIndex':
            S.indexes = S.indexes.filter((i) => i.name !== a.indexName)
            break

          case 'sql':
            for (const st of parseSql(ch.text)) applySql(st, S, ctx)
            // Index DDL is ignorable for the table shape but wanted in the doc.
            for (const m of ch.text.matchAll(
              /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+([\w.]+)\s*(?:USING\s+(\w+)\s*)?\(([^)]*)\)([^;]*)/gi
            )) {
              S.indexes.push({
                table: m[3].replace(/^public\./i, ''),
                name: m[2],
                unique: Boolean(m[1]),
                using: m[4] ?? null,
                columns: m[5].split(',').map((c) => c.trim()),
                where: /WHERE\s+(.+)$/i.exec(m[6]?.trim() ?? '')?.[1] ?? null,
                source: ctx
              })
            }
            break

          default:
            if (!NO_SCHEMA_EFFECT.has(ch.name)) {
              S.unsupported.push({ ...ctx, detail: `unhandled change type <${ch.name}>` })
            }
        }
      }

      if (comment) S.notes.push({ ...ctx, comment, tables: [...touched] })
    }
  }

  // A generated column carries an implicit unique index in our changelog; fold
  // inline UNIQUE column flags into the constraint list so the doc lists them.
  for (const t of S.tables.values()) {
    for (const c of t.columns) {
      if (c.unique && !S.constraints.some((k) => k.table === t.name && k.columns?.includes(c.name))) {
        S.constraints.push({ table: t.name, name: null, kind: 'UNIQUE', columns: [c.name] })
      }
    }
  }

  return S
}
