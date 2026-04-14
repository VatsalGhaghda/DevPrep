import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center relative overflow-hidden">
      <EnhancedAnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-6 max-w-md"
      >
        {/* Glowing 404 */}
        <div className="text-8xl font-black bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent mb-4 select-none">
          404
        </div>

        {/* Ambient glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <div className="text-2xl font-semibold mb-2">Page not found</div>
          <p className="text-slate-400 text-sm mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold text-sm transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
