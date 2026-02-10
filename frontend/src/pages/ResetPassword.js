import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSignIn } from '@clerk/clerk-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stateEmail = location.state && location.state.email ? String(location.state.email) : '';
    setEmail(stateEmail);
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoaded) {
      return;
    }

    if (!email) {
      toast.error('Email is required');
      return;
    }

    if (!code.trim()) {
      toast.error('Code is required');
      return;
    }

    if (!password) {
      toast.error('Password is required');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signIn.create({ identifier: email.trim() });
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        toast.success('Password reset successful');
        navigate('/dashboard');
      } else {
        toast.error('Could not complete password reset');
      }
    } catch (err) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xl font-semibold">Reset Password</div>
        <div className="mt-2 text-sm text-slate-300">Set a new password for your account.</div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Reset code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              type="text"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              autoComplete="one-time-code"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">New password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Confirm password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>

          <button
            type="button"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            onClick={() => navigate('/login')}
          >
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
