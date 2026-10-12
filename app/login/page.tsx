import { LoginForm } from "@/app/login/LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="max-w-sm space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Unlock editing</h1>
      <p className="text-sm text-fg-2">Anyone with the link can read the radar. Changing stages, drafting, finding contacts and settings need the passcode.</p>
      <LoginForm next={safeNext} />
    </div>
  );
}
