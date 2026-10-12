// Indian formats: Rs, crore and lakh, IST times, dates like 12 Oct 2026.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_MS = 330 * 60_000;

const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

export function formatInr(cr: number | null | undefined): string {
  if (cr == null || Number.isNaN(cr)) return "Not stated";
  if (cr >= 1) return `Rs ${trim(cr)} Cr`;
  return `Rs ${trim(cr * 100)} lakh`;
}

function ist(iso: string | Date) {
  return new Date(new Date(iso).getTime() + IST_MS);
}

export function formatDate(iso: string | Date): string {
  const t = ist(iso);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

export function formatShortDate(iso: string | Date): string {
  const t = ist(iso);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
}

export function formatTimeIst(iso: string | Date): string {
  const t = ist(iso);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")} IST`;
}

export function formatDateTimeIst(iso: string | Date): string {
  return `${formatDate(iso)}, ${formatTimeIst(iso)}`;
}
