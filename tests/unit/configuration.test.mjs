import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { render } from '../../deploy/render.mjs';

test('deployment rejects omitted or non-string processing region', () => {
    for (const config of [{}, { region: undefined, dataRegion: undefined }, { region: null, dataRegion: null }]) {
        assert.throws(() => render(config), /processing\/data region/);
    }
});

test('local SDK is integrity-pinned and available to standalone checkout and Docker builds', () => {
    const editor = JSON.parse(readFileSync('apps/editor/package.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const archive = editor.dependencies['@verentis/sdk'].replace('file:../../', '');
    assert.match(archive, /^vendor\/sdk\/verentis-sdk-0\.2\.0-[a-f0-9]{12}\.tgz$/);
    const dependency = lock.packages['node_modules/@verentis/sdk'];
    assert.equal(dependency.resolved, `file:${archive}`);
    assert.equal(dependency.integrity, `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`);
    const dockerfile = readFileSync('deploy/editor.Dockerfile', 'utf8');
    assert.ok(dockerfile.indexOf('COPY vendor/sdk/ vendor/sdk/') >= 0);
    assert.ok(dockerfile.indexOf('COPY vendor/sdk/ vendor/sdk/') < dockerfile.indexOf('RUN npm ci'));
});

test('checks and release preparation remain secret-free and do not publish/import/deploy', () => {
    for (const file of ['checks.yml', 'prepare-release.yml']) {
        const text = readFileSync(`.github/workflows/${file}`, 'utf8');
        const workflow = parse(text);
        assert.deepEqual(workflow.permissions, { contents: 'read' });
        assert.doesNotMatch(text, /pull_request_target|secrets\.|docker push|verentis publish|az login/);
        for (const job of Object.values(workflow.jobs)) {
            assert.equal(job.permissions, undefined);
            for (const step of job.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
        }
    }
});

test('CI installs Chromium before running browser-based framing checks', () => {
    for (const file of ['checks.yml', 'deploy-sprint.yml']) {
        const workflow = parse(readFileSync(`.github/workflows/${file}`, 'utf8'));
        for (const job of Object.values(workflow.jobs)) {
            const framing = job.steps.findIndex(step => step.run?.includes('npm run check:framing'));
            assert.ok(framing >= 0, `${file}: framing checks must remain enabled`);
            const dependencies = job.steps.findIndex(step => step.run?.startsWith('npm ci'));
            const browser = job.steps.findIndex(step =>
                step.run === 'npx --no-install playwright install --with-deps chromium');
            assert.ok(dependencies >= 0 && browser > dependencies && browser < framing,
                `${file}: install the locked Playwright browser and system dependencies before framing checks`);
        }
    }
    assert.equal(parse(readFileSync('.github/workflows/checks.yml', 'utf8')).name, 'Tests');
});

test('Office contains no WOPI persistence or backend project authority', () => {
    assert.equal(existsSync('services/backend/Office.Backend.csproj'), false);
    assert.equal(existsSync('services/wopi/Office.Wopi.csproj'), false);
    assert.equal(existsSync('Office.slnx'), false);
    assert.match(readFileSync('LICENSE', 'utf8'), /Apache License/);
});

test('Office requests explicit signed rename/delete consent without ordinary OAuth scopes', () => {
    const manifest = parse(readFileSync('manifests/office.app.yaml', 'utf8'));
    assert.deepEqual(manifest.spec.wopi.operations, ['rename', 'delete']);
    assert.deepEqual(manifest.spec.permissions, []);
    for (const environment of ['local', 'production']) {
        const overlay = parse(readFileSync(`manifests/environments/${environment}.yaml`, 'utf8'));
        assert.deepEqual({ ...manifest.spec.wopi, ...overlay.spec.wopi }.operations, ['rename', 'delete']);
        assert.deepEqual(overlay.spec.permissions, []);
        assert.equal(overlay.spec['hosted-backend'], undefined);
    }
});
