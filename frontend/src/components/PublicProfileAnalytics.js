import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cell,
  ResponsiveContainer,
  PieChart,
  Pie
} from 'recharts';
import { Flame, Zap, CheckCircle2, TrendingUp } from 'lucide-react';
import { userAPI } from '../services/api';

/* ─── Helpers ─── */

function buildHeatmapData(activity = []) {
  const map = {};
  activity.forEach(({ date, count }) => {
    map[date] = count;
  });

  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, count: map[key] || 0 });
  }
  return result;
}

function heatColor(count) {
  if (count === 0) return '#1e293b';
  if (count <= 2) return '#0e7490';
  if (count <= 5) return '#0891b2';
  if (count <= 10) return '#06b6d4';
  return '#22d3ee';
}

/* ─── Sub-components ─── */

function DifficultyRings({ easy, medium, hard, totalEasy, totalMedium, totalHard }) {
  const total = easy + medium + hard;

  const rings = [
    { name: 'Easy', solved: easy, total: totalEasy, color: '#22c55e' },
    { name: 'Medium', solved: medium, total: totalMedium, color: '#f59e0b' },
    { name: 'Hard', solved: hard, total: totalHard, color: '#ef4444' }
  ];

  const pieData = [
    { name: 'Easy', value: easy, fill: '#22c55e' },
    { name: 'Medium', value: medium, fill: '#f59e0b' },
    { name: 'Hard', value: hard, fill: '#ef4444' },
    { name: 'Unsolved', value: Math.max(0, (totalEasy + totalMedium + totalHard) - total), fill: '#1e293b' }
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={60}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-xs text-slate-400">solved</div>
        </div>
      </div>

      <div className="flex-1 w-full space-y-3">
        {rings.map(({ name, solved, total: tot, color }) => (
          <div key={name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span style={{ color }}>{name}</span>
              <span className="text-slate-400">
                {solved} / {tot}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: tot > 0 ? `${Math.round((solved / tot) * 100)}%` : '0%',
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityHeatmap({ activity }) {
  const cells = buildHeatmapData(activity);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map(({ date, count }) => (
              <div
                key={date}
                title={`${date}: ${count} submission${count !== 1 ? 's' : ''}`}
                className="w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-transform hover:scale-125"
                style={{ backgroundColor: heatColor(count) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
        <span>Less</span>
        {['#1e293b', '#0e7490', '#0891b2', '#06b6d4', '#22d3ee'].map((c) => (
          <div key={c} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

/**
 * PublicProfileAnalytics – LeetCode-style analytics panel for public profiles.
 * Fetches data from the public analytics endpoint (no auth required).
 * Accepts: username (string)
 */
const PublicProfileAnalytics = ({ username }) => {
  const [codingStats, setCodingStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await userAPI.getPublicAnalytics(username);

        if (cancelled) return;

        setCodingStats(res.data?.codingStats || null);
        setActivity(res.data?.activity || []);
        setStreak(res.data?.streak || null);
      } catch (err) {
        if (!cancelled) setError('Failed to load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [username]);

  if (!username) return null;

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="h-36 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-slate-400">
        {error}
      </div>
    );
  }

  const cs = codingStats || {};
  const st = streak || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Solved
          </div>
          <div className="text-2xl font-bold text-white">{cs.totalSolved ?? 0}</div>
          <div className="text-xs text-slate-500">of {cs.totalProblems ?? 0}</div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Acceptance
          </div>
          <div className="text-2xl font-bold text-white">{cs.acceptanceRate ?? 0}%</div>
          <div className="text-xs text-slate-500">{cs.acceptedSubmissions ?? 0} / {cs.totalSubmissions ?? 0} sub.</div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Streak
          </div>
          <div className="text-2xl font-bold text-white">{st.currentStreak ?? 0}</div>
          <div className="text-xs text-slate-500">days current</div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            Best streak
          </div>
          <div className="text-2xl font-bold text-white">{st.longestStreak ?? 0}</div>
          <div className="text-xs text-slate-500">days all-time</div>
        </div>
      </div>

      {/* Difficulty breakdown */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-200 mb-4">Difficulty Breakdown</div>
        <DifficultyRings
          easy={cs.easySolved ?? 0}
          medium={cs.mediumSolved ?? 0}
          hard={cs.hardSolved ?? 0}
          totalEasy={cs.totalEasy ?? 0}
          totalMedium={cs.totalMedium ?? 0}
          totalHard={cs.totalHard ?? 0}
        />
      </div>

      {/* Activity heatmap */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-slate-200">Submission Activity</div>
          <div className="text-xs text-slate-500">Last 365 days</div>
        </div>
        <ActivityHeatmap activity={activity} />
      </div>
    </motion.div>
  );
};

export default PublicProfileAnalytics;
