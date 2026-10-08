# Local SDK package

`verentis-sdk-0.2.0-<content-hash>.tgz` is the explicit, unreleased SDK artifact used by this
Office integration. Include it with the source change set so a standalone
checkout, CI and the editor Dockerfile can resolve the same package.
Its content-derived filename avoids stale npm file-package caching.
`package-lock.json` pins its SHA-512 integrity. Its MIT license is included
inside the archive.

The active dependency is `verentis-sdk-0.2.0-dd1dccceebef.tgz`, shared
byte-for-byte with Excalidraw. Its SHA-256 is
`dd1dccceebef44ae3d7f9063d091627ab65910426a7bb09d782a5cb6d893b34e`.
Other content-hashed archives preserve historical verification inputs; the editor
manifest and lockfile select only the active artifact.

To refresh from an explicitly chosen SDK checkout with dependencies installed:

```sh
node scripts/use-local-sdk.mjs /absolute/path/to/sdk
```

Review the SDK source changes and archive/lockfile changes together. This does
not publish a package, fetch private source during CI, or establish a runtime
link to a sibling repository.
