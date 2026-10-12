type Extraction = Pick<import("@/lib/gemini").Extraction, "poc_name" | "poc_designation">;

/** Contacts come only from the source text: drop any name Gemini returns that the text does not contain. */
export function pocFromSource(ex: Extraction, sourceText: string): { name: string | null; designation: string | null } {
  const name = ex.poc_name?.trim();
  if (!name) return { name: null, designation: null };
  const hay = sourceText.toLowerCase().replace(/\s+/g, " ");
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  const found = hay.includes(name.toLowerCase()) || (parts.length >= 2 && parts.every((p) => hay.includes(p)));
  return found ? { name, designation: ex.poc_designation?.trim() || null } : { name: null, designation: null };
}
