import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

const manifests = readdirSync('manifests').filter(file => file.endsWith('.yaml'));
assert.deepEqual(manifests, ['office.app.yaml']);
const manifest = parse(readFileSync('manifests/office.app.yaml', 'utf8'));
const assertIdentity = metadata => {
    assert.equal(metadata.name, 'libre-office');
    assert.equal(metadata['package-id'], 'libre-office');
    assert.equal(metadata['display-name'], 'Libre Office');
};
assertIdentity(manifest.metadata);
assert.ok(manifest.spec['mime-types'].length > 0);
assert.deepEqual(manifest.spec.permissions, []);
assert.deepEqual(manifest.spec.capabilities, ['wopi']);
assert.equal(manifest.metadata.labels['integration-status'], 'consent-required');
assert.equal(manifest.spec['hosted-backend'], undefined);
assert.ok(manifest.spec.wopi.files.length > 0);
assert.deepEqual(manifest.spec.wopi.operations, ['rename', 'delete']);
const local = parse(readFileSync('manifests/environments/local.yaml', 'utf8'));
assert.equal(local.metadata['display-name'], 'Libre Office');
assert.equal(local.metadata.labels['integration-status'], 'local-preview');
const production = parse(readFileSync('manifests/environments/production.yaml', 'utf8'));
assert.equal(production.metadata['display-name'], 'Libre Office');
assert.equal(production.metadata.labels['integration-status'], 'production');
assert.equal(production.spec.entry, 'https://office.apps.verentis.dev');
assert.deepEqual(production.spec.capabilities, ['wopi']);
assert.equal(production.spec['hosted-backend'], undefined);
assert.equal(production.spec.wopi['editor-origin'], production.spec.entry);
assert.deepEqual(production.spec.permissions, []);
execFileSync(process.execPath, ['scripts/sync-formats.mjs', '--check'], { stdio: 'inherit' });
assert.deepEqual(local.spec.permissions, []);
mkdirSync('artifacts/packages', { recursive: true });
for (const env of ['base', 'local', 'production']) {
    const overlayArgs = env === 'base' ? [] : ['--env', env];
    execFileSync('node_modules/.bin/verentis', ['validate', 'manifests', ...overlayArgs], { stdio: 'inherit' });
    const output = execFileSync('node_modules/.bin/verentis',
        ['pack', 'manifests', ...overlayArgs, '--no-sign', '--out', `artifacts/packages/${env}`],
        { encoding: 'utf8' });
    process.stdout.write(output);
    assert.ok(output.includes(`Packed verentis/libre-office@${manifest.metadata.version} (Application)`));
    const path = output.match(/^\s+(.+\.vpkg)$/m)?.[1].trim();
    assert.ok(path, 'CLI must report the packed artifact path');
    const packed = parse(execFileSync('tar', ['-xOzf', path, 'manifest.yaml'], { encoding: 'utf8' }));
    const metadata = parse(execFileSync('tar', ['-xOzf', path, '.verentis/package.yaml'], { encoding: 'utf8' }));
    assertIdentity(packed.metadata);
    assert.equal(metadata.name, 'libre-office');
    assert.equal(metadata.publisher, 'verentis');
    assert.equal(metadata['display-name'], 'Libre Office');
    const selected = env === 'local' ? local : env === 'production' ? production : manifest;
    assert.equal(packed.spec.entry, selected.spec.entry);
    assert.deepEqual(packed.spec.capabilities, ['wopi']);
    assert.deepEqual(packed.spec.permissions, []);
    assert.equal(packed.spec['hosted-backend'], undefined);
    assert.deepEqual(packed.spec.wopi, { ...manifest.spec.wopi, ...selected.spec.wopi });
    assert.deepEqual(packed.spec['mime-types'], selected.spec['mime-types']);
}
