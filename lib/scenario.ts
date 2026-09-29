import { scenarios, type ScenarioId, type WorkationRequest } from './data';

// Changes Laura makes in this session. The client applies them for the UI; the API applies the same
// edits so the agent explains the request Laura is actually looking at.
export type Edits = {
  dates?: { start: string; end: string };
  confirmed?: string[]; // rule ids Laura confirmed, e.g. 'past-dates'
  reopen?: string[]; // step ids reopened by a change of dates
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RULES = ['past-dates', 'year-mismatch'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function workingDays(start: string, end: string) {
  if (!ISO.test(start) || !ISO.test(end) || end < start) return 0;
  let n = 0;
  for (let d = parse(start); d <= parse(end); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6 !== 0) n++;
  return n;
}

export function datesLabel(start: string, end: string) {
  const a = parse(start), b = parse(end);
  const day = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${day(a)} ${a.getUTCFullYear()} to ${day(b)} ${b.getUTCFullYear()}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${day(a)} to ${day(b)} ${b.getUTCFullYear()}`;
  return `${a.getUTCDate()} to ${day(b)} ${b.getUTCFullYear()}`;
}

export function formatDay(iso: string) {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Never trust edits from the request body: keep only well-formed values
export function cleanEdits(e: unknown): Edits {
  const x = (e ?? {}) as Edits;
  const out: Edits = {};
  if (x.dates && ISO.test(x.dates.start) && ISO.test(x.dates.end) && workingDays(x.dates.start, x.dates.end) > 0) out.dates = { start: x.dates.start, end: x.dates.end };
  if (Array.isArray(x.confirmed)) out.confirmed = x.confirmed.filter((id) => RULES.includes(id));
  if (Array.isArray(x.reopen)) out.reopen = x.reopen.filter((id) => id === 'mgr');
  return out;
}

export const editsKey = (e: Edits) => JSON.stringify([e.dates?.start, e.dates?.end, [...(e.confirmed ?? [])].sort(), e.reopen ?? []]);

export function applyEdits(r: WorkationRequest, e: Edits): WorkationRequest {
  const out: WorkationRequest = JSON.parse(JSON.stringify(r));
  if (e.dates) {
    const days = workingDays(e.dates.start, e.dates.end);
    out.dates = { ...e.dates, label: datesLabel(e.dates.start, e.dates.end) };
    out.workingDays = days;
    out.daysAbroad = { ...out.daysAbroad, thisTrip: days, year: Number(e.dates.start.slice(0, 4)) };
  }
  if (e.confirmed?.length) {
    out.confirmedRules = [...e.confirmed];
    // Dates confirmed as correct: the balance is shown for the year of the trip
    if (e.confirmed.includes('past-dates')) out.daysAbroad = { ...out.daysAbroad, year: Number(out.dates.start.slice(0, 4)) };
  }
  for (const id of e.reopen ?? []) {
    out.steps = out.steps.map((s) => (s.id === id ? { ...s, state: 'Waiting', meta: 'Tom Weber · asked to re-approve the new dates' } : s));
  }
  return out;
}

export function loadScenario(id: unknown, edits?: unknown) {
  const key = (typeof id === 'string' && id in scenarios ? id : 'ready') as ScenarioId;
  return applyEdits(scenarios[key].build(), cleanEdits(edits));
}
