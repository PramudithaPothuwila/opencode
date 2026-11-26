import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import packageJSON from "../../../package.json"
import config from "../../../cortex.json"
import { isolatedEnv } from "./fixture/environment"
import { cortexDefines } from "../script/cortex"

test("version command reports source metadata and preserves --version", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-version-"))
  try {
    const run = async (...args: string[]) => {
      const child = Bun.spawn([process.execPath, "run", path.join(import.meta.dir, "../src/index.ts"), ...args], {
        cwd: path.join(import.meta.dir, ".."),
        env: isolatedEnv(root),
        stdout: "pipe",
        stderr: "pipe",
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect({ stderr, exitCode }).toEqual({ stderr: "", exitCode: 0 })
      return stdout
    }
    const [plain, builtin, detailed, json] = await Promise.all([
      run("version"),
      run("--version"),
      run("version", "--detailed"),
      run("version", "--json"),
    ])
    expect(plain).toBe("opencode vlocal\n")
    expect(builtin).toBe("opencode vlocal\n")
    expect(JSON.parse(json)).toEqual({
      opencode: { packageVersion: packageJSON.version, runtimeVersion: "local" },
      cortex: { version: config.version, commit: "unknown" },
      upstream: {
        repository: "anomalyco/opencode",
        branch: "dev",
        baseCommit: "unknown",
        currentCommit: "unknown",
        synchronization: "unknown",
      },
    })
    expect(detailed).toContain("OpenCode:\n  Package Version: " + packageJSON.version)
    expect(detailed).toContain("Runtime Version: local")
    expect(detailed).toContain("Cortex Fork:\n  Version: " + config.version)
    expect(detailed).toContain("Upstream:\n  Repository: anomalyco/opencode")
    expect(detailed).toContain("Synchronization: unknown")
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("compiled version handler uses embedded metadata without git", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-compiled-version-"))
  const entry = path.join(root, "entry.ts")
  const executable = path.join(root, process.platform === "win32" ? "version.exe" : "version")
  const snapshot = {
    CORTEX_VERSION: "9.8.7",
    CORTEX_FORK_COMMIT: "1111111111111111111111111111111111111111",
    CORTEX_UPSTREAM_REPOSITORY: "anomalyco/opencode" as const,
    CORTEX_UPSTREAM_BRANCH: "dev" as const,
    CORTEX_UPSTREAM_BASE: "2222222222222222222222222222222222222222",
    CORTEX_UPSTREAM_COMMIT: "3333333333333333333333333333333333333333",
    CORTEX_SYNC_STATUS: "fork-ahead" as const,
  }
  try {
    await Bun.write(
      entry,
      `import { Effect } from ${JSON.stringify(path.join(import.meta.dir, "../node_modules/effect/dist/index.js"))};
import handler from ${JSON.stringify(path.join(import.meta.dir, "../src/commands/handlers/version.ts"))};
import { CORTEX_BUILD } from ${JSON.stringify(path.join(import.meta.dir, "../src/cortex.ts"))};
if (!CORTEX_BUILD) throw new Error("Cortex build flag missing");
await Effect.runPromise(handler({ json: process.argv[2] !== "detailed", detailed: process.argv[2] === "detailed" }));
`,
    )
    const result = await Bun.build({
      entrypoints: [entry],
      compile: { outfile: executable },
      define: cortexDefines(snapshot),
    })
    expect(result.logs).toEqual([])
    expect(result.success).toBe(true)
    const child = Bun.spawn([executable], {
      cwd: root,
      env: isolatedEnv(root, { PATH: "/nonexistent" }),
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect({ stderr, exitCode }).toEqual({ stderr: "", exitCode: 0 })
    const detail = Bun.spawn([executable, "detailed"], {
      cwd: root,
      env: isolatedEnv(root, { PATH: "/nonexistent" }),
      stdout: "pipe",
      stderr: "pipe",
    })
    const [detailOutput, detailError, detailExit] = await Promise.all([
      new Response(detail.stdout).text(),
      new Response(detail.stderr).text(),
      detail.exited,
    ])
    expect({ stderr: detailError, exitCode: detailExit }).toEqual({ stderr: "", exitCode: 0 })
    expect(detailOutput).toContain("OpenCode:\n")
    expect(detailOutput).toContain("Cortex Fork:\n")
    expect(detailOutput).toContain("Upstream:\n")
    expect(detailOutput).toContain("  Commit: 111111111111\n")
    expect(detailOutput).toContain("  Base Commit: 222222222222\n")
    expect(detailOutput).toContain("  Current Commit: 333333333333\n")
    expect(detailOutput).not.toContain(snapshot.CORTEX_FORK_COMMIT)
    expect(JSON.parse(stdout)).toEqual({
      opencode: { packageVersion: packageJSON.version, runtimeVersion: "local" },
      cortex: { version: snapshot.CORTEX_VERSION, commit: snapshot.CORTEX_FORK_COMMIT },
      upstream: {
        repository: snapshot.CORTEX_UPSTREAM_REPOSITORY,
        branch: snapshot.CORTEX_UPSTREAM_BRANCH,
        baseCommit: snapshot.CORTEX_UPSTREAM_BASE,
        currentCommit: snapshot.CORTEX_UPSTREAM_COMMIT,
        synchronization: snapshot.CORTEX_SYNC_STATUS,
      },
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 30_000)
