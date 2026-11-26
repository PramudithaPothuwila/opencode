import { NodeServices } from "@effect/platform-node"
import { EffectFlock } from "@opencode/util/effect-flock"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { Effect, Stream } from "effect"
import { ChildProcessSpawner } from "effect/process"
import { Command } from "effect/cli"
import { Commands } from "../../src/commands/commands"
import upgrade from "../../src/commands/handlers/upgrade"
import { Updater } from "../../src/services/updater"

await Effect.runPromise(
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const updater = yield* Updater.Service.pipe(
      Effect.provide(Updater.layer),
      Effect.provide(LayerNode.compile(LayerNode.group([Global.node, EffectFlock.node]))),
      Effect.provideService(
        AppProcess.Service,
        AppProcess.Service.of({
          ...spawner,
          run: () => Effect.die("Unexpected update command"),
          runStream: () => Stream.die("Unexpected update command"),
        }),
      ),
    )
    if (process.argv[2] === "command") {
      yield* Command.runWith(Commands.commands.upgrade.spec.pipe(Command.withHandler(upgrade)), { version: "test" })(
        process.argv.slice(3),
      ).pipe(Effect.provideService(Updater.Service, updater))
      return
    }
    const run = yield* updater.run(() => {
      throw new Error("Unexpected install")
    })
    const check = yield* updater.check()
    const errors = yield* Effect.forEach(
      [
        updater.apply("2.0.0"),
        updater.upgrade("curl", "2.0.0"),
        updater.upgrade("winget", "2.0.0"),
        updater.latest("winget"),
        updater.latest("npm"),
        updater.managed(),
      ],
      (effect) => Effect.flip(effect),
    )
    console.log(JSON.stringify({ run: run ?? null, check, errors: errors.map((error) => error.message) }))
  }).pipe(Effect.provide(NodeServices.layer)),
)
