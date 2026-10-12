// Cheap keyword gate before any Gemini call. Errs on the side of letting items through:
// Gemini decides relevance, this only drops obvious noise (sport, stock tips, foreign news).
const CSR = /\b(csr|corporate social responsibility|social impact|foundation|philanthrop|unspent|schedule vii|nccsr|ngo)\b/i;
const SECTOR = /\b(skill|skilling|education|school|student|scholar|digital|literacy|youth|employ|job|livelihood|training|iti|polytechnic|learning|teacher|classroom|stem|placement|vocational|apprentice)/i;
const POLICY = /\b(ministry of corporate affairs|mca|csr rules|schedule vii|nccsr|companies act|csr amendment|csr policy)\b/i;
const NOISE = /\b(ipl|cricket|football|match|stock forecast|share price|box office|horoscope|tariff|gaza|ukraine)\b/i;
const FOREIGN = /\b(uganda|ghana|kenya|nigeria|nungua|zambia|philippines|malaysia|uae|dubai|saudi|uk|usa)\b/i;

export interface PrefilterResult {
  pass: boolean;
  reason: string;
}

export function prefilter(title: string, snippet?: string | null): PrefilterResult {
  const t = `${title} ${snippet ?? ""}`;
  if (NOISE.test(t)) return { pass: false, reason: "noise keyword" };
  if (FOREIGN.test(t) && !/\bindia\b/i.test(t)) return { pass: false, reason: "outside India" };
  if (POLICY.test(t)) return { pass: true, reason: "policy keyword" };
  // CSR money signals (unspent accounts, spend vs obligation) matter even when no sector is named.
  if (/\bunspent\b/i.test(t)) return { pass: true, reason: "unspent csr" };
  if (CSR.test(t) && /\b(spends?|spent|obligation|crore|lakh)\b/i.test(t)) return { pass: true, reason: "csr spend" };
  if (CSR.test(t) && SECTOR.test(t)) return { pass: true, reason: "csr + sector" };
  if (SECTOR.test(t) && /\b(launch|inaugurat|opens?|centre|center|partner|support|fund|spend|crore|lakh|empower|train|programme|program|initiative|scholarship|lab|academy)/i.test(t)) {
    return { pass: true, reason: "sector + activity" };
  }
  return { pass: false, reason: "no csr or sector signal" };
}
