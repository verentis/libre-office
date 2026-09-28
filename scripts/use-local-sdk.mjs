import { mkdir, readFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const sdk = process.argv[2];
if (!sdk) throw new Error('Usage: node scripts/use-local-sdk.mjs /absolute/path/to/sdk');
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'vendor/sdk');
await mkdir(destination, { recursive: true });
for (const [cwd, args] of [
    [resolve(sdk), ['run', 'build']],
    [resolve(sdk), ['pack', '--pack-destination', destination]],
]) {
    const result = spawnSync('npm', args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
}
const packed = resolve(destination, 'verentis-sdk-0.2.0.tgz');
const hash = createHash('sha256').update(await readFile(packed)).digest('hex').slice(0, 12);
const filename = `verentis-sdk-0.2.0-${hash}.tgz`;
await rename(packed, resolve(destination, filename));
const install = spawnSync('npm', ['install', '--save-exact', '--ignore-scripts',
    '--no-audit', '--no-fund', `file:../../vendor/sdk/${filename}`],
    { cwd: resolve(root, 'apps/editor'), stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);
