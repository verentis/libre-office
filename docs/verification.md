# Verification and handoff evidence

## Platform-owned cutover — 2026-09-27

The historical evidence below describes the removed Office-owned WOPI/synthetic
architecture and **does not validate the platform-owned cutover**.

Verified after removing all Office backend/WOPI source and project files:

| Command / scope | Observed result |
| --- | --- |
| SDK `npm test && npm run typecheck && npm run build` | 84 tests passed; types and ESM/CJS/declaration builds passed |
| Workspace app-host, registry, WOPI bridge and continuation tests; `npm run typecheck` | 32 tests passed; typecheck passed |
| Office `npm run check` | Typecheck, 23 unit tests, local/production manifest validation and unsigned packaging, deployment rendering and 5 deployment tests passed |
| Office `npm run check:framing` | Production wrapper build and 1 built HTTP framing integration test passed |
| Office `npm run test:browser-boundaries` | 7 Chromium tests passed: nested-ancestor CSP, save receipt gating, nonsecret Save As/continuation, revoked submission, failure recovery, wrong-target rejection and target expiry |
| Office and SDK `git diff --check` | Passed |

The framing tests use mock upstream authorization/editor resources; they prove
wrapper boundaries, not real CODE editing. The browser maps the actual nested
Collaboration response, uses only explicit approved WOPI installation selection,
and preserves exact generation/correlation receipts across later coauthor writes.

Real warm `app-office` open/edit/save/reopen/coauthor/revoke execution remains
required against changed Collaboration and hosting assets. No live runtime
success, deployment, or Software Factory verification is claimed here.

### Save-confirmation diagnostic — 2026-09-27 15:49 warm trace

The real CODE trace contains `Received Host_PostmessageReady.` and the wrapper's
save acknowledgement. All 41 authenticated status responses were `ready` with
`receipt: null`; all three successful checkpoint requests recorded generation 1.
The wrapper therefore correctly withheld durable confirmation.

The pinned CODE source accepts the current `Action_Save` flags and forwards
`ExtendedData` through its save command:
[Map.WOPI.js](https://github.com/CollaboraOnline/online.mirror/blob/825c9caa93da8651971522ba82a80fa0777539c0/browser/src/map/handler/Map.WOPI.js#L695-L703).
The focused built-wrapper Chromium regression requires that handshake and wire
shape, then proves CODE acknowledgement plus `Modified=false` cannot clear dirty
until a matching platform receipt arrives. Ordinary save and Save As tests both
passed; all 9 boundary unit tests passed. These tests use mock CODE/platform
resources and do not claim live persistence success. No runtime production
code or confirmation security rule was changed for this diagnostic.

### Save As HTML interaction

The wrapper now handles trusted CODE `UI_SaveAs` with an accessible HTML filename
form. Local checks passed: 11 boundary unit tests, Nuxt typecheck and production
build, and the 7 Chromium boundary tests above. The browser tests exercise the
built wrapper against mock CODE/platform resources, including spoof rejection,
cancel without a command, invalid path rejection, exact `Filename`/`Notify`
fields, revoked submission, failed-operation recovery, and retained edits while
waiting for authoritative continuation. They do not claim real CODE acceptance.

The separate platform `app-office-operations` scenario uses the actual HTML form;
its 4 local contract checks, harness typecheck and test discovery passed.
The parent owns loading the updated wrapper and running the warm scenario after
the core/restart scenario finishes. No warm execution or service restart was
performed for this UI change.

### Nonsecret continuation across signing-key rotation

Workspace now adopts `/derived`'s exact persisted target control IDs directly.
The SDK returns only document metadata and target `accessTokenTtl`; no public
target launch or token reconstruction occurs. Office retains the initial form
and CODE iframe/token while separately updating active document metadata.

Verified locally: SDK 84 tests/typecheck/build; workspace admission/continuation
21 tests and typecheck; Office 16 boundary/configuration tests, typecheck/build
and 7 Chromium tests. The recovery-denial mock now succeeds without touching a
reconstruction callback. Malformed, expired, credential-bearing and wrong-scope
continuations fail closed; Chromium verifies the target deadline independently
of the retained source launch and preserves later edits through rebinding.
The vendor archive is `verentis-sdk-0.2.0-b72fdeb675b6.tgz`.

These are local boundary checks, not a new real-key-rotation or warm acceptance
claim. The parent owns the backend expiry DTO field and warm execution.

### Real Save As readiness diagnosis — 2026-09-27

Authorized `app-office-operations` runs on warm coordinator `1743304` reproduced
a post-rename reload race: CODE received the correct trusted `Action_SaveAs`
while `_appLoaded` was false and sent no `saveas` socket command. The wrapper now
tracks `Frame_Ready`, permits filename entry while loading, and gates dispatch
on CODE's supported `Get_Views_Resp` readiness response.

The final real run passed outcomes 1-4. At `2026-09-27T18:26:15.728Z`, CODE received
`Action_SaveAs` with the expected filename, `Notify=true`, `_appLoaded=true` and
`UserCanNotWriteRelative=false`; its actual `saveas` socket command followed at
`18:26:15.729Z`. CODE then reported `storage / savefailed` from `18:26:28.677Z`.
All observed authenticated `/derived` responses remained 204. Outcomes 5-6
therefore remain unverified pending the parent's storage investigation.

Sanitized evidence is in the scenario's `office-operation-categories.json`;
the pre-fix summary is `outcomes/save-as-readiness-before.json`. No trace/video,
credentials, full messages or token-bearing URLs were recorded. No backend or
stack configuration was changed, and no services were restarted.

## Historical evidence (superseded architecture)

Executed locally on **2026-09-23**, Linux amd64, Node 24.14.0, .NET SDK 10.0.111,
Docker Engine 29.5.3. Baseline Office commit:
`a49ccce0bf3bbc1e28bd64783d0aa8174f57e794`.
No commit, publication, registry import, cloud provisioning or live deployment
was performed. Apache-2.0 LICENSE is unchanged.

## Local Aspire follow-up (2026-09-23)

Office baseline `52cf80b464bee96437a71d17b0936adc3e1e645a`; platform baseline
`0f809e6b8dd33f75f73161b02ace7f1928ef5a3e`. Existing unrelated platform Execution
changes were left untouched.

Commands below were actually executed. Platform commands are relative to its
repository; Office commands are relative to Office unless stated otherwise.

| Command | Observed result |
| --- | --- |
| `scripts/setup-certs.sh --export-ca-only` (platform) | Exported existing public mkcert CA; no trust installation or leaf regeneration |
| `dotnet test utilities/deployment/Verentis.Deployment.Tests --filter 'FullyQualifiedName~LocalFrontendRouting\|FullyQualifiedName~LocalOffice' --nologo -v quiet` (platform) | 41 passed, 0 failed/skipped: exact routes, sibling path, run/publish/test models, image lock, missing prerequisites, hostname/server-EKU checks, wrong CA and safe public-only export |
| `dotnet build "src/0 - Aspire/Verentis.AppHost" --no-restore --nologo -v quiet` (platform) | Passed, 0 errors; existing warnings include platform AutoMapper 14.0.0 advisory NU1903 and nullable warnings |
| `dotnet build utilities/local-office --nologo -v quiet` (platform) | Passed, 0 warnings/errors |
| `npm run check` | Types, 8 Node tests, released CLI validation/packing of local/compose/production overlays and deployment checks passed |
| `dotnet test --nologo -v quiet` | 26 protocol tests passed |
| `TMPDIR="$PWD/office/artifacts/aspire" dotnet run --no-build --project platform/utilities/local-office` (workspace root, after creating the artifact directory) | Actual Aspire-owned Nuxt, CODE, harness and shared TLS YARP started and became responsive; only Office-focused resources started by this command |
| `curl --noproxy '*' --cacert platform/scripts/.certs/rootCA.pem https://office.localtest.me/_ready` (workspace root) | Trusted HTTPS 200, `{"status":"ready"}` |
| `NODE_EXTRA_CA_CERTS="$PWD/../platform/scripts/.certs/rootCA.pem" npm run test:aspire` | 2 passed: trusted browser HTTPS, discovery, real WSS, DOCX edit/save, fresh context reopen/re-edit preserving both markers, denied live admission/foreign origins; runtime log assertions passed |
| `docker compose -f dev/compose.yaml up --build -d && node scripts/wait-stack.mjs` | Existing standalone localhost stack rebuilt and became responsive |
| `npm run test:integration -- --grep 'docx: real CODE\|harness rejects'` | 2 passed, including durable DOCX save and fresh reopen after restarting both Compose harness and CODE |
| `git diff --check` (both repositories) | Passed |

Runtime Docker inspection additionally confirmed the locked CODE digest, strict
`ssl.ssl_verification=true`, configured OpenSSL trust and a single read-only mount
containing **only the public CA**. The gateway's network alias resolves callbacks
inside Aspire's Docker network; an unknown hostname returned 404 in the focused
host. Browser tests did not use `ignoreHTTPSErrors` or certificate-error flags.
During implementation, the browser test correctly failed when the outbound
OpenSSL trust file was omitted; explicit OpenSSL and storage CA configuration
fixed the callback handshake without weakening verification.
Final review also found plaintext synthetic WOPI tokens in YARP informational
proxy logs. Office registration now raises both ASP.NET and YARP logging to
Warning. A restarted focused host passed the browser suite's new checks of
gateway, CODE and WOPI stdout/stderr, with no credential-bearing URLs. No
credential values are included in this evidence document.

This is end-to-end evidence for the **focused Aspire host using the same
registration helper**, not a claim that the full platform was started or that
source-string tests prove runtime behavior. The normal AppHost compiled and its
registration/routing is regression-tested. Full-platform startup was deliberately
not launched to avoid affecting unrelated services. The existing six-format
Compose suite above is historical evidence; this change reran the targeted DOCX
and admission cases, not every format. Aspire and Compose validation resources
were stopped afterwards; named synthetic state volumes were preserved.
Raw Aspire browser results are in ignored `artifacts/aspire/browser-results.json`.
No system/browser CA trust was changed, and live integration remains blocked.

## Passed commands

All commands run from the Office repository root:

| Command | Observed result |
| --- | --- |
| `npm ci --no-audit --no-fund && npm run check` | Clean install; Nuxt/Vue/TS type checks, 6 Node tests, two manifest profiles and deployment renders pass |
| `npm run build` | Nuxt production output built |
| `dotnet test --verbosity quiet` | 26 passed, 0 failed/skipped |
| `npm run fixtures` | Six original OOXML/ODF fixtures generated; deterministic ZIP timestamps |
| `node scripts/verify-code-lock.mjs` | Public registry index bytes independently SHA-256 hashed; all three platform digests match lock |
| `docker compose -f dev/compose.yaml up --build -d` | One real CODE, one SQLite harness, wrapper and local-TLS proxy started |
| `node scripts/wait-stack.mjs` | Wrapper, CODE discovery and WOPI harness responsive over local HTTPS |
| `npm run test:integration` | 11 real-browser tests pass; no editor mock |
| `docker build -f deploy/backend.Dockerfile -t office-backend:check .` | Deployable backend built separately from test host |
| `node scripts/check-images.mjs office-backend:check office-synthetic-editor` | Non-root image contents exclude harness/data; real backend denies live/test admission; default wrapper test API unavailable |
| `npm audit --audit-level=high` | 0 reported npm vulnerabilities at verification time |
| `dotnet list package --vulnerable --include-transitive` | No known vulnerable package reported by current NuGet sources |
| `git diff --check` | No whitespace errors; `git diff -- LICENSE` empty |

The image check references the same deployable wrapper Dockerfile used by the
isolated stack, run with its **default production configuration**, not the
synthetic environment override. No test executable is present in either
deployable image. No image-vulnerability scan or runtime production certification
is implied by package audits or source/image-content checks.

## Real CODE format results

Runtime: official CODE `26.04.4.1.1`, pinned index
`sha256:1efda3043e8b9cb437d1b6c6efe20cc3753760e634de012b8dac391da488bf97`;
Playwright 1.58.2 with Chromium 145.0.7632.6.

| Synthetic format | Discovery/editor load | Browser edit → durable content | Fresh context reopen |
| --- | --- | --- | --- |
| DOCX | PASS | Typed unique marker found in saved OOXML | PASS, after restarting **both harness and CODE** |
| ODT | PASS | Typed unique marker found in saved ODF | PASS |
| XLSX | PASS | Marker typed into A2, found in saved OOXML | PASS |
| ODS | PASS | Marker typed into A2, found in saved ODF | PASS |
| PPTX | PASS | Text box created/edited in real UI, marker found in OOXML | PASS |
| ODP | PASS | Text box created/edited in real UI, marker found in ODF | PASS |

Each file is generated from an original minimal fixture, not a customer sample.
Tests inspect SQLite-backed content through the test executable, not browser
state; a separate browser context reopens the same synthetic ID, asserts that
identity, makes another edit and saves it. The resulting bytes must contain both
the original and new markers, proving that the reopened editor retained the
earlier content rather than merely re-reading the original test-store endpoint. Only DOCX
additionally cold-restarts both services. This is basic round-trip evidence,
not format-fidelity, large-file, accessibility or collaboration certification.
Runtime on arm64/ppc64le has not been tested despite digest verification.

The five other browser cases cover denied identity/origin/format and live
admission, plus the public SDK ready/init handshake through a real local
synthetic parent, wrapper and CODE grandchild. The host token sentinel is
asserted absent from network requests; a parent-origin CODE-like message cannot
mark the child dirty. Compose logs are checked for plaintext WOPI credentials
and the host-token sentinel. Additional cases verify expiry and explicit discard
confirmation, missing save acknowledgement, and child readiness/dirty reporting
while SDK initialization is delayed. Browser traces are intentionally not captured.

## Matrix coverage

| Plan row | Passing evidence |
| --- | --- |
| Live launch | SDK browser handshake + explicit unavailable state; image smoke tests and protocol test: 503, no document/credential |
| Isolated launch | Six real discovery/edit/save/reopen/re-edit cases; invalid format/origin/identity rejected, including missing/foreign origins through the Nuxt proxy and empty upstream 404 propagation |
| WOPI access | Wrong credential, duplicate token, file/workspace/branch, expired and read-only cases deny access/mutation |
| Concurrent save | Real SQLite transactions: two sessions and two HTTP writers produce one 200/one 409; authoritative bytes retained; stale same-token requests also conflict |
| Restart/expiry | SQLite reopen preserves versions/locks/sessions; expired authorization remains denied; lock expiry never renews session; DOCX cold restart/reopen; expired UI disables saves and requires explicit confirmation to discard |
| Navigation | Genuine edits activate the dirty warning and cancel a synthetic unload event; warning survives saves; delayed handshake preserves dirty reporting; missing save response times out; host-veto limitation remains |

Review regression coverage also proves that `X-WOPI-OldLock` cannot authorize
refresh/unlock with a mismatching current lock, a stalled discovery body reaches
its 15-second deadline, inspection does not mint sessions, admission prunes
expired sessions, and omitted deployment regions fail rendering.

Raw local machine output is under ignored `artifacts/` (including
`browser-results.json`, unsigned packages and fake-digest rendering fixtures).
CI produces the same evidence artifact, but **GitHub-hosted/fork CI itself was
not executed here**. Workflow actions are commit-pinned, checkout persistence is
disabled, permissions are contents-read only, and checks require no secrets or
OIDC/cloud grants.
The manual release-preparation workflow now preserves the actual built image
archive plus checksum and source commit rather than losing images with the
runner. This workflow has not been executed on GitHub; registry publication,
import and deployment remain unavailable.

## Deliberately blocked or not certified

- Real Verentis gates **B–E remain blocked**, exactly as documented in
  [compatibility](compatibility.md). Synthetic tests replace none of them.
- No live read-only/editing, installation consent/delegation, conditional Node
  upload, stable-ID/branch routing or production credential renewal is implemented.
- No production state store, multi-replica coordination, navigation veto,
  durable-save acknowledgement, scale, regional deployment or drain certification.
- Final image scans, full history/secret review, transitive redistribution
  notices/source obligations and owner publication/legal approval remain release
  gates. CODE remains a development edition, not a support or licensing promise.
- Local CA trust and disabled CODE outbound TLS verification are synthetic-only.
  The reusable render output intentionally has no ingress and CODE is blocked.
  It is not a ready-to-deploy live installation.

All manifest MIME/capability/permission claims remain empty despite the six
synthetic successes. Release preparation is manual, unsigned and non-publishing;
OIDC/import/promotion belong to a separately authorized platform-owned workflow.
