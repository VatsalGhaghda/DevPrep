import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({
  openMobile,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
  items = [],
  onNavigate,
  profile = { name: 'User', subtitle: 'DevPrep' }
}) => {
  const content = (
    <motion.aside
      className={`h-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden ${collapsed ? 'w-[86px]' : 'w-[280px]'}`}
      layout
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 border border-white/10" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate">{profile.name}</div>
              <div className="text-xs text-slate-500 truncate">{profile.subtitle}</div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="hidden md:flex w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 items-center justify-center"
          onClick={onToggleCollapsed}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
        </button>

        <button
          type="button"
          className="md:hidden w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="p-3">
        <nav className="space-y-1">
          {items.map(({ label, path, Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(path);
                }
                if (onCloseMobile) onCloseMobile();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  isActive ? 'bg-violet-600/15 border-violet-500/30 text-violet-200' : 'bg-white/0 border-transparent text-slate-300 hover:bg-white/5 hover:border-white/10'
                }`
              }
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              {!collapsed && <div className="text-sm font-medium">{label}</div>}
            </NavLink>
          ))}
        </nav>
      </div>
    </motion.aside>
  );

  return (
    <>
      <div className="hidden md:block h-[calc(100vh-32px)] sticky top-4">{content}</div>

      <AnimatePresence>
        {openMobile && (
          <motion.div
            className="md:hidden fixed inset-0 z-40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={onCloseMobile}
              aria-label="Close sidebar overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative h-[calc(100vh-32px)]"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              {content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
