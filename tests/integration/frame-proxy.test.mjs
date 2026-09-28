import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { chromium } from '@playwright/test';

const listen = handler => new Promise(resolve => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
});
const port = server => server.address().port;

test('built CODE proxy substitutes only authorized ancestors on document POST', async () => {
    const backend = await listen((request, response) => {
        assert.ok(['/v1/collaboration/frames/authorize', '/v1/collaboration/embeds/authorize'].includes(request.url));
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ parentOrigin: 'https://customer.example' }));
    });
    const code = await listen((request, response) => {
        response.setHeader('Content-Type', request.url.includes('cool.html') ? 'text/html' : 'text/javascript');
        response.setHeader('Content-Security-Policy',
            "default-src 'self'; frame-ancestors office-wopi.apps.verentis.dev:*; connect-src 'self'");
        response.end(request.url.includes('cool.html') ? '<html>CODE</html>' : 'console.log(1)');
    });
    const reserved = await listen((_request, response) => response.end());
    const proxyPort = port(reserved);
    await new Promise(resolve => reserved.close(resolve));
    const child = spawn(process.execPath, ['.output/server/index.mjs'], {
        cwd: new URL('../../apps/editor/', import.meta.url),
        env: {
            ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(proxyPort),
            NUXT_COLLABORATION_URL: `http://127.0.0.1:${port(backend)}`,
            NUXT_CODE_URL: `http://127.0.0.1:${port(code)}`,
            NUXT_PUBLIC_EDITOR_ORIGIN: 'https://office-code.apps.verentis.dev',
            NUXT_PUBLIC_WOPI_ORIGIN: 'https://api.verentis.dev',
            NUXT_PUBLIC_WRAPPER_ORIGIN: 'https://office.apps.verentis.dev',
        },
        stdio: 'ignore'
    });
    try {
        let ready = false;
        for (let attempt = 0; attempt < 50; attempt++) {
            try {
                ready = (await fetch(`http://127.0.0.1:${proxyPort}/_ready`)).ok;
                if (ready) break;
            } catch { /* server not listening yet */ }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(ready, true, 'built editor starts');
        const source = 'https://api.verentis.dev/wopi/files/00000000000000000000000000000002';
        const path = `/browser/dist/cool.html?WOPISrc=${encodeURIComponent(source)}`;
        const origin = `http://127.0.0.1:${proxyPort}`;
        for (const [method, retiredPath] of [
            ['POST', '/api/test/sessions'], ['GET', '/api/sessions'], ['GET', '/api'], ['OPTIONS', '/api/']
        ]) {
            const retired = await fetch(origin + retiredPath, {
                method, headers: { Accept: 'text/html', Origin: 'https://office.apps.verentis.dev' }
            });
            assert.equal(retired.status, 404, `${method} ${retiredPath} must not reach the SPA fallback`);
            assert.doesNotMatch(await retired.text(), /id="__nuxt"/);
        }
        const headers = { Host: 'office-code.apps.verentis.dev', 'Content-Type': 'application/x-www-form-urlencoded',
            Origin: 'https://office.apps.verentis.dev' };
        const response = await fetch(origin + path, {
            method: 'POST', headers, body: `access_token=${'a'.repeat(43)}&access_token_ttl=10000`
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-security-policy'),
            "default-src 'self';frame-ancestors https://office.apps.verentis.dev https://customer.example; connect-src 'self'");
        assert.equal(await response.text(), '<html>CODE</html>');
        assert.equal((await fetch(origin + path, {
            method: 'POST', headers: { ...headers, Origin: 'https://unapproved.example' },
            body: `access_token=${'a'.repeat(43)}`
        })).status, 403);
        assert.equal((await fetch(origin + path, {
            method: 'POST', headers, body: `access_token=${'a'.repeat(43)}&access_token=${'b'.repeat(43)}`
        })).status, 403);
        assert.equal((await fetch(origin + path, { headers })).status, 403);
        assert.equal((await fetch(origin + '/', { headers: { Host: 'office.apps.verentis.dev' } })).status, 403);
        const navigationHeaders = { Host: 'office.apps.verentis.dev', 'X-Forwarded-Proto': 'https',
            'X-Forwarded-Host': 'office.apps.verentis.dev' };
        const embedTicket = ['a'.repeat(64), 'b'.repeat(600), 'c'.repeat(86)].join('.');
        const wrapper = await fetch(origin + `/?embedTicket=${embedTicket}`, { headers: navigationHeaders });
        assert.equal(wrapper.status, 200);
        assert.equal(wrapper.headers.get('content-security-policy'), 'frame-ancestors https://customer.example');
        const wrapperHtml = await wrapper.text();
        assert.match(wrapperHtml, /name="verentis-parent-origin" content="https:\/\/customer.example"/);
        const referrerMeta = wrapperHtml.match(/<meta name="referrer" content="[^"]+">/)?.[0];
        assert.ok(referrerMeta, 'wrapper declares its document referrer policy');
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage();
            await page.route('https://office.apps.verentis.dev/**', route => route.fulfill({
                contentType: 'text/html',
                headers: { 'Referrer-Policy': wrapper.headers.get('referrer-policy') },
                body: referrerMeta + '<form method="post" action="https://office-code.apps.verentis.dev/browser/dist/cool.html">' +
                    '<input name="access_token" value="synthetic"><button>Open</button></form>',
            }));
            await page.route('https://office-code.apps.verentis.dev/**', route =>
                route.fulfill({ contentType: 'text/html', body: 'CODE' }));
            await page.goto(`https://office.apps.verentis.dev/?embedTicket=${embedTicket}`);
            const [post] = await Promise.all([
                page.waitForRequest(request => request.method() === 'POST'),
                page.getByRole('button', { name: 'Open' }).click(),
            ]);
            const postedHeaders = await post.allHeaders();
            assert.equal(postedHeaders.origin, 'https://office.apps.verentis.dev');
            assert.equal(postedHeaders.referer, 'https://office.apps.verentis.dev/');
            assert.equal(postedHeaders.referer.includes('embedTicket'), false);
        } finally {
            await browser.close();
        }
        assert.equal((await fetch(origin + `/?embedTicket=${embedTicket}&embedTicket=${embedTicket}`,
            { headers: navigationHeaders })).status, 403);
        assert.equal((await fetch(origin + '/?embedTicket=invalid%2Bvalue',
            { headers: navigationHeaders })).status, 403);
        assert.equal((await fetch(origin + '/_ready')).status, 200);
    } finally {
        child.kill('SIGTERM');
        await Promise.all([new Promise(resolve => backend.close(resolve)),
            new Promise(resolve => code.close(resolve))]);
    }
});
