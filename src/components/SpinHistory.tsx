import React, { useMemo, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { SpinRecord } from '../types/game';

interface SpinHistoryProps {
  history: SpinRecord[];
  onInspectProof: (spin: SpinRecord) => void;
  onClearHistory: () => void;
}

type OutcomeFilter = 'all' | 'wins' | 'breakeven' | 'losses';

export const SpinHistory: React.FC<SpinHistoryProps> = ({
  history,
  onInspectProof,
  onClearHistory,
}) => {
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return history.filter((item) => {
      if (filter === 'wins' && item.multiplier <= 1) return false;
      if (filter === 'breakeven' && item.multiplier !== 1) return false;
      if (filter === 'losses' && item.multiplier >= 1) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          item.segmentLabel.toLowerCase().includes(q) ||
          String(item.fairness.nonce).includes(q) ||
          item.fairness.serverSeedHash.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [history, filter, search]);

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Player Spin History</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete ledger of settled spins with wagers, payouts, and cryptographic hashes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter outcome or #nonce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-[#0B1120] border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />

          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
            {(['all', 'wins', 'breakeven', 'losses'] as OutcomeFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === key
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {key === 'all'
                  ? 'All'
                  : key === 'wins'
                  ? 'Wins'
                  : key === 'breakeven'
                  ? 'Break Even'
                  : 'Losses'}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-800/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-lg">
          <p className="text-sm font-medium text-slate-300">
            {history.length === 0 ? 'No spins recorded yet' : 'No spins match the active filter'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {history.length === 0
              ? 'Place a wager and spin the wheel to record verifiable game history.'
              : 'Try adjusting your outcome filter or search query.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 pr-4">Spin</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3 text-right">Wager</th>
                <th className="py-2.5 px-3 text-right">Multiplier</th>
                <th className="py-2.5 px-3 text-right">Payout</th>
                <th className="py-2.5 px-3 text-right">Net</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
                <th className="py-2.5 pl-3 text-right">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filtered.map((spin) => (
                <tr key={spin.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4 font-mono tabular-nums text-slate-400">
                    #{spin.fairness.nonce}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                    {new Date(spin.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: spin.segmentColor }}
                      />
                      <span className="font-medium text-slate-100 whitespace-nowrap">
                        {spin.segmentLabel}
                      </span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        ({spin.probabilityPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                    ${spin.betAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400 font-semibold">
                    {spin.multiplier}x
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                    ${spin.payout.toFixed(2)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                      spin.netResult > 0
                        ? 'text-emerald-400'
                        : spin.netResult === 0
                        ? 'text-blue-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {spin.netResult > 0
                      ? `+$${spin.netResult.toFixed(2)}`
                      : spin.netResult === 0
                      ? '$0.00'
                      : `-$${Math.abs(spin.netResult).toFixed(2)}`}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                    ${spin.balanceAfter.toFixed(2)}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => onInspectProof(spin)}
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verify
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
