"use client";

type AuthMessageProps = {
  error?: string | null;
  success?: string | null;
};

export function AuthMessage({ error, success }: AuthMessageProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <div className={`rounded-[8px] border px-3 py-2 text-xs font-semibold ${error ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>
      {error || success}
    </div>
  );
}
