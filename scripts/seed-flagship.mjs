// Seed the flagship race attempt into the ledger through the REAL pipeline
// (Redpanda -> event-service consumer -> Postgres), so the /demo flagship
// result card is ledger-derived, never hardcoded. Idempotent: event-service
// dedupes by eventId (the UUIDv7 primary key), so re-running inserts nothing.
//
// Source: film/flagship-slice.json — the committed export of attempt 019f744d
// (label flagship-take-1: Normal + hostiles, blue wins in 660.6s, honest-race
// CLEAN, zero deaths). Regenerate the slice from a live ledger with:
//   curl "localhost:8081/events?aggregate-type=Attempt&aggregate-id=019f744d-471a-70bd-819d-bb9eec22bd72&limit=100"
// (then drop each row's recordedAt — event-service stamps a fresh one).
//
// Usage: node scripts/seed-flagship.mjs   (or `task demo` runs it for you)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONTAINER = process.env.REDPANDA_CONTAINER ?? 'ai-civilization-engine-redpanda-1'
const slicePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'film', 'flagship-slice.json')

const events = JSON.parse(readFileSync(slicePath, 'utf8'))

let produced = 0
for (const event of events) {
  const { topic, aggregateId } = event
  if (!topic || !aggregateId) {
    console.error(`skip ${event.eventId}: missing topic/aggregateId`)
    continue
  }
  // One newline-delimited record per event, keyed by aggregateId so the
  // attempt's events keep their partition order. The envelope is produced
  // verbatim; the mapper reads the Kafka topic (the `topic` field is ignored
  // on ingest — kept here only to route the produce).
  execFileSync('docker', ['exec', '-i', CONTAINER, 'rpk', 'topic', 'produce', topic, '-k', aggregateId], {
    input: JSON.stringify(event) + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'ignore', 'inherit'],
  })
  produced++
}

console.log(
  `seeded ${produced}/${events.length} flagship events onto the ledger ` +
    '(idempotent — event-service dedupes re-runs by eventId)',
)
