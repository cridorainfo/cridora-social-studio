// Writes rates.json: the public Cridora rates plus the silver retail reading.
//   node refresh-rates.mjs [out.json]
// Used by the scheduled GitHub job. If the silver source fails or looks wrong, the previous
// silver reading is kept (the page shows its date and ignores it once it is older than 2 days).
import {readFile, writeFile} from 'node:fs/promises'
import {fetchCridoraRates, fetchSilverRetail, plausibleSilverRetail} from './rates-lib.mjs'

const out = process.argv[2] || 'rates.json'
let previous = {}
try { previous = JSON.parse(await readFile(out, 'utf8')) } catch {}

const feed = await fetchCridoraRates(process.env.CRIDORA_ORIGIN || 'https://cridora.com')   // throws on failure: nothing is written

let sr = null
try {
  const got = await fetchSilverRetail()
  if (plausibleSilverRetail(got, feed.silver.sell)) sr = {...got, fetched_at: new Date().toISOString()}
  else console.log(`::warning::Silver retail ${got.rate} rejected against Cridora silver ${feed.silver.sell}`)
} catch (e) {
  console.log(`::warning::Silver retail not refreshed: ${e.message}`)
}
if (!sr && previous.silver_retail) sr = previous.silver_retail
if (sr) feed.silver_retail = sr

await writeFile(out, JSON.stringify(feed))
console.log(`rates ${feed.updated_at}  gold ${feed.gold.sell}  silver ${feed.silver.sell}  silver retail ${sr ? `${sr.rate} (${sr.as_of} ${sr.session})` : 'none'}`)
