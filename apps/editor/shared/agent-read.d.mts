export const MAX_SOURCE_BYTES: number;
export const MAX_TEXT_CHARS: number;
export function readableKind(path: string): 'text' | 'sheet' | null;
export function validWorkspacePath(path: unknown): path is string;
export function rawFileUrl(platformUrl: string, path: string): URL;
export function sheetHtmlToText(html: string): string;
export function truncate(text: string): { content: string; truncated: boolean };
export function failure(code: string, message: string): { ok: false; code: string; message: string };
