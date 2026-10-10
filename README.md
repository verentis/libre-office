# Libre Office

Installer-facing listing: [Marketplace README](manifests/marketplace/README.md). Development documentation continues below.

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
Clone it with its default `libre-office` directory name alongside `sdk` and
`platform`. The platform also supports the legacy sibling name `office`:

```sh
git clone https://github.com/verentis/libre-office.git
cd libre-office
npm ci
```

The internal `@verentis/office-editor` workspace, runtime resource identities,
wrapper/CODE workload names and public DNS origins are unchanged.
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

The GitHub **Tests** workflow checks packages, deployment configuration, framing
and the wrapper image without deployment credentials. Both it and the sprint
deployment install Chromium and its system dependencies before framing tests.

```sh
npx playwright install chromium --only-shell
npm run check
npm run check:framing
# With the platform warm stack already started:
npm run test:integration
npm run test:integration:operations
```

Set `VERENTIS_PLATFORM_ROOT` when the warm stack runs in a different checkout,
for example `VERENTIS_PLATFORM_ROOT=../platform.excalidraw npm run test:integration`.
Relative paths resolve from this repository, not the shell's working directory.
The selected checkout must own the ready warm environment; an invalid explicit
path fails rather than attaching to another stack. Set `VERENTIS_OFFICE_RESTART=true`
for the core scenario to verify Node/Collaboration restart before reopening.
An isolated collaboration service chain without Azure AI Search may explicitly
set `VERENTIS_OFFICE_API_UPLOAD=true`. This uploads the DOCX through the signed-in
CLI's normal workspace-scoped Node API and verifies the stored bytes before opening
real CODE; it does not claim the Search-backed directory/upload UI was exercised.

`test:integration` invokes `platform/tests/playwright`'s warm `app-office`
scenario. It must exercise real CODE open/edit/save/reopen, simultaneous sessions
and revocation against changed Collaboration services/assets. Unit tests and
mock framing checks are not end-to-end evidence. Warm resources must be rebuilt
or restarted after source, manifest or vendored SDK changes.

`check:package` validates and packs unsigned offline artifacts only; it does not
publish, install or deploy them. It inspects base/local/production archives for
the Libre Office identity and unchanged WOPI contract. The vendored SDK archive is integrity-pinned in
the lockfile. `npm run fixtures` regenerates document fixtures, not a WOPI host.

After the `feat/**` sprint deployment rolls out the current commit's editor
image and verifies both live endpoints, `.github/workflows/deploy-sprint.yml`
submits a signed production-overlay package from `manifests/` via publisher
GitHub OIDC. A failed deployment skips publication. Configure the protected
`sprint` environment, organization secrets
`SPRINT_API_URL` and `PUBLISHER_SIGNING_KEY` (CLI JSON signing key), and publisher
federation trust for this repository. The shared workflow derives the package
version from GitVersion; `GitVersion.yml` labels `feat/*` releases as
prereleases without a pinned base.
This manifest-only package needs no npm build;
`checks.yml` still builds and verifies the wrapper independently. Publication
does not deploy CODE or the wrapper, install the package, or grant WOPI consent.
`prepare-release.yml` remains manual and offline. New Sprint listings are
Private until a separate public-readiness review authorizes visibility.

## Layout

- `apps/editor` — trusted-parent bridge, dirty/save UX and CODE framing proxy.
- `manifests` — signed-package declarations and environment origins.
- `tests` — browser boundaries, package/deployment contracts and framing checks.
- `deploy`, `k8s` — wrapper/CODE build and workload topology.
- `apps/editor` consumes the published `@verentis/sdk` package from npm.

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
