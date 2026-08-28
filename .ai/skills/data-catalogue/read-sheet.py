#!/usr/bin/env python3
"""Read a sheet out of the NRF Data Catalogue workbook.

An .xlsx is a ZIP of XML, so this needs no dependencies and no install step —
which matters because the workbook lives in SharePoint and is read from a
Downloads folder, not from a project with a virtualenv.

    python3 read-sheet.py "NRF Data Catalogue_V0.1.xlsx" "Data Dictionary"

Or import it:  from read_sheet import sheet

Two things that silently return nothing if you rewrite this from scratch, both
of which cost time the first time:

  - Relationship attribute order varies by writer. openpyxl emits
    Type, Target, Id — so a regex expecting Id before Target matches nothing.
  - This workbook has no sharedStrings.xml; its cells are inline strings.
    Assuming the shared-strings part exists raises KeyError on open.
"""

import re
import sys
import zipfile

_DEC = (('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"'), ('&apos;', "'"), ('&amp;', '&'))


def _decode(s):
    for a, b in _DEC:
        s = s.replace(a, b)
    return s


def sheet(path, name):
    """Return the named sheet as a list of rows, each a list of cell strings."""
    z = zipfile.ZipFile(path)

    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        shared = [
            ''.join(_decode(t) for t in re.findall(r'<t[^>]*>(.*?)</t>', si, re.S))
            for si in re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode(), re.S)
        ]

    rels = {}
    for el in re.findall(r'<Relationship\b[^>]*>', z.read('xl/_rels/workbook.xml.rels').decode()):
        rid = re.search(r'Id="([^"]+)"', el)
        target = re.search(r'Target="([^"]+)"', el)
        if rid and target:
            rels[rid.group(1)] = target.group(1)

    wb = z.read('xl/workbook.xml').decode()
    found = re.search(r'<sheet[^>]*name="%s"[^>]*r:id="([^"]+)"' % re.escape(name), wb)
    if not found:
        names = re.findall(r'<sheet[^>]*name="([^"]*)"', wb)
        raise SystemExit('no sheet %r; available: %s' % (name, ', '.join(names)))

    target = rels[found.group(1)].lstrip('/')
    part = target if target.startswith('xl/') else 'xl/' + target

    rows = []
    for row_xml in re.findall(r'<row[^>]*>(.*?)</row>', z.read(part).decode(), re.S):
        cells = {}
        for c in re.finditer(r'<c\b([^>]*)(?:/>|>(.*?)</c>)', row_xml, re.S):
            attrs, body = c.group(1), c.group(2) or ''
            col = re.search(r'r="([A-Z]+)', attrs)
            idx = 0
            for ch in (col.group(1) if col else ''):
                idx = idx * 26 + ord(ch) - 64
            kind = re.search(r't="([^"]+)"', attrs)
            v = re.search(r'<v>(.*?)</v>', body, re.S)
            if kind and kind.group(1) == 's':
                value = shared[int(v.group(1))] if v else ''
            elif kind and kind.group(1) == 'inlineStr':
                value = ''.join(_decode(t) for t in re.findall(r'<t[^>]*>(.*?)</t>', body, re.S))
            else:
                value = _decode(v.group(1)) if v else ''
            cells[idx - 1] = value
        rows.append([cells.get(i, '') for i in range(max(cells) + 1 if cells else 0)])
    return rows


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    for row in sheet(sys.argv[1], sys.argv[2]):
        print('|'.join(row))
