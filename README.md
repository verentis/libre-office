# Libre Office

Nuxt/Vue editor wrapper and pinned self-hosted Collabora CODE. The platform's
Collaboration service owns all WOPI admission, scoped credentials, locks and
durable saves; Office is not a file-storage or OAuth backend.

## Signed installation

`manifests/office.app.yaml` declares WOPI capabilities, supported document formats,
wrapper/operator origins and session/file limits. Local and production overlays
select their corresponding origins. Publish a signed package and approve its
exact document-processing consent candidate before opening a workspace file.
Unsigned packages produced by offline checks cannot authorize a live launch.

No Office OAuth client ID/secret, private signing key or storage credentials are
needed. Third-party WOPI applications use the same installation/launch contract.
Normal applications accessing workspace APIs continue to require normal OAuth.

The public package identity is `verentis/libre-office`, displayed as **Libre
Office** in base, local and production packages. This is a new Marketplace
identity, not a migration of existing `verentis/office` installations. Publish,
install and approve consent for the new signed package explicitly.

## Local development

The repository is [verentis/libre-office](https://github.com/verentis/libre-office).
Keep the checkout directory named `office` alongside `sdk` and `platform`:

```sh
git clone https://github.com/verentis/libre-office.git office
cd office
npm ci
```

The internal `@verentis/office-editor` workspace, AppHost paths, wrapper/CODE
workload names and public DNS origins are unchanged.
Use the platform Aspire host with its documented isolated dependencies and
trusted development certificates. Office runs at `https://office.localtest.me`,
CODE at `https://office-code.localtest.me`, and WOPI callbacks target the platform
gateway. The wrapper's server uses `NUXT_COLLABORATION_URL`, not an Office backend.
Do not start multiple hosts against the same ports/resources.

Install the signed local package with consent, upload a supported document and
open it through the workspace. Direct navigation to the public wrapper is denied
without its platform-issued embed ticket. A hidden form POST transfers only the
scoped WOPI token to the trusted CODE action.

## Verification

```sh
npx playwright install chromium --only-shell
npm run check
npm run check:framing
# With the platform warm stack already started:
npm run test:integration
```

`test:integration` invokes `platform/tests/playwright`'s warm `app-office`
scenario. It must exercise real CODE open/edit/save/reopen, simultaneous sessions
and revocation against changed Collaboration services/assets. Unit tests and
mock framing checks are not end-to-end evidence. Warm resources must be rebuilt
or restarted after source, manifest or vendored SDK changes.

`check:package` validates and packs unsigned offline artifacts only; it does not
publish, install or deploy them. It inspects base/local/production archives for
the Libre Office identity and unchanged WOPI contract. The vendored SDK archive is integrity-pinned in
the lockfile. `npm run fixtures` regenerates document fixtures, not a WOPI host.

## Layout

- `apps/editor` — trusted-parent bridge, dirty/save UX and CODE framing proxy.
- `manifests` — signed-package declarations and environment origins.
- `tests` — browser boundaries, package/deployment contracts and framing checks.
- `deploy`, `k8s` — wrapper/CODE build and workload topology.
- `vendor/sdk` — source-built SDK package used by the wrapper.

## Deployment

The sprint workflow is restricted to `feat/**` branches in
`verentis/libre-office`, including manual dispatch, and retains the `sprint`
environment approval gate. Set the nonsecret environment variable
`PLATFORM_ORIGIN` to the exact sprint HTTPS API origin; Azure deployment
credentials remain secrets. Store one durable RSA private PEM as the
environment secret `CODE_PROOF_KEY`; deployment creates a missing Kubernetes
proof Secret, preserves the same key and rejects accidental rotation. Never
generate a new key per rollout. See the [operator prerequisites](docs/operations.md#sprint-aks-deployment):
the operator retired the sprint `office-wopi` deployment/service/ingress and
provisioned `office-code-proof` on 2026-09-28. Existing wrapper/CODE workloads
were not rolled out; the next CODE deployment must mount the key and verify
signed callbacks. The private key belongs only to CODE, not the wrapper or
platform workloads. Package checks do not deploy these changes.

See [architecture](docs/architecture.md), [API](docs/api.md),
[operations](docs/operations.md), [verification](docs/verification.md) and
[security](SECURITY.md). Apache-2.0 licensing is unchanged. This repository does
not independently establish successful runtime integration or deploy resources.
