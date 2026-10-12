import formats from './formats.json' with { type: 'json' };

// Plain-text formats are left to the platform's own fs_read; converting them would only lose fidelity.
const PLAIN = new Set(['txt', 'md', 'csv', 'tsv']);
export const MAX_SOURCE_BYTES = 52428800;
export const MAX_TEXT_CHARS = 200000;

/** How the agent read tool turns a file into text: 'text' (Writer → txt), 'sheet' (Calc → html → rows) or null. */
export function readableKind(path) {
    const extension = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
    const format = extension && !PLAIN.has(extension) ? formats[extension] : undefined;
    if (format?.icon === '#doc') return 'text';
    if (format?.icon === '#sheet') return 'sheet';
    return null;
}

/** A workspace path the tool may download: absolute, no traversal or control characters. */
export function validWorkspacePath(path) {
    return typeof path === 'string' && path.length > 1 && path.length <= 1024 && path.startsWith('/') &&
        !/[\u0000-\u001f\u007f\\]/.test(path) && !path.split('/').some(part => part === '.' || part === '..');
}

export function rawFileUrl(platformUrl, path) {
    const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return new URL(`/v1/files/raw/${encoded}?branch=main`, platformUrl);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = text => text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
});

/**
 * Calc's HTML export flattened to tab-separated rows. A workbook with several sheets starts with an "Overview"
 * block of links (dropped) and then each sheet as <a name="tableN"><h1>Sheet N: <em>Name</em></h1></a> + a table,
 * which becomes "## Name".
 */
export function sheetHtmlToText(html) {
    let body = html.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '').replace(/>\s+</g, '><');
    const firstSheet = body.search(/<a\s+name="table0"/i);
    if (firstSheet > 0) body = body.slice(firstSheet);
    const text = body
        .replace(/<h1\b[^>]*>/gi, '\n## ')
        .replace(/<\/h1>/gi, '\n')
        .replace(/<\/t[dh]>/gi, '\t')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '');
    return decode(text)
        .split('\n')
        .map(line => line.startsWith('## ')
            ? line.replace(/^## Sheet \d+: /, '## ').trim()
            : line.split('\t').map(cell => cell.trim()).join('\t').replace(/\t+$/, ''))
        .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
        .join('\n')
        .trim();
}

export function truncate(text) {
    return text.length > MAX_TEXT_CHARS
        ? { content: text.slice(0, MAX_TEXT_CHARS), truncated: true }
        : { content: text, truncated: false };
}

export const failure = (code, message) => ({ ok: false, code, message });
