import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import cortex from "../../../cortex.json"
import { initRepo } from "../../core/test/fixture/git"
import { cortexDefines, cortexMetadata } from "../script/cortex"
import { mainConfig } from "../vite.node.config"
import { nodeTarget } from "../src/node/target"

test("captures git ancestry and build defines", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "cortex-build-"))
  const dir = path.join(fixture, "opencode")
  await mkdir(dir)
  const override = process.env.CORTEX_PROJECT_DIR
  delete process.env.CORTEX_PROJECT_DIR
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" })
    if (result.status !== 0) throw new Error(result.stderr)
    return result.stdout.trim()
  }
  try {
    expect(await cortexMetadata(dir)).toMatchObject({
      CORTEX_FORK_COMMIT: "unknown",
      CORTEX_UPSTREAM_COMMIT: "unknown",
      CORTEX_UPSTREAM_BASE: "unknown",
      CORTEX_SYNC_STATUS: "unknown",
    })
    await initRepo(dir)
    const root = git("rev-parse", "HEAD")
    expect((await cortexMetadata(dir)).CORTEX_SYNC_STATUS).toBe("unknown")
    git("update-ref", "refs/remotes/upstream/dev", root)
    const synced = await cortexMetadata(dir)
    expect(synced).toEqual({
      CORTEX_VERSION: cortex.version,
      CORTEX_FORK_COMMIT: root,
      CORTEX_UPSTREAM_REPOSITORY: "anomalyco/opencode",
      CORTEX_UPSTREAM_BRANCH: "dev",
      CORTEX_UPSTREAM_BASE: root,
      CORTEX_UPSTREAM_COMMIT: root,
      CORTEX_SYNC_STATUS: "in-sync",
    })
    git("commit", "--allow-empty", "-m", "fork")
    const fork = git("rev-parse", "HEAD")
    expect((await cortexMetadata(dir)).CORTEX_SYNC_STATUS).toBe("fork-ahead")
    git("checkout", "--detach", root)
    git("commit", "--allow-empty", "-m", "upstream")
    const upstream = git("rev-parse", "HEAD")
    git("update-ref", "refs/remotes/upstream/dev", upstream)
    git("checkout", "--detach", root)
    expect((await cortexMetadata(dir)).CORTEX_SYNC_STATUS).toBe("upstream-ahead")
    git("checkout", "--detach", fork)
    const diverged = await cortexMetadata(dir)
    expect(diverged.CORTEX_SYNC_STATUS).toBe("diverged")
    expect(diverged.CORTEX_UPSTREAM_BASE).toBe(root)
    git("checkout", "--orphan", "unrelated")
    git("commit", "--allow-empty", "-m", "unrelated")
    expect(await cortexMetadata(dir)).toMatchObject({ CORTEX_UPSTREAM_BASE: "unknown", CORTEX_SYNC_STATUS: "unknown" })
    const defines = cortexDefines(diverged)
    expect(defines.CORTEX_BUILD).toBe("true")
    for (const [key, value] of Object.entries(diverged)) expect(defines[key]).toBe(JSON.stringify(value))
    const input = {
      version: "test",
      channel: "test",
      assetHash: "test",
      target: nodeTarget(process.platform, process.arch),
    }
    expect(mainConfig(input).define?.CORTEX_BUILD).toBeUndefined()
    expect(mainConfig({ ...input, cortex: diverged }).define).toMatchObject(defines)
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        'import { cortexMetadata } from "./script/cortex.ts"; console.log(JSON.stringify(await cortexMetadata(process.argv[1])))',
        dir,
      ],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: { ...process.env, PATH: path.join(dir, "missing-bin") },
        encoding: "utf8",
      },
    )
    expect(child.status).toBe(0)
    expect(JSON.parse(child.stdout)).toMatchObject({
      CORTEX_FORK_COMMIT: "unknown",
      CORTEX_UPSTREAM_COMMIT: "unknown",
      CORTEX_UPSTREAM_BASE: "unknown",
      CORTEX_SYNC_STATUS: "unknown",
    })
  } finally {
    if (override === undefined) delete process.env.CORTEX_PROJECT_DIR
    else process.env.CORTEX_PROJECT_DIR = override
    await rm(fixture, { recursive: true, force: true })
  }
}, 30_000)

test("reads and validates the Cortex version at build time", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "cortex-version-"))
  const dir = path.join(fixture, "opencode")
  const sibling = path.join(fixture, "Cortex")
  const override = process.env.CORTEX_PROJECT_DIR
  delete process.env.CORTEX_PROJECT_DIR
  try {
    await mkdir(dir)
    expect((await cortexMetadata(dir)).CORTEX_VERSION).toBe(cortex.version)
    await mkdir(sibling)
    for (const version of ["2.3.4", "1.2.3-alpha.1+build.001"]) {
      await writeFile(path.join(sibling, "version.txt"), version + "\n")
      expect((await cortexMetadata(dir)).CORTEX_VERSION).toBe(version)
    }
    for (const version of ["", "01.2.3", "1.02.3", "1.2.03", "1.2.3-01", "1.2.3+", "v1.2.3"]) {
      await writeFile(path.join(sibling, "version.txt"), version)
      await expect(cortexMetadata(dir)).rejects.toThrow("Invalid Cortex version")
    }
    process.env.CORTEX_PROJECT_DIR = path.join(fixture, "missing")
    await expect(cortexMetadata(dir)).rejects.toThrow()
    process.env.CORTEX_PROJECT_DIR = sibling
    await writeFile(path.join(sibling, "version.txt"), "3.4.5")
    expect((await cortexMetadata(dir)).CORTEX_VERSION).toBe("3.4.5")
  } finally {
    if (override === undefined) delete process.env.CORTEX_PROJECT_DIR
    else process.env.CORTEX_PROJECT_DIR = override
    await rm(fixture, { recursive: true, force: true })
  }
})
