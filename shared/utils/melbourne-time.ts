// Intl uses the runtime's IANA timezone data, independently of the computer's zone.
export const MELBOURNE_TIME_ZONE = 'Australia/Melbourne'
const formatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
  era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset'
})
const zoneFormatter = new Intl.DateTimeFormat('en-AU', { timeZone: MELBOURNE_TIME_ZONE, timeZoneName: 'short' })
export function melbourneTimeZoneName(value: string | Date): string {
  const name = zoneFormatter.formatToParts(new Date(value)).find(part => part.type === 'timeZoneName')?.value
  return name === 'AEST' || name === 'AEDT' ? name : 'local time'
}

const datePattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/

function parts(instant: Date) {
  return Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]))
}
function calendarMilliseconds(values: Record<string, string>): number {
  const date = new Date(0)
  date.setUTCFullYear(values.era === 'BC' ? 1 - Number(values.year) : Number(values.year), Number(values.month) - 1, Number(values.day))
  date.setUTCHours(Number(values.hour ?? 0), Number(values.minute ?? 0), Number(values.second ?? 0), 0)
  return date.getTime()
}
export function isValidCalendarDate(value: string): boolean {
  if (!datePattern.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export interface MelbourneTimeChoice { utc: string; offset: string }

// Round-trip every candidate: skipped clock times yield zero, repeated times two.
export function melbourneTimeChoices(date: string, time = ''): MelbourneTimeChoice[] {
  if (!isValidCalendarDate(date)) throw new Error('Enter a valid date (years 0001–9999).')
  if (time && !timePattern.test(time)) throw new Error('Enter a valid time, or leave it blank for midnight.')
  const clock = time || '00:00'
  const wallTime = new Date(`${date}T${clock.length === 5 ? `${clock}:00` : clock}Z`).getTime()
  const offsets = new Set<number>()
  // Sample both sides of a possible transition, including historical second offsets.
  for (const hours of [-48, -24, 0, 24, 48]) {
    const sample = wallTime + hours * 3600000
    offsets.add(calendarMilliseconds(parts(new Date(sample))) - Math.floor(sample / 1000) * 1000)
  }
  const choices: MelbourneTimeChoice[] = []
  for (const offset of offsets) {
    const instant = new Date(wallTime - offset), local = parts(instant)
    if (calendarMilliseconds(local) + instant.getUTCMilliseconds() !== wallTime) continue
    const utc = instant.toISOString()
    choices.push({ utc, offset: local.timeZoneName!.replace('GMT', 'UTC') })
  }
  return choices.sort((a, b) => a.utc.localeCompare(b.utc))
}

export function melbourneDateTimeToUtc(date: string, time = '', occurrence = ''): string {
  const choices = melbourneTimeChoices(date, time)
  if (!choices.length) throw new Error('This Melbourne time is skipped when daylight saving starts. Choose a different time.')
  const selected = choices.length === 1 ? choices[0] : choices.find(choice => choice.utc === occurrence)
  if (!selected) throw new Error('This Melbourne time occurs twice when daylight saving ends. Choose its first or second occurrence.')
  if (!/^(?!0000)\d{4}-/.test(selected.utc)) throw new Error('This Melbourne date and time falls outside the supported range (years 0001–9999).')
  return selected.utc
}

export function melbourneInputsFromUtc(value: string) {
  const instant = new Date(value), local = parts(instant)
  const date = `${local.year!.padStart(4, '0')}-${local.month}-${local.day}`
  const time = `${local.hour}:${local.minute}:${local.second}.${String(instant.getUTCMilliseconds()).padStart(3, '0')}`
  // Retain the selected occurrence when an existing timestamp is edited.
  const occurrence = isValidCalendarDate(date) && melbourneTimeChoices(date, time).length > 1 ? instant.toISOString() : ''
  return { date, time, occurrence }
}

export function melbourneCalendarDay(instant: Date): number {
  const local = parts(instant)
  return calendarMilliseconds({ year: local.year!, month: local.month!, day: local.day! })
}

export function formatMelbourneDateTime(value: string, style: 'long' | 'numeric' = 'long'): string {
  const instant = new Date(value), local = parts(instant)
  const date = style === 'numeric' ? `${local.year!.padStart(4, '0')}-${local.month}-${local.day}`
    : new Intl.DateTimeFormat('en-AU', { timeZone: MELBOURNE_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(instant)
  const milliseconds = instant.getUTCMilliseconds()
  return `${date}${style === 'long' ? ', ' : ' '}${local.hour}:${local.minute}:${local.second}${milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : ''} Melbourne time (${melbourneTimeZoneName(instant)})`
}

// DATE values record a calendar day, not an instant that can be shifted.
export function formatCalendarDate(value: string): string {
  if (!isValidCalendarDate(value)) throw new Error('Enter a valid calendar date.')
  return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

export function melbourneDateKey(value: string | Date): string {
  const local = parts(new Date(value))
  return `${local.year!.padStart(4, '0')}-${local.month}-${local.day}`
}

export function melbourneMonthStart(month: string): Date {
  const day = `${month}-01`
  const choices = melbourneTimeChoices(day)
  if (choices.length) return new Date(choices[choices.length - 1]!.utc)
  // Melbourne's adoption of standard time skipped midnight on 1 February 1895.
  // Resolve a historical midnight gap forward, matching PostgreSQL AT TIME ZONE.
  const wallTime = Date.parse(`${day}T00:00:00Z`), before = wallTime - 48 * 3600000
  const offset = calendarMilliseconds(parts(new Date(before))) - before
  return new Date(wallTime - offset)
}
