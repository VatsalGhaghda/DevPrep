import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { createPortal } from 'react-dom';

const Navbar = ({ brand = 'DevPrep', activeLabel = 'Dashboard', onOpenMobileSidebar, links = [], onNavigate, avatarUrl }) => {
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const userButtonRef = useRef(null);
  const portalMenuRef = useRef(null);
  const [userMenuPos, setUserMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';

  const effectiveAvatar = avatarUrl || user?.imageUrl || '';

  useEffect(() => {
    const onDocClick = (e) => {
      if (portalMenuRef.current && portalMenuRef.current.contains(e.target)) return;
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useLayoutEffect(() => {
    if (!userMenuOpen) return;

    const updatePos = () => {
      const el = userButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const menuWidth = 208;
      const gutter = 8;
      const rawLeft = rect.right - menuWidth;
      const clampedLeft = Math.max(gutter, Math.min(rawLeft, window.innerWidth - menuWidth - gutter));

      setUserMenuPos({
        top: rect.bottom + 10,
        left: clampedLeft,
        width: rect.width
      });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [userMenuOpen]);

  const renderLinks = (className) => {
    return (
      <div className={className}>
        {links.map((l) => (
          <button
            key={l.path}
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate(l.path);
              setMobileMenuOpen(false);
            }}
            className="px-3 py-2 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            {l.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 py-3 lg:px-6 lg:py-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
            onClick={() => {
              if (onOpenMobileSidebar) onOpenMobileSidebar();
            }}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 text-slate-300" />
          </button>

          <div className="min-w-0">
            <div className="text-lg lg:text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent truncate">
              {brand}
            </div>
            <div className="text-xs lg:text-sm text-slate-400 truncate">{activeLabel}</div>
          </div>
        </div>

        {renderLinks('hidden lg:flex items-center gap-1')}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
          </button>

          <div className="relative" ref={userMenuRef}>
            <button
              ref={userButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt="Avatar"
                  className="w-7 h-7 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-violet-600/35 to-indigo-600/20 border border-white/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {(user?.firstName?.[0] || user?.username?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <div className="text-sm text-slate-200 leading-4">
                  {displayName}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {typeof document !== 'undefined' &&
              createPortal(
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      ref={portalMenuRef}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="fixed w-52 rounded-2xl backdrop-blur-xl bg-slate-950/80 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.55)] z-[9999] flex flex-col overflow-hidden"
                      style={{
                        top: userMenuPos.top,
                        left: userMenuPos.left
                      }}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-white/10"
                        onClick={() => {
                          setUserMenuOpen(false);
                          if (onNavigate) onNavigate('/profile');
                        }}
                        aria-label="Open profile"
                      >
                        <div className="text-sm font-semibold text-slate-100 leading-5 truncate">{displayName}</div>
                      </button>
                      <div className="border-t border-white/10" />
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm text-red-200 hover:text-red-100 hover:bg-white/10"
                        onClick={() => {
                          setUserMenuOpen(false);
                          if (onNavigate) onNavigate('/logout');
                        }}
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden mt-3 pt-3 border-t border-white/10"
          >
            {renderLinks('flex flex-col gap-2')}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Navbar;
