// IST date maths. "This week" is always computed at read time from now(), never stored.
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Calendar fields of an instant as seen in IST. */
export function istParts(d: Date) {
  const t = new Date(d.getTime() + IST_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() || 7 }; // dow: Mon=1..Sun=7
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (p: { y: number; m: number; d: number }) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;

/** Items posted in the last 7 days count as this week. */
export function thisWeekCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - 7 * DAY_MS);
}

/** Due date for a new call task: today if it is Monday in IST, otherwise the next Monday. */
export function comingMonday(now: Date = new Date()): string {
  const p = istParts(now);
  const add = p.dow === 1 ? 0 : 8 - p.dow;
  return ymd(istParts(new Date(now.getTime() + add * DAY_MS)));
}

/** Monday 00:00 IST of the week containing `d`, as a Date. */
export function weekStartIst(d: Date): Date {
  const p = istParts(d);
  const midnightIst = Date.UTC(p.y, p.m - 1, p.d) - IST_MS;
  return new Date(midnightIst - (p.dow - 1) * DAY_MS);
}

/** ISO week label in IST, e.g. 2026-W42. */
export function isoWeek(d: Date = new Date()): string {
  const p = istParts(d);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d));
  t.setUTCDate(t.getUTCDate() + 4 - p.dow); // Thursday of this week decides the year
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return `${year}-W${pad(week)}`;
}

/** Monday 00:00 IST for an ISO week label. */
export function weekLabelToDate(label: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const mondayUtc = Date.UTC(year, 0, 4 - (jan4Dow - 1) + (week - 1) * 7);
  return new Date(mondayUtc - IST_MS);
}

/** January to March: boards approve next year's CSR action plans. */
export function isActionPlanSeason(now: Date = new Date()): boolean {
  return istParts(now).m <= 3;
}
