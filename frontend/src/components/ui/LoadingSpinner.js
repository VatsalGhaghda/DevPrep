import { motion } from 'framer-motion';

const LoadingSpinner = ({ size = 20, className = '' }) => {
  const ring = {
    width: size,
    height: size,
    borderWidth: Math.max(2, Math.floor(size / 10))
  };

  return (
    <motion.span
      aria-label="Loading"
      className={`inline-block rounded-full border-white/20 border-t-white ${className}`}
      style={ring}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    />
  );
};

export const FullPageLoader = ({ label = 'Loading...' }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-3">
        <LoadingSpinner size={22} />
        <div className="text-sm text-slate-200">{label}</div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
