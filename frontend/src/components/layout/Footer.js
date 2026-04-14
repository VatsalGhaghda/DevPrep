import { Github, Linkedin, Twitter } from 'lucide-react';

const Footer = ({ onNavigate }) => {
  const links = [
    { label: 'About', path: '/about' },
    { label: 'Help', path: '/help' },
    { label: 'Privacy', path: '/privacy' },
    { label: 'Terms', path: '/terms' }
  ];

  const socials = [
    { label: 'Twitter', Icon: Twitter, url: 'https://twitter.com' },
    { label: 'LinkedIn', Icon: Linkedin, url: 'https://linkedin.com' },
    { label: 'GitHub', Icon: Github, url: 'https://github.com' }
  ];

  return (
    <div className="mt-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-200">DevPrep</div>
          <div className="text-xs text-slate-500 mt-1">© {new Date().getFullYear()} All rights reserved</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {links.map((l) => (
            <button
              key={l.path}
              type="button"
              className="px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
              onClick={() => {
                // Ignore for now since these pages don't exist
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {socials.map(({ label, Icon, url }) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
              aria-label={label}
            >
              <Icon className="w-5 h-5 text-slate-300" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Footer;
