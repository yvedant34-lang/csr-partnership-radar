// Presentation helpers shared by pages. Muted tier colours; red is reserved for hot.
import type { Tier } from "@/lib/config";

export const TIER_STYLE: Record<Tier, { badge: string; dot: string; label: string; column: string }> = {
  hot: { badge: "bg-red-50 text-red-800 ring-1 ring-red-200", dot: "bg-red-600", label: "Hot", column: "Call this week" },
  warm: { badge: "bg-amber-50 text-amber-900 ring-1 ring-amber-200", dot: "bg-amber-500", label: "Warm", column: "Warm up" },
  cold: { badge: "bg-stone-100 text-stone-600 ring-1 ring-stone-200", dot: "bg-stone-400", label: "Cold", column: "Watch" },
};

/** The one-line answer every card leads with. */
export function decision(tier: Tier): string {
  if (tier === "hot") return "Call this week.";
  if (tier === "warm") return "Not yet. Warm up by email and LinkedIn.";
  return "No call.";
}

export const SIGNAL_LABEL: Record<string, string> = {
  partner_search: "Partner search",
  csr_tender_or_eoi: "Tender or EOI",
  new_initiative: "New initiative",
  unspent_csr: "Unspent CSR",
  new_csr_head: "New CSR head",
  event_or_vlog: "Interview or event",
  annual_report_mention: "Annual report",
  other: "Other",
};

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email", linkedin: "LinkedIn", warm_intro: "Warm intro", event: "Meet at an event", phone: "Phone",
};

export const STAGE_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", meeting: "Meeting", proposal: "Proposal", won: "Won", lost: "Lost", parked: "Parked",
};

export function place(l: { city: string | null; state: string | null }): string {
  const parts = [l.city, l.state].filter((p) => p && p !== "India");
  return [...new Set(parts)].join(", ") || "Place not stated";
}

export function withParam(path: string, key: string, value: string | null): string {
  const [base, query = ""] = path.split("?");
  const p = new URLSearchParams(query);
  if (value == null) p.delete(key); else p.set(key, value);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}
