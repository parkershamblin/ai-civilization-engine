// Isolated 3D spectator sidecar for the /demo world view (Panel 1) — OPT-IN.
//
// ONE non-racer mineflayer bot + prismarine-viewer bird's-eye, on its own port
// and its own OS PROCESS. That process isolation is the whole point: the
// fleet-lethal MC 1.21.6 particle-packet crash in prismarine-viewer 1.33.0
// (docs/demo-rb.md) runs in-process with the racers today, so any viewer crash
// takes the whole minecraft-service down. Here a crash can only take down THIS
// process — the racer fleet in minecraft-service is untouched. The dashboard
// aggregator probes this port; when it drops, the world-view slot fails over to
// the 2D ledger map within one poll.
//
// Reality check: this will NOT actually render until upstream ships MC 1.21.6
// support (prismarine-viewer issue #473 / PR #475 are open + unreleased as of
// July 2026). Until then it connects, crashes on the trail particle, exits, and
// the 2D map stands in. It is built and wired now so it's ready the day
// upstream catches up — the demo never depended on it.
//
// Usage: npm run pov:spectator   (or `task demo:pov`). Nothing starts it
// automatically; `task demo` leaves it OFF.
import mineflayer, { type Bot } from 'mineflayer'
import { loadConfig } from '../src/config.ts'
import { logger } from '../src/logging.ts'

const config = loadConfig()
const viewerPort = Number(process.env.POV_SPECTATOR_PORT ?? 3200)
const username = process.env.POV_SPECTATOR_NAME ?? 'Spectator'
const viewDistance = Number(process.env.POV_SPECTATOR_VIEW_DISTANCE ?? 6)

logger.info(
  { host: config.MC_HOST, port: config.MC_PORT, version: config.MC_VERSION, viewerPort },
  'pov spectator connecting (isolated process — a crash here never touches the fleet)',
)

const bot = mineflayer.createBot({
  host: config.MC_HOST,
  port: config.MC_PORT,
  version: config.MC_VERSION,
  username,
  auth: 'offline',
  viewDistance: 'tiny',
})

bot.once('spawn', async () => {
  try {
    // Lazy import — the heavy three.js/express dep loads only when the sidecar
    // runs. `canvas` is the noop2 alias (browser renders); Node stays headless.
    const viewer = (await import('prismarine-viewer')) as unknown as {
      mineflayer: (bot: Bot, opts: { port: number; firstPerson: boolean; viewDistance: number }) => void
    }
    // firstPerson: false -> third-person bird's-eye for the demo slot (the film
    // rig uses first person). Port 3200 sits outside the 3100-3105 racer pool.
    viewer.mineflayer(bot, { port: viewerPort, firstPerson: false, viewDistance })
    logger.info({ viewerPort }, 'pov spectator viewer up')
  } catch (err) {
    logger.error({ err: String(err) }, 'pov spectator viewer failed to start — exiting (fleet unaffected)')
    process.exit(1)
  }
})

bot.on('error', (err) => {
  logger.error({ err: String(err) }, 'pov spectator bot error — exiting')
  process.exit(1)
})

bot.on('end', (reason) => {
  logger.warn({ reason }, 'pov spectator disconnected — exiting')
  process.exit(0)
})

// The 1.21.6 packet-decode crash surfaces here; exiting drops the probe port so
// the dashboard fails over to the 2D map. In-process this same throw would be
// fleet-lethal — that is exactly what the separate process contains.
process.on('uncaughtException', (err) => {
  logger.error({ err: String(err) }, 'pov spectator uncaught exception — exiting (fleet unaffected)')
  process.exit(1)
})
