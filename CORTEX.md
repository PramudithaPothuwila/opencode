# Cortex fork

## Versioning

`../Cortex/version.txt` is the canonical SemVer version. Update it before release and rebuild both projects. Set `CORTEX_PROJECT_DIR` at build time for a different Cortex checkout; a missing explicit version file fails the build. If the default sibling version file is missing, builds fall back to `cortex.json`. Malformed or unreadable files fail the build. Keep `cortex.json` current for fallback and source execution. Do not change the root `package.json` version or the OpenCode runtime constants in `packages/cli/src/version.ts` for a Cortex release; those remain upstream OpenCode metadata. Rebuild after changing the fork version.

## Build metadata

Bun and Node builds embed fork metadata at build time: the local `HEAD`, `upstream/dev`, its merge base with `HEAD`, and their synchronization status. Git refs are read locally; builds do not fetch. Upstream metadata may therefore be stale. Missing Git data produces `unknown`. Detached `HEAD` is supported. Binaries do not query Git at runtime.

Source execution reads the fork version from `cortex.json`; commit hashes and synchronization are `unknown`. The upstream repository and branch remain `anomalyco/opencode` and `dev`.

## Version output

`opencode version` prints the same runtime version as `opencode --version`. `opencode version --detailed` reports OpenCode package/runtime versions, Cortex version/commit, and upstream repository, branch, base/current commits, and synchronization status. `opencode version --json` prints the same metadata as structured JSON with full commit hashes.

## Build commands

Run from `packages/cli`:

```sh
bun script/build.ts --single --skip-install
bun script/build-node.ts --skip-install
```

These commands invoke the build scripts directly. Turbo does not track the external sibling version file in its cache inputs. When building through Turbo after changing that file, use `--force` or disable the cache.

Both scripts accept `--outdir=<path>` for build output. `--skip-install` skips dependency installation; it does not install dependencies for you.

## Updates

Compiled Cortex artifacts disable OpenCode automatic and manual self-updates. Source execution retains upstream updater behavior. External installers and package managers can still replace the same path. Custom builds and releases require manual rebuilding and installation.
