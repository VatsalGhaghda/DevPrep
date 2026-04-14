import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { analyticsAPI } from '../services/api';

function normalizeLabel(v) {
  const s = String(v || '').trim();
  return s || 'Unknown';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="font-semibold text-slate-100">{label || p.name}</div>
      <div className="text-slate-300">{p.value}</div>
    </div>
  );
}

const PIE_COLORS = ['#22d3ee', '#a78bfa', '#fb7185', '#34d399', '#fbbf24', '#60a5fa', '#f97316', '#2dd4bf'];

const ProfileInsightsPanel = ({ clerkToken }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clerkToken) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await analyticsAPI.getProfileInsights(clerkToken);
        if (cancelled) return;

        setInsights(res.data?.insights || null);
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load profile insights.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clerkToken]);

  const languageData = useMemo(() => {
    const items = insights?.languageUsage || [];
    return items
      .map((x) => ({ name: normalizeLabel(x.language), value: Number(x.count) || 0 }))
      .filter((x) => x.value > 0)
      .slice(0, 8);
  }, [insights]);

  const categoryData = useMemo(() => {
    const items = insights?.solvedCategories || [];
    return items
      .map((x) => ({ name: normalizeLabel(x.category), value: Number(x.count) || 0 }))
      .filter((x) => x.value > 0)
      .slice(0, 8);
  }, [insights]);

  const mockTypeData = useMemo(() => {
    const items = insights?.mock?.byType || [];
    return items
      .map((x) => ({ name: normalizeLabel(x.type), value: Number(x.count) || 0 }))
      .filter((x) => x.value > 0);
  }, [insights]);

  const savedDifficultyData = useMemo(() => {
    const items = insights?.savedQuestions?.byDifficulty || [];
    return items
      .map((x) => ({ name: normalizeLabel(x.difficulty), value: Number(x.count) || 0 }))
      .filter((x) => x.value > 0);
  }, [insights]);

  
  if (!clerkToken) return null;

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-44 bg-white/10 rounded mb-4" />
        <div className="h-40 bg-white/5 rounded-xl" />
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

  const avgMockScore = insights?.mock?.averageScore;
  const resumeCount = Number(insights?.resume?.uploadedCount) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5"
    >
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-200">Languages</div>
        <div className="text-xs text-slate-500 mt-1">Submissions by language</div>
        <div className="mt-4 h-48">
          {languageData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={languageData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} stroke="none">
                  {languageData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No submission data yet
            </div>
          )}
        </div>
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-200">Solved Categories</div>
        <div className="text-xs text-slate-500 mt-1">Accepted problems by category</div>
        <div className="mt-4 h-48">
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} stroke="none">
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No solved problems yet
            </div>
          )}
        </div>
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-200">Mock Interviews</div>
        <div className="text-xs text-slate-500 mt-1">Sessions by type</div>
        <div className="mt-4 h-40">
          {mockTypeData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockTypeData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {mockTypeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No mock sessions yet
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-slate-500">Total sessions</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {insights?.mock?.totalSessions || 0}
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-slate-500">Resume interviews</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {insights?.mock?.resumeInterviews || 0}
            </div>
          </div>
        </div>
      </div>


      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 lg:col-span-2 xl:col-span-3">
        <div className="text-sm font-semibold text-slate-200">Saved Questions</div>
        <div className="text-xs text-slate-500 mt-1">By difficulty</div>
        <div className="mt-4 h-40">
          {savedDifficultyData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savedDifficultyData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No saved questions yet
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileInsightsPanel;
