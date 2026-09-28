import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function checkPrerequisites(run = args => execFileSync('kubectl', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
})) {
    try {
        run(['get', 'namespace', 'verentis-apps', '-o', 'name']);
    } catch {
        throw new Error('Cannot verify namespace verentis-apps; check cluster access and namespace provisioning.');
    }
    let proof;
    try {
        proof = run(['describe', 'secret', 'office-code-proof', '-n', 'verentis-apps']);
    } catch {
        throw new Error('Cannot verify office-code-proof; provision an independent RSA CODE proof key and check Secret access (docs/operations.md).');
    }
    if (!/^proof_key:\s*[1-9][0-9]* bytes$/m.test(proof))
        throw new Error('office-code-proof must contain a nonempty proof_key; provision the operator-managed RSA CODE proof key (docs/operations.md).');
    let legacy;
    try {
        legacy = run(['get', 'deployment,service,ingress', 'office-wopi', '-n', 'verentis-apps', '--ignore-not-found', '-o', 'name']);
    } catch {
        throw new Error('Cannot verify retired Office WOPI resources; check cluster access before deploying.');
    }
    if (legacy.trim())
        throw new Error('Remove the retired Office WOPI workload, ingress, service and backend credential after draining sessions (docs/operations.md).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        checkPrerequisites();
        console.log('Sprint namespace, CODE proof custody and retired WOPI resource prerequisites verified.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
