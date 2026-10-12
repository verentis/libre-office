import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import {
    rawFileUrl, readableKind, sheetHtmlToText, truncate, validWorkspacePath, MAX_TEXT_CHARS
} from '../../apps/editor/shared/agent-read.mjs';

test('reads text documents and spreadsheets, and leaves plain text and slides alone', () => {
    assert.equal(readableKind('/a/Brief.DOCX'), 'text');
    assert.equal(readableKind('/a/notes.odt'), 'text');
    assert.equal(readableKind('/a/budget.xlsx'), 'sheet');
    assert.equal(readableKind('/a/budget.ods'), 'sheet');
    for (const path of ['/a/readme.md', '/a/notes.txt', '/a/rows.csv', '/a/rows.tsv', '/a/deck.pptx', '/a/archive', '/a/x.zip'])
        assert.equal(readableKind(path), null, path);
});

test('accepts only absolute workspace paths without traversal', () => {
    assert.ok(validWorkspacePath('/reports/Q1 plan.docx'));
    for (const path of ['reports/q1.docx', '/', '/a/../b.docx', '/a/./b.docx', '/a\\b.docx', '/a\nb.docx', 42, null])
        assert.equal(validWorkspacePath(path), false, String(path));
});

test('downloads only from the platform origin, with each segment encoded', () => {
    const url = rawFileUrl('https://api.example.test', '/Reports/Q1 #1?.docx');
    assert.equal(url.origin, 'https://api.example.test');
    assert.equal(url.pathname, '/v1/files/raw/Reports/Q1%20%231%3F.docx');
    assert.equal(url.searchParams.get('branch'), 'main');
});

test('flattens Calc HTML into sheet headings and tab-separated rows', () => {
    // The shape CODE's convert-to/html returns for a two-sheet workbook.
    const workbook = `<html><head><style>td{}</style></head><body>
        <h1>Overview</h1><a href="#table0"><em>Budget</em></a><a href="#table1"><em>Notes</em></a><hr>
        <A NAME="table0"><h1>Sheet 1: <em>Budget</em></h1></A>
        <table><tr><td>Area</td><td>Spend &amp; tax</td></tr><tr><td>North</td><td sdval="12">12</td></tr>
        <tr><td>&nbsp;</td><td>24</td><td><br></td></tr></table>
        <A NAME="table1"><h1>Sheet 2: <em>Notes</em></h1></A><table><tr><td>Done &lt;ok&gt;&#33;</td></tr></table></body></html>`;
    assert.equal(sheetHtmlToText(workbook), '## Budget\nArea\tSpend & tax\nNorth\t12\n\t24\n\n## Notes\nDone <ok>!');
    // A single sheet has no overview or headings.
    assert.equal(sheetHtmlToText('<table><tr><td>Only</td><td>row</td></tr></table>'), 'Only\trow');
});

test('caps returned text', () => {
    assert.deepEqual(truncate('short'), { content: 'short', truncated: false });
    const long = truncate('x'.repeat(MAX_TEXT_CHARS + 5));
    assert.equal(long.content.length, MAX_TEXT_CHARS);
    assert.equal(long.truncated, true);
});

test('the manifest wires read_document as the document read tool', () => {
    const { spec } = parse(readFileSync('manifests/office.app.yaml', 'utf8'));
    const tool = spec.tools.find(candidate => candidate.key === 'read_document');
    assert.equal(tool.effect, 'read');
    assert.deepEqual(tool.scopes, ['node.file.read']);
    assert.deepEqual(tool.implementation, { type: 'app-backend', operation: '/agent/read-document', method: 'POST' });
    const [surface] = spec.actor.surfaces;
    assert.equal(surface.kind, 'document');
    assert.equal(surface['read-tool'], 'read_document');
    for (const extension of surface.extensions)
        assert.ok(readableKind(`/f${extension}`), `${extension} must be readable by the tool`);
});
