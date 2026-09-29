import assert from 'node:assert/strict';
import { readFileSync, rmSync, statSync } from 'node:fs';
import test from 'node:test';
import { parse, parseAllDocuments } from 'yaml';
import { renderSprint, validate } from '../../scripts/render-sprint.mjs';
import { render } from '../../deploy/render.mjs';
import { provisionProofKey } from '../../scripts/proof-key.mjs';
import { checkPrerequisites } from '../../scripts/check-sprint-prerequisites.mjs';

const id = '12345678-1234-4234-8234-123456789abc';
const env = {
    AZURE_CLIENT_ID: id, AZURE_TENANT_ID: id, AZURE_SUBSCRIPTION_ID: id,
    ACR_NAME: 'acrverentis', ACR_LOGIN_SERVER: 'acrverentis.azurecr.io',
    AKS_CLUSTER_NAME: 'aks-verentis-dev-southafricanorth',
    AKS_RESOURCE_GROUP: 'rg-verentis-platform-dev-southafricanorth',
    PLATFORM_ORIGIN: 'https://api.sprint.verentis.dev',
    EDITOR_IMAGE: `acrverentis.azurecr.io/verentis/office-editor@sha256:${'a'.repeat(64)}`
};
const lock = JSON.parse(readFileSync(new URL('../../deploy/code.lock.json', import.meta.url)));
const workflow = parse(readFileSync(new URL('../../.github/workflows/deploy-sprint.yml', import.meta.url), 'utf8'));
const objects = parseAllDocuments(renderSprint(env)).map(doc => doc.toJS());
const resource = (kind, name) => objects.find(item => item.kind === kind && item.metadata.name === name);
const container = name => resource('Deployment', name).spec.template.spec.containers[0];
const variable = (name, key) => container(name).env.find(entry => entry.name === key);

test('deployment builds only the wrapper and requires operator-managed proof custody, not editor OAuth', () => {
    assert.deepEqual(workflow.on.push.branches, ['feat/**']);
    assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
    assert.equal(workflow.jobs.deploy.if,
        "github.repository == 'verentis/libre-office' && startsWith(github.ref, 'refs/heads/feat/')");
    assert.equal(workflow.jobs.deploy.env.PLATFORM_ORIGIN, '${{ vars.PLATFORM_ORIGIN }}');
    assert.equal(workflow.jobs.deploy.env.CODE_PROOF_KEY, undefined);
    assert.equal(workflow.jobs.deploy.environment, 'sprint');
    assert.equal(workflow.permissions['id-token'], 'write');
    const steps = workflow.jobs.deploy.steps;
    const index = text => steps.findIndex(step => (step.name ?? '').includes(text));
    assert.ok(index('Validate required') < index('Azure login'));
    assert.ok(index('Verify CODE') < index('Build and push editor'));
    assert.ok(index('Check cluster prerequisites') < index('Build and push editor'));
    assert.ok(index('Configure sprint cluster access') < index('Provision persistent CODE proof key'));
    assert.ok(index('Provision persistent CODE proof key') < index('Check cluster prerequisites'));
    const provisioning = steps[index('Provision persistent CODE proof key')];
    assert.equal(provisioning.env.CODE_PROOF_KEY, '${{ secrets.CODE_PROOF_KEY }}');
    assert.equal(provisioning.run, 'node scripts/provision-code-proof.mjs verentis-apps');
    assert.equal(steps.filter(step => JSON.stringify(step).includes('secrets.CODE_PROOF_KEY')).length, 1);
    for (const step of steps.filter(step => step !== provisioning))
        assert.doesNotMatch(JSON.stringify(step), /CODE_PROOF_KEY/);
    assert.match(steps[index('Check cluster prerequisites')].run, /node scripts\/check-sprint-prerequisites\.mjs/);
    assert.match(steps[index('Recheck prerequisites')].run,
        /node scripts\/check-sprint-prerequisites\.mjs\s+node scripts\/render-sprint\.mjs \| kubectl apply/);
    assert.doesNotMatch(JSON.stringify(workflow), /OFFICE_(?:CLIENT_SECRET|CLIENT_ID|PLATFORM_ORIGIN)|backend\.Dockerfile|state-pvc/);
    for (const name of ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID'])
        assert.equal(workflow.jobs.deploy.env[name], `\${{ secrets.${name} }}`);
    assert.equal(steps.filter(step => step.uses === 'docker/build-push-action@v6').length, 1);
});

test('only editor and CODE are exposed; WOPISrc and allowlist name the platform API', () => {
    assert.equal(renderSprint({ ...env, CODE_PROOF_KEY: 'must-not-enter-rendered-artifacts' }), renderSprint(env));
    assert.equal(objects.length, 6);
    assert.equal(resource('Deployment', 'office-wopi'), undefined);
    for (const name of ['office-editor', 'office-code']) {
        const ingress = resource('Ingress', name);
        assert.equal(resource('Service', name).spec.type, 'ClusterIP');
        assert.equal(ingress.spec.ingressClassName, 'nginx');
        assert.equal(ingress.spec.tls[0].hosts[0], ingress.spec.rules[0].host);
        assert.equal(ingress.metadata.annotations['nginx.ingress.kubernetes.io/enable-access-log'], 'false');
        assert.equal(resource('Deployment', name).metadata.namespace, 'verentis-apps');
    }
    const codePaths = resource('Ingress', 'office-code').spec.rules[0].http.paths;
    assert.equal(codePaths[0].path, '/browser');
    assert.equal(codePaths[0].backend.service.name, 'office-editor');
    assert.equal(codePaths[1].backend.service.name, 'office-code');
    assert.equal(container('office-code').image, `${lock.repository}:${lock.tag}@${lock.digest}`);
    assert.match(variable('office-code', 'extra_params').value, /ssl\.ssl_verification=true/);
    assert.doesNotMatch(variable('office-code', 'extra_params').value, /ssl\.ssl_verification=false/);
    assert.equal(variable('office-code', 'aliasgroup1').value, `${env.PLATFORM_ORIGIN}:443`);
    assert.equal(container('office-code').args.at(-1), '--o:net.content_security_policy=frame-ancestors https://office.apps.verentis.dev;');
    assert.equal(container('office-code').command, undefined);
    assert.equal(container('office-code').args.length, 1);
    const codeSecurity = resource('Deployment', 'office-code').spec.template.spec.securityContext;
    assert.equal(codeSecurity.runAsUser, 1001);
    assert.equal(codeSecurity.runAsNonRoot, true);
    assert.equal(codeSecurity.fsGroup, 1001);
    const proof = resource('Deployment', 'office-code').spec.template.spec.volumes.find(volume => volume.name === 'proof');
    assert.equal(proof.secret.secretName, 'office-code-proof');
    assert.equal(proof.secret.defaultMode, 0o440);
    assert.deepEqual(container('office-code').volumeMounts.find(mount => mount.name === 'proof'),
        { name: 'proof', mountPath: '/etc/coolwsd/proof_key', subPath: 'proof_key', readOnly: true });
    assert.equal(variable('office-editor', 'NUXT_COLLABORATION_URL').value, env.PLATFORM_ORIGIN);
    assert.equal(variable('office-editor', 'NUXT_PUBLIC_WOPI_ORIGIN').value, env.PLATFORM_ORIGIN);
    assert.equal(variable('office-editor', 'NUXT_CODE_URL').value, 'http://office-code:9980');
    assert.equal(container('office-editor').volumeMounts, undefined);
});

test('wrong environment, mutable images and bad CODE pins fail closed without Office credentials', () => {
    assert.equal(validate(env), 'sprint');
    for (const key of Object.keys(env).filter(key => !key.endsWith('_IMAGE')))
        assert.throws(() => validate({ ...env, [key]: '' }), new RegExp(key));
    for (const origin of [
        'https://api.uat.verentis.dev', 'https://api.sprint-9.verentis.dev',
        'http://api.sprint.verentis.dev', 'https://api.sprint.verentis.dev/',
        'https://api.sprint.verentis.dev:443', 'not-a-url',
        'https://api.sprint.verentis.dev/path', 'https://api.sprint.verentis.dev?query=1',
        'https://api.sprint.verentis.dev#fragment',
        'https://user:password@api.sprint-9.verentis.dev',
        'https://api.sprint.verentis.dev.evil.invalid', 'https://api.SPRINT.verentis.dev'
    ]) assert.throws(() => renderSprint({ ...env, PLATFORM_ORIGIN: origin }), /sprint platform/);
    for (const origin of [undefined, '', ' ', ` ${env.PLATFORM_ORIGIN}`, `${env.PLATFORM_ORIGIN}\n`])
        assert.throws(() => validate({ ...env, PLATFORM_ORIGIN: origin }), /PLATFORM_ORIGIN/);
    assert.throws(() => validate({ ...env, PLATFORM_ORIGIN: undefined, OFFICE_PLATFORM_ORIGIN: env.PLATFORM_ORIGIN }),
        /PLATFORM_ORIGIN/);
    assert.throws(() => renderSprint({ ...env, EDITOR_IMAGE: 'office-editor:latest' }), /EDITOR_IMAGE/);
    assert.throws(() => renderSprint(env, { ...lock, digest: 'sha256:bad' }), /CODE image/);
    assert.throws(() => renderSprint(env, { ...lock, repository: 'evil.invalid/code' }), /CODE image/);
});

test('regional render keeps strict HTTPS and proof isolation', () => {
    const config = {
        region: 'eu-test', dataRegion: 'eu-test', editorImage: env.EDITOR_IMAGE,
        platformOrigin: env.PLATFORM_ORIGIN, editorOrigin: 'https://office.example.invalid',
        codeOrigin: 'https://code.example.invalid', proofKeyFile: '/operator/office/proof_key'
    };
    const result = render(config);
    assert.deepEqual(Object.keys(result.services), ['editor', 'code']);
    assert.equal(result.services.code.environment.aliasgroup1, `${config.platformOrigin}:443`);
    assert.equal(result.services.editor.environment.NUXT_PUBLIC_WOPI_ORIGIN, config.platformOrigin);
    assert.equal(result.services.editor.volumes, undefined);
    assert.equal(result.services.code.user, '1001:1001');
    assert.equal(result.services.code.entrypoint, undefined);
    assert.equal(result.services.code.command.length, 1);
    assert.equal(result.services.code.volumes[0].target, '/etc/coolwsd/proof_key');
    assert.equal(result.services.code.volumes[0].read_only, true);
    assert.throws(() => render({ ...config, dataRegion: 'other' }));
    assert.throws(() => render({ ...config, platformOrigin: 'http://api.example.invalid' }));
    assert.throws(() => render({ ...config, platformOrigin: 'https://api.example.invalid/path' }));
});

test('proof key persists across restart and rotation requires drained sessions', () => {
    const directory = new URL(`../../artifacts/proof-test-${process.pid}/`, import.meta.url);
    const path = new URL('proof_key', directory).pathname;
    try {
        const current = provisionProofKey(path);
        assert.equal(provisionProofKey(path), current);
        assert.equal(statSync(path).mode & 0o777, 0o600);
        assert.throws(() => provisionProofKey(path, true), /Drain CODE/);
        assert.notEqual(provisionProofKey(path, true, true), current);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('all deployment paths bound CODE storage requests and suppress unsafe logging', () => {
    const regional = render({
        region: 'eu-test', dataRegion: 'eu-test', editorImage: env.EDITOR_IMAGE,
        platformOrigin: env.PLATFORM_ORIGIN, editorOrigin: 'https://office.example.invalid',
        codeOrigin: 'https://code.example.invalid', proofKeyFile: '/operator/office/proof_key'
    }).services.code;
    const sprintEnvironment = Object.fromEntries(container('office-code').env.map(entry => [entry.name, entry.value]));
    for (const environment of [regional.environment, sprintEnvironment]) {
        const options = environment.extra_params.split(/\s+/);
        for (const setting of [
            'net.connection_timeout_secs=120',
            'logging.level=none', 'logging.level_startup=none',
            'logging.most_verbose_level_settable_from_client=none',
            'logging.least_verbose_level_settable_from_client=none',
            'browser_logging=false', 'logging.protocol=false',
            'logging.file[@enable]=false', 'logging_ui_cmd.file[@enable]=false',
            'trace[@enable]=false', 'admin_console.enable=false',
            'logging.lokit_sal_log=-INFO-WARN', 'logging.anonymize.anonymize_user_data=true'
        ]) {
            const prefix = `--o:${setting.slice(0, setting.indexOf('='))}=`;
            assert.deepEqual(options.filter(option => option.startsWith(prefix)), [`--o:${setting}`]);
        }
        assert.equal(environment.SAL_LOG, '-INFO-WARN');
        for (const name of ['COOL_LOGFILE', 'COOL_LOGFILE_UICMD', 'COOL_TRACE_STARTUP'])
            assert.equal(Object.hasOwn(environment, name), false);
    }
    for (const args of [regional.command, container('office-code').args])
        assert.ok(args.every(arg => arg.startsWith('--o:net.content_security_policy=')));
});

test('cluster prerequisites fail closed on missing proof, legacy resources and unreadable cluster state', () => {
    const expected = [
        ['get', 'namespace', 'verentis-apps', '-o', 'name'],
        ['describe', 'secret', 'office-code-proof', '-n', 'verentis-apps'],
        ['get', 'deployment,service,ingress', 'office-wopi', '-n', 'verentis-apps', '--ignore-not-found', '-o', 'name']
    ];
    const run = (responses, calls = []) => args => {
        calls.push(args);
        const response = responses[calls.length - 1];
        if (response instanceof Error) throw response;
        return response;
    };
    const valid = ['namespace/verentis-apps', 'Data\n====\nproof_key:  1704 bytes\n', ''];
    const calls = [];
    assert.doesNotThrow(() => checkPrerequisites(run(valid, calls)));
    assert.deepEqual(calls, expected);
    for (const proof of ['', 'proof_key: 0 bytes\n', 'wrong_key: 1704 bytes\n'])
        assert.throws(() => checkPrerequisites(run([valid[0], proof, ''])), /nonempty proof_key/);
    for (const resource of ['deployment.apps/office-wopi', 'service/office-wopi', 'ingress.networking.k8s.io/office-wopi'])
        assert.throws(() => checkPrerequisites(run([valid[0], valid[1], resource])), /Remove the retired Office WOPI/);
    for (let index = 0; index < valid.length; index++) {
        const responses = [...valid];
        responses[index] = new Error('cluster read failed');
        assert.throws(() => checkPrerequisites(run(responses)), /Cannot verify/);
    }
});
