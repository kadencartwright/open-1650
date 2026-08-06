import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import type { SyncRoom } from "./worker/index";

// The package scripts pin the Patristic personal-account Alchemy profile and
// dev_k stage so deployment never falls through to Wrangler's active account.
export default Alchemy.Stack(
  "open-1650",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // This is the same Build + Worker shape as Website.StaticSite, composed
    // explicitly so the Worker receives the build's output hash string. In
    // Alchemy beta.61, StaticSite passes the whole hash object and its Worker
    // diff compares that object by identity, producing a perpetual update.
    const site = yield* Alchemy.push(
      "Site",
      Effect.gen(function* () {
        const build = yield* Command.Build("Build", {
          command: "npm run build",
          outdir: "dist",
        });
        const syncRooms = Cloudflare.DurableObject<SyncRoom>("SyncRooms", {
          className: "SyncRoom",
        });

        return yield* Cloudflare.Worker("Worker", {
          name: "open-1650",
          domain: "1650.kdn.dev",
          assets: {
            directory: build.outdir,
            hash: build.hash.output,
            runWorkerFirst: ["/api/sync*"],
            htmlHandling: "auto-trailing-slash",
            notFoundHandling: "single-page-application",
          },
          main: "./worker/index.ts",
          env: {
            SYNC_ROOMS: syncRooms,
          },
        });
      }),
    );

    return { siteUrl: site.url };
  }),
);
