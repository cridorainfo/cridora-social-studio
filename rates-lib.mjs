// Shared by serve.mjs (local) and refresh-rates.mjs (the scheduled GitHub job).
// Reads public pages only. No keys, no accounts.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
export const KT_URL = 'https://www.khaleejtimes.com/gold-forex'
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

export async function fetchCridoraRates(origin = 'https://cridora.com') {
  const r = await fetch(`${origin.replace(/\/$/, '')}/api/pricing/public/`, {headers: {accept: 'application/json'}, signal: AbortSignal.timeout(20000)})
  if (!r.ok) throw new Error(`Cridora rates HTTP ${r.status}`)
  const d = await r.json()
  if (!d?.gold?.sell || !d?.silver?.sell) throw new Error('Cridora rates incomplete')
  return d
}

// Khaleej Times shows "Silver Rate (AED)" for Al Kananah, a silver jeweller in Dubai.
// The table row is [label, morning, evening, yesterday] in AED per kilo.
export function parseKhaleejSilver(html) {
  const sec = html.indexOf('id="uae-silver"')
  if (sec < 0) throw new Error('Silver section not found')
  const part = html.slice(sec, sec + 6000)
  const row = part.match(/<tr><td>Kilo \(AED\)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/)
  if (!row) throw new Error('Silver row not found')
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) && n > 0 ? n : null }
  const [morning, evening, yesterday] = [num(row[1]), num(row[2]), num(row[3])]
  const kilo = evening ?? morning
  if (!kilo) throw new Error('Silver price missing')
  const dm = part.replace(/<!--.*?-->/g, '').match(/<b>([A-Za-z]+) (\d{1,2}),<\/b>\s*(\d{4})/)
  if (!dm) throw new Error('Silver date not found')
  const mi = MONTHS.indexOf(dm[1].toLowerCase())
  if (mi < 0) throw new Error('Silver date not valid')
  const as_of = `${dm[3]}-${String(mi + 1).padStart(2, '0')}-${String(dm[2]).padStart(2, '0')}`
  return {
    rate: Math.round(kilo) / 1000,            // AED per gram, 3 decimals
    yesterday: yesterday ? Math.round(yesterday) / 1000 : null,
    session: evening ? 'evening' : 'morning',
    as_of,
    source: 'khaleejtimes',
    via: 'Al Kananah, Dubai',
    source_url: KT_URL,
  }
}

export async function fetchSilverRetail() {
  const r = await fetch(KT_URL, {headers: {'user-agent': UA, accept: 'text/html'}, signal: AbortSignal.timeout(25000)})
  if (!r.ok) throw new Error(`Khaleej Times HTTP ${r.status}`)
  return parseKhaleejSilver(await r.text())
}

// A retail reading must sit above the market-based Cridora silver rate and not absurdly far above it.
export function plausibleSilverRetail(sr, cridoraSilverSell) {
  if (!sr?.rate || !cridoraSilverSell) return false
  return sr.rate >= cridoraSilverSell * 0.98 && sr.rate <= cridoraSilverSell * 1.8
}
