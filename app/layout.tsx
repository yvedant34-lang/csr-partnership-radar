import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Nav } from "@/app/components/Nav";
import { SampleToggle } from "@/app/components/SampleToggle";
import { isAdmin, showSample } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSR Partnership Radar",
  description: "Which companies to call this week, and why.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [admin, sample] = await Promise.all([isAdmin(), showSample()]);
  return (
    <html lang="en-IN">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="font-semibold tracking-tight">CSR Partnership Radar</Link>
              <div className="flex items-center gap-3">
                <SampleToggle on={sample} />
                {admin ? (
                  <form action={logoutAction}><button className="text-xs text-stone-600 underline">Lock</button></form>
                ) : (
                  <Link href="/login" className="text-xs text-stone-600 underline">Unlock editing</Link>
                )}
              </div>
            </div>
            <Nav />
          </div>
        </header>
        {sample && (
          <div className="border-b border-violet-200 bg-violet-50 px-4 py-1.5 text-center text-xs text-violet-800">
            Sample data is on. Rows marked Sample are made up for testing the screens.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
