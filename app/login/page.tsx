import { LoginForm } from "@/app/login/LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">Unlock editing</h1>
      <p className="text-sm text-stone-600">Anyone with the link can read the radar. Changing stages, drafting, finding contacts and settings need the passcode.</p>
      <LoginForm next={safeNext} />
    </div>
  );
}
