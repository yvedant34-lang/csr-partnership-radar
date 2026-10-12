import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { MobileNav, Sidebar } from "@/app/components/Sidebar";
import { SampleToggle } from "@/app/components/SampleToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { unreadNotificationCount } from "@/lib/data";
import { isAdmin, showSample } from "@/lib/session";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CSR Partnership Radar",
  description: "Which companies to call this week, and why.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [admin, sample, jar, unread] = await Promise.all([isAdmin(), showSample(), cookies(), unreadNotificationCount()]);
  const theme = (jar.get("radar_theme")?.value ?? "dark") as "light" | "dark" | "system";
  const lock = admin ? (
    <form action={logoutAction}><button className="text-xs text-fg-3 underline underline-offset-2 hover:text-fg">Lock editing</button></form>
  ) : (
    <Link href="/login" className="text-xs text-fg-3 underline underline-offset-2 hover:text-fg">Unlock editing</Link>
  );
  return (
    <html lang="en-IN" data-theme={theme === "system" ? undefined : theme} className={dmSans.className}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <div className="md:grid md:grid-cols-[232px_1fr]">
          <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-line bg-surface px-3 py-4 md:flex">
            <div className="space-y-5">
              <Link href="/" className="block px-2.5">
                <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />CSR Partnership Radar
                </span>
                <span className="label mt-1 block">Welfare for Youth</span>
              </Link>
              <Sidebar unread={unread} />
            </div>
            <div className="space-y-3 px-2.5">
              <SampleToggle on={sample} />
              <ThemeToggle theme={theme} />
              {lock}
            </div>
          </aside>
          <div className="min-w-0">
            <header className="border-b border-line bg-surface px-4 py-3 md:hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Link href="/" className="text-sm font-semibold">CSR Partnership Radar</Link>
                <div className="flex items-center gap-3"><SampleToggle on={sample} />{lock}</div>
              </div>
              <MobileNav unread={unread} />
            </header>
            {sample && (
              <div className="border-b border-line bg-sample-bg px-4 py-1.5 text-center text-xs text-sample">
                Sample data is on. Rows marked Sample are invented for testing the screens.
              </div>
            )}
            <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
