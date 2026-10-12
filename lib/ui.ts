// Presentation helpers shared by pages. Muted tier colours; red is reserved for hot.
import type { Tier } from "@/lib/config";

export const TIER_STYLE: Record<Tier, { badge: string; dot: string; text: string; label: string; column: string }> = {
  hot: { badge: "bg-hot-bg text-hot", dot: "bg-hot", text: "text-hot", label: "Hot", column: "Call this week" },
  warm: { badge: "bg-warm-bg text-warm", dot: "bg-warm", text: "text-warm", label: "Warm", column: "Warm up" },
  cold: { badge: "bg-cold-bg text-cold", dot: "bg-cold", text: "text-cold", label: "Cold", column: "Watch" },
};

/** The one-line answer every card leads with. */
export function decision(tier: Tier): string {
  if (tier === "hot") return "Call this week.";
  if (tier === "warm") return "Not yet. Warm up by email and LinkedIn.";
  return "No call.";
}

/** The headline for a lead page: the tier decides while the lead is new, the stage decides after that. */
export function leadDecision(tier: Tier, stage: string): string {
  switch (stage) {
    case "contacted": return "Contacted. Follow up once if there is no reply.";
    case "meeting": return "Meeting stage. Send the proposal next.";
    case "proposal": return "Proposal sent. Get the decision date.";
    case "won": return "Won. Get the invoice signed.";
    case "invoice_signed": return "Invoice signed.";
    case "ghosted": return "Ghosted. One last try on a different channel, then park.";
    case "lost": return "Lost.";
    case "parked": return "Parked.";
    default: return decision(tier);
  }
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
  new: "New", contacted: "Contacted", meeting: "Meeting", proposal: "Proposal", won: "Won",
  invoice_signed: "Invoice signed", lost: "Lost", ghosted: "Ghosted", parked: "Parked",
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
