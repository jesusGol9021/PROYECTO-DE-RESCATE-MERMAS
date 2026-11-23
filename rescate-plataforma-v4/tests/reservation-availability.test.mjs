import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const api = readFileSync(new URL('../app/api/reservations/route.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
test('reservation API locks and updates lot before inserting reservation', () => {
  assert.match(api, /\.for\('update'\)/)
  assert.ok(api.indexOf("set({ status: 'reserved' })") < api.indexOf('tx.insert(reservations)'))
  assert.match(api, /if \(!reserved\) throw new Error\('ALREADY_RESERVED'\)/)
})
test('future scheduled lots cannot be reserved', () => {
  assert.match(api, /donation.availableFrom > now/)
  assert.match(ui, /new Date\(item.availableFrom\).getTime\(\)>Date.now\(\)/)
})
test('API reports actionable conflicts', () => {
  for (const reason of ['NOT_STARTED','ALREADY_RESERVED','EXPIRED','CANCELLED']) assert.match(api, new RegExp(reason))
})
