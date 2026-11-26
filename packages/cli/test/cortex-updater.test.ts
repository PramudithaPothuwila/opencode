import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { isolatedEnv } from "./fixture/environment"

test("Cortex blocks official updates and manual upgrade paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cortex-updater-"))
  try {
    const invoke = async (...args: string[]) => {
      const child = Bun.spawn(
        [
          process.execPath,
          "--define",
          "CORTEX_BUILD=true",
          "--define",
          'OPENCODE_CHANNEL="stable"',
          "--define",
          'OPENCODE_VERSION="2.0.0"',
          path.join(import.meta.dir, "fixture/cortex-updater.ts"),
          ...args,
        ],
        {
          env: isolatedEnv(root, { OPENCODE_DISABLE_AUTOUPDATE: undefined }),
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      return { stdout, stderr, exitCode }
    }
    const direct = await invoke()
    expect(direct.exitCode).toBe(0)
    const result = JSON.parse(direct.stdout)
    expect(result.run).toBeNull()
    expect(result.check.type).toBe("unavailable")
    expect(result.check.message).toContain("Rebuild Cortex")
    expect(result.errors).toHaveLength(6)
    for (const error of result.errors) expect(error).toContain("Rebuild Cortex")
    for (const args of [
      ["--method", "winget"],
      ["3.0.0", "--method", "curl"],
      ["2.0.0", "--method", "curl"],
      ["2.0.0"],
      [],
    ]) {
      const command = await invoke("command", ...args)
      expect(command.exitCode).not.toBe(0)
      expect(command.stdout + command.stderr).toContain("Rebuild Cortex")
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
