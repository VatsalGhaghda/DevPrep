import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

export default function SSOCallback() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="text-lg font-semibold">Completing sign in…</div>
          <div className="mt-2 text-sm text-slate-400">Please wait while we finish authentication.</div>
          <div className="mt-6 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        </div>
      </div>

      <AuthenticateWithRedirectCallback />
    </div>
  );
}
