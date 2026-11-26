import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { cortexMetadata } from "../../cortex"

export default Runtime.handler(
  Commands.commands.version,
  Effect.fn("cli.version")(function* (input) {
    if (input.json) {
      process.stdout.write(JSON.stringify(cortexMetadata, null, 2) + "\n")
      return
    }
    if (!input.detailed) {
      process.stdout.write(`opencode v${cortexMetadata.opencode.runtimeVersion}\n`)
      return
    }
    const info = cortexMetadata
    process.stdout.write(
      `OpenCode:\n  Package Version: ${info.opencode.packageVersion}\n  Runtime Version: ${info.opencode.runtimeVersion}\n\n` +
        `Cortex Fork:\n  Version: ${info.cortex.version}\n  Commit: ${info.cortex.commit.slice(0, 12)}\n\n` +
        `Upstream:\n  Repository: ${info.upstream.repository}\n  Branch: ${info.upstream.branch}\n` +
        `  Base Commit: ${info.upstream.baseCommit.slice(0, 12)}\n  Current Commit: ${info.upstream.currentCommit.slice(0, 12)}\n` +
        `  Synchronization: ${info.upstream.synchronization}\n\n` +
        "Upstream information reflects local refs at build time and may be stale.\n",
    )
  }),
)
