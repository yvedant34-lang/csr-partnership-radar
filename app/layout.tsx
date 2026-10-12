import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { MobileNav, Sidebar } from "@/app/components/Sidebar";
import { SampleToggle } from "@/app/components/SampleToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { isAdmin, showSample } from "@/lib/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CSR Partnership Radar",
  description: "Which companies to call this week, and why.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [admin, sample, jar] = await Promise.all([isAdmin(), showSample(), cookies()]);
  const theme = (jar.get("radar_theme")?.value ?? "system") as "light" | "dark" | "system";
  const lock = admin ? (
    <form action={logoutAction}><button className="text-xs text-fg-3 underline underline-offset-2 hover:text-fg">Lock editing</button></form>
  ) : (
    <Link href="/login" className="text-xs text-fg-3 underline underline-offset-2 hover:text-fg">Unlock editing</Link>
  );
  return (
    <html lang="en-IN" data-theme={theme === "system" ? undefined : theme} className={inter.className}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <div className="md:grid md:grid-cols-[232px_1fr]">
          <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-line bg-surface px-3 py-4 md:flex">
            <div className="space-y-5">
              <Link href="/" className="block px-2.5">
                <span className="block text-sm font-semibold tracking-tight">CSR Partnership Radar</span>
                <span className="block text-xs text-fg-3">Welfare for Youth</span>
              </Link>
              <Sidebar />
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
              <MobileNav />
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
