import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ open, title, children, onClose, footer }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="text-base font-semibold text-slate-100 truncate">{title}</div>
              <button
                type="button"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
                onClick={onClose}
              >
                <X className="w-4 h-4 text-slate-200" />
              </button>
            </div>

            <div className="px-5 py-4 text-sm text-slate-200">{children}</div>

            {footer && <div className="px-5 py-4 border-t border-white/10">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
