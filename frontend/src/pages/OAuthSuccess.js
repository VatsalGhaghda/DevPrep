import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const OAuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      toast.error('OAuth failed');
      navigate('/login');
      return;
    }

    localStorage.setItem('token', token);
    toast.success('Logged in successfully');
    navigate('/dashboard');
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xl font-semibold">Completing login…</div>
        <div className="mt-2 text-sm text-slate-300">Please wait.</div>
      </div>
    </div>
  );
};

export default OAuthSuccess;
