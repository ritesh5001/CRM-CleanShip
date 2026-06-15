import { Users, Contact, Phone, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOverview } from '@/api/reports';
import { Card, Spinner, StatCard } from '@/components/ui/Misc';
import { LEAD_STATUS_LABELS } from '@/lib/constants';
import type { LeadStatus } from '@/types';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#16a34a', '#1f2937'];

export function SuperadminDashboard() {
  const { data, isLoading } = useOverview();
  if (isLoading || !data) return <Spinner />;

  const statusData = data.leadsByStatus.map((s) => ({
    name: LEAD_STATUS_LABELS[s._id as LeadStatus] ?? s._id,
    value: s.count,
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Telecallers"
          value={data.totalTelecallers}
          sub={`${data.activeTelecallers} active`}
          icon={<Users size={18} />}
        />
        <StatCard label="Total Leads" value={data.totalLeads} icon={<Contact size={18} />} />
        <StatCard label="Calls Today" value={data.callsToday} icon={<Phone size={18} />} />
        <StatCard
          label="Conversion"
          value={`${data.conversionRate}%`}
          sub={`${data.convertedLeads} converted`}
          icon={<TrendingUp size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Leads by status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Calls today by telecaller</h2>
          {data.perTelecaller.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No calls logged today</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.perTelecaller}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Telecaller performance (today)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">Name</th>
                <th className="pb-2">Calls</th>
                <th className="pb-2">Target</th>
                <th className="pb-2">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.perTelecaller.map((t) => {
                const pct = t.dailyTarget ? Math.round((t.calls / t.dailyTarget) * 100) : 0;
                return (
                  <tr key={t._id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-700">{t.name}</td>
                    <td className="py-2">{t.calls}</td>
                    <td className="py-2">{t.dailyTarget}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.perTelecaller.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No activity yet today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
