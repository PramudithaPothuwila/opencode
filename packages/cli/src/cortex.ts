import config from "../../../cortex.json"
import packageJSON from "../../../package.json"
import { OPENCODE_VERSION } from "./version"

declare const CORTEX_BUILD: boolean
declare const CORTEX_VERSION: string
declare const CORTEX_FORK_COMMIT: string
declare const CORTEX_UPSTREAM_REPOSITORY: string
declare const CORTEX_UPSTREAM_BRANCH: string
declare const CORTEX_UPSTREAM_BASE: string
declare const CORTEX_UPSTREAM_COMMIT: string
declare const CORTEX_SYNC_STATUS: string

const build = typeof CORTEX_BUILD === "boolean" ? CORTEX_BUILD : false
export { build as CORTEX_BUILD }

export const cortexMetadata = {
  opencode: { packageVersion: packageJSON.version, runtimeVersion: OPENCODE_VERSION },
  cortex: {
    version: typeof CORTEX_VERSION === "string" ? CORTEX_VERSION : config.version,
    commit: typeof CORTEX_FORK_COMMIT === "string" ? CORTEX_FORK_COMMIT : "unknown",
  },
  upstream: {
    repository: typeof CORTEX_UPSTREAM_REPOSITORY === "string" ? CORTEX_UPSTREAM_REPOSITORY : "anomalyco/opencode",
    branch: typeof CORTEX_UPSTREAM_BRANCH === "string" ? CORTEX_UPSTREAM_BRANCH : "dev",
    baseCommit: typeof CORTEX_UPSTREAM_BASE === "string" ? CORTEX_UPSTREAM_BASE : "unknown",
    currentCommit: typeof CORTEX_UPSTREAM_COMMIT === "string" ? CORTEX_UPSTREAM_COMMIT : "unknown",
    synchronization: typeof CORTEX_SYNC_STATUS === "string" ? CORTEX_SYNC_STATUS : "unknown",
  },
}
