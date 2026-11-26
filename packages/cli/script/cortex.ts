import { spawnSync } from "node:child_process"
import path from "node:path"
import { readFile } from "node:fs/promises"
import cortex from "../../../cortex.json"

const root = path.resolve(import.meta.dirname, "../../..")

export async function cortexMetadata(directory = root) {
  const versionPath = path.resolve(
    process.env.CORTEX_PROJECT_DIR ?? path.resolve(directory, "../Cortex"),
    "version.txt",
  )
  const version = await readFile(versionPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" && process.env.CORTEX_PROJECT_DIR === undefined) return cortex.version
    throw error
  })
  const trimmed = version.trim()
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      trimmed,
    )
  ) {
    throw new Error(`Invalid Cortex version in ${versionPath}: ${JSON.stringify(trimmed)}`)
  }
  const git = (...args: string[]) =>
    spawnSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  const hash = (...args: string[]) => {
    const result = git(...args)
    return result.status === 0 ? result.stdout.trim() || "unknown" : "unknown"
  }
  const fork = hash("rev-parse", "--verify", "HEAD^{commit}")
  const upstream = hash("rev-parse", "--verify", "refs/remotes/upstream/dev^{commit}")
  const base = fork !== "unknown" && upstream !== "unknown" ? hash("merge-base", fork, upstream) : "unknown"
  const ahead =
    fork !== "unknown" && upstream !== "unknown" ? git("merge-base", "--is-ancestor", upstream, fork).status : null
  const behind =
    fork !== "unknown" && upstream !== "unknown" ? git("merge-base", "--is-ancestor", fork, upstream).status : null
  const status: "in-sync" | "fork-ahead" | "upstream-ahead" | "diverged" | "unknown" =
    base === "unknown"
      ? "unknown"
      : ahead === 0 && behind === 0
        ? "in-sync"
        : ahead === 0 && behind === 1
          ? "fork-ahead"
          : ahead === 1 && behind === 0
            ? "upstream-ahead"
            : ahead === 1 && behind === 1
              ? "diverged"
              : "unknown"
  return {
    CORTEX_VERSION: trimmed,
    CORTEX_FORK_COMMIT: fork,
    CORTEX_UPSTREAM_REPOSITORY: "anomalyco/opencode" as const,
    CORTEX_UPSTREAM_BRANCH: "dev" as const,
    CORTEX_UPSTREAM_BASE: base,
    CORTEX_UPSTREAM_COMMIT: upstream,
    CORTEX_SYNC_STATUS: status,
  }
}

export function cortexDefines(snapshot: Awaited<ReturnType<typeof cortexMetadata>>): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, JSON.stringify(value)])),
    CORTEX_BUILD: "true",
  }
}
