import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Link2, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { Card, PartialNotice } from './ui';
import { PLATFORM_META, PLATFORMS, timeAgo } from '../../utils/devAnalytics';

const PLACEHOLDERS = {
  github: 'https://github.com/your-username',
  leetcode: 'https://leetcode.com/u/your-username/',
  codeforces: 'https://codeforces.com/profile/your-handle'
};

const STATUS = {
  connected: { label: 'Connected', icon: CheckCircle2, cls: 'text-emerald-300 bg-emerald-600/10 border-emerald-400/20' },
  unverified: { label: 'Not verified yet', icon: HelpCircle, cls: 'text-amber-300 bg-amber-600/10 border-amber-400/20' },
  not_found: { label: 'Profile not found', icon: XCircle, cls: 'text-rose-300 bg-rose-600/10 border-rose-400/20' },
  error: { label: 'Sync error', icon: AlertTriangle, cls: 'text-rose-300 bg-rose-600/10 border-rose-400/20' }
};

export function StatusPill({ connection }) {
  if (!connection) {
    return <span className="px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-[11px] text-slate-400">Not connected</span>;
  }
  const s = STATUS[connection.status] || STATUS.connected;
  const Icon = s.icon;
  return (
    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function ConnectionRow({ platform, connection, data, busy, onSave, onRemove, onSync }) {
  const [value, setValue] = useState(connection?.profileUrl || '');
  const [editing, setEditing] = useState(!connection);
  useEffect(() => {
    setValue(connection?.profileUrl || '');
    setEditing(!connection);
  }, [connection?.profileUrl]);

  const meta = PLATFORM_META[platform];
  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) onSave(platform, value.trim());
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
          <span className="text-sm font-semibold text-slate-100">{meta.label}</span>
          <StatusPill connection={connection} />
        </div>
        {connection && (
          <div className="text-xs text-slate-400">
            Last synced {timeAgo(connection.lastSyncedAt)}
            {connection.lastSyncedAt && (
              <span className="text-slate-500"> ({new Date(connection.lastSyncedAt).toLocaleString()})</span>
            )}
          </div>
        )}
      </div>

      {connection && !editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={connection.profileUrl} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-violet-300 inline-flex items-center gap-1.5 mr-auto">
            <Link2 className="w-3.5 h-3.5" /> {connection.username}
          </a>
          <button
            type="button"
            onClick={() => onSync(platform)}
            disabled={busy}
            className="h-8 px-3 rounded-lg bg-violet-600/80 hover:bg-violet-600 border border-violet-500/50 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200 disabled:opacity-50"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onRemove(platform)}
            disabled={busy}
            className="h-8 px-3 rounded-lg bg-rose-600/10 border border-rose-400/20 hover:bg-rose-600/20 text-xs text-rose-200 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={PLACEHOLDERS[platform]}
            aria-label={`${meta.label} profile URL or username`}
            className="flex-1 h-10 bg-black/20 border border-white/10 focus:border-violet-400/30 rounded-xl px-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {connection ? 'Save' : 'Connect'}
            </button>
            {connection && (
              <button
                type="button"
                onClick={() => { setEditing(false); setValue(connection.profileUrl); }}
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {connection && (
        <div className="mt-3">
          <PartialNotice items={data?.partial} error={connection.lastError} />
        </div>
      )}
    </div>
  );
}

export default function ConnectionsSection({ analytics, busy, onSave, onRemove, onSync, onSyncAll }) {
  const anyConnected = PLATFORMS.some((p) => analytics?.connections?.[p]);
  return (
    <Card
      title="Connected profiles"
      icon={Link2}
      action={anyConnected && (
        <button
          type="button"
          onClick={onSyncAll}
          disabled={Boolean(busy.all)}
          className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy.all ? 'animate-spin' : ''}`} /> Sync all
        </button>
      )}
    >
      <p className="text-sm text-slate-400 mb-4">
        Paste a profile URL or just your username. DevPrep checks that the profile exists, then reads its public data.
        Only you can see your analytics.
      </p>
      <div className="space-y-3">
        {PLATFORMS.map((p) => (
          <ConnectionRow
            key={p}
            platform={p}
            connection={analytics?.connections?.[p]}
            data={analytics?.data?.[p]}
            busy={Boolean(busy[p] || busy.all)}
            onSave={onSave}
            onRemove={onRemove}
            onSync={onSync}
          />
        ))}
      </div>
      {analytics && !analytics.settings?.githubTokenConfigured && (
        <p className="mt-4 text-xs text-slate-500">
          The server has no GITHUB_TOKEN, so GitHub activity is limited to public events from the last 90 days and the contribution calendar is unavailable.
        </p>
      )}
    </Card>
  );
}
