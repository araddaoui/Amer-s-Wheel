import React, { useMemo, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { AuditLogEntry, ConfigHistoryEntry } from '../types/game';

interface AuditLogProps {
  auditEntries: AuditLogEntry[];
  configHistory: ConfigHistoryEntry[];
  onRestoreSnapshot: (entry: ConfigHistoryEntry) => void;
}

type LogCategory = 'ALL' | AuditLogEntry['type'];

export const AuditLog: React.FC<AuditLogProps> = ({
  auditEntries,
  configHistory,
  onRestoreSnapshot,
}) => {
  const [subView, setSubView] = useState<'events' | 'configs'>('events');
  const [typeFilter, setTypeFilter] = useState<LogCategory>('ALL');
  const [search, setSearch] = useState('');

  const filteredEvents = useMemo(() => {
    return auditEntries.filter((e) => {
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          e.summary.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditEntries, typeFilter, search]);

  const handleExportCsv = () => {
    const header = ['Timestamp', 'Type', 'Actor', 'Summary', 'AmountDelta', 'BalanceAfter'];
    const rows = filteredEvents.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.type,
      e.actor,
      `"${e.summary.replace(/"/g, '""')}"`,
      e.amountDelta !== undefined ? e.amountDelta.toFixed(2) : '',
      e.balanceAfter !== undefined ? e.balanceAfter.toFixed(2) : '',
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amers-wheel-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubView('events')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subView === 'events'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Transaction & Spin Audit ({auditEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView('configs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subView === 'configs'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Configuration History ({configHistory.length})
          </button>
        </div>

        {subView === 'events' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Search audit log..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as LogCategory)}
              className="px-3 py-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Events</option>
              <option value="SPIN">Amer&apos;s Wheel Spins</option>
              <option value="HORSE_RACE">Horse Races</option>
              <option value="BASKETBALL_BET">Basketball Bets</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="BALANCE_RESET">Balance Resets</option>
              <option value="CONFIG_CHANGE">Config Changes</option>
              <option value="LIMITS_CHANGE">Limits & Security</option>
              <option value="OPERATOR_AUTH">Operator Auth</option>
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredEvents.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {subView === 'events' ? (
        filteredEvents.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-800 rounded-lg">
            <p className="text-sm font-medium text-slate-300">No audit events recorded</p>
            <p className="text-xs text-slate-500 mt-1">
              Spins, deposits, and configuration changes appear here chronologically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#111827] z-10">
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Summary</th>
                  <th className="py-2.5 px-3 text-right">Net Delta</th>
                  <th className="py-2.5 pl-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvents.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {entry.actor}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {entry.type}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 max-w-md">{entry.summary}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        entry.amountDelta === undefined
                          ? 'text-slate-500'
                          : entry.amountDelta > 0
                          ? 'text-emerald-400'
                          : entry.amountDelta < 0
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {entry.amountDelta === undefined
                        ? '—'
                        : entry.amountDelta > 0
                        ? `+$${entry.amountDelta.toFixed(2)}`
                        : entry.amountDelta < 0
                        ? `-$${Math.abs(entry.amountDelta).toFixed(2)}`
                        : '$0.00'}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {entry.balanceAfter !== undefined
                        ? `$${entry.balanceAfter.toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : configHistory.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-lg">
          <p className="text-sm font-medium text-slate-300">No configuration revisions yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Publish a change to wheel segments, probabilities, or betting limits to create an
            auditable snapshot.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3">Timestamp</th>
                <th className="py-2.5 px-3">Change Summary</th>
                <th className="py-2.5 px-3 text-right">Segments</th>
                <th className="py-2.5 px-3 text-right">RTP Shift</th>
                <th className="py-2.5 px-3 text-right">House Edge Shift</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {configHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString([], {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 text-slate-200">{item.summary}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                    {item.previousSegmentsCount} → {item.newSegmentsCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                    {item.previousRtpPercent.toFixed(2)}% → {item.newRtpPercent.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400">
                    {item.previousHouseEdgePercent.toFixed(2)}% → {item.newHouseEdgePercent.toFixed(2)}%
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRestoreSnapshot(item)}
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Load into Draft
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
