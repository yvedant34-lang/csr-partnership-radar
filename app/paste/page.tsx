import Link from "next/link";
import { PasteForm } from "@/app/paste/PasteForm";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Paste() {
  const admin = await isAdmin();
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Paste a link</h1>
        <p className="mt-1 text-sm text-stone-600">
          For posts the daily search cannot see: LinkedIn calls for NGO partners, company CSR pages, WhatsApp forwards.
          The text goes through the same Gemini reading and the same scoring rules. Contacts are taken only from the text.
        </p>
      </div>
      {!admin && <p className="text-sm text-stone-600"><Link href="/login?next=/paste" className="underline">Enter the passcode</Link> to add leads.</p>}
      <PasteForm disabled={!admin} />
    </div>
  );
}
