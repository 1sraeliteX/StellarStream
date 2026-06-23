'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, ChevronDown, Save, Trash2, Clock, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECONDS_IN_DAY = 86_400;
const DAYS_IN_CURRENT_MONTH = new Date(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  0,
).getDate();
const SECONDS_IN_MONTH = SECONDS_IN_DAY * DAYS_IN_CURRENT_MONTH;
const PRESETS_KEY = 'flow-rate-calculator-presets';

const round6 = (n: number): number => Number(n.toFixed(6));

interface Preset {
  name: string;
  ratePerSecond: number;
}

function loadPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: Preset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {}
}

const RATE_FIELDS = [
  { key: 'perSecond' as const, label: 'Per Second', shortLabel: '/ sec' },
  { key: 'perDay' as const, label: 'Per Day', shortLabel: '/ day' },
  { key: 'perMonth' as const, label: 'Per Month', shortLabel: '/ month' },
] as const;

interface FlowRateCalculatorProps {
  ratePerSecond?: number;
  onRateChange?: (ratePerSecond: number) => void;
  assetSymbol?: string;
  readOnly?: boolean;
}

export function FlowRateCalculator({
  ratePerSecond: externalRate = 0,
  onRateChange,
  assetSymbol = 'USDC',
  readOnly = false,
}: FlowRateCalculatorProps) {
  const [activeField, setActiveField] = useState<'perSecond' | 'perDay' | 'perMonth'>('perSecond');
  const [rates, setRates] = useState(() => {
    const rps = externalRate || 0;
    return {
      perSecond: rps,
      perDay: round6(rps * SECONDS_IN_DAY),
      perMonth: round6(rps * SECONDS_IN_MONTH),
    };
  });
  const [rawInputs, setRawInputs] = useState({
    perSecond: '',
    perDay: '',
    perMonth: '',
  });
  const [focusedField, setFocusedField] = useState<'perSecond' | 'perDay' | 'perMonth' | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const rps = externalRate || 0;
    setRates({
      perSecond: rps,
      perDay: round6(rps * SECONDS_IN_DAY),
      perMonth: round6(rps * SECONDS_IN_MONTH),
    });
  }, [externalRate]);

  const updateFromField = useCallback(
    (field: 'perSecond' | 'perDay' | 'perMonth', value: number) => {
      if (value < 0 || !isFinite(value)) return;
      setActiveField(field);

      let rps: number;
      let newRates: typeof rates;

      switch (field) {
        case 'perSecond':
          rps = round6(value);
          newRates = {
            perSecond: rps,
            perDay: round6(value * SECONDS_IN_DAY),
            perMonth: round6(value * SECONDS_IN_MONTH),
          };
          break;
        case 'perDay':
          rps = round6(value / SECONDS_IN_DAY);
          newRates = {
            perSecond: rps,
            perDay: round6(value),
            perMonth: round6(value * DAYS_IN_CURRENT_MONTH),
          };
          break;
        case 'perMonth':
          rps = round6(value / SECONDS_IN_MONTH);
          newRates = {
            perSecond: rps,
            perDay: round6(value / DAYS_IN_CURRENT_MONTH),
            perMonth: round6(value),
          };
          break;
      }

      setRates(newRates);
      onRateChange?.(rps);
    },
    [onRateChange],
  );

  const handleInputChange = (field: 'perSecond' | 'perDay' | 'perMonth', raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if ((cleaned.match(/\./g) ?? []).length > 1) return;

    setRawInputs((prev) => ({ ...prev, [field]: cleaned }));

    const val = parseFloat(cleaned);
    if (!isNaN(val) && cleaned !== '' && cleaned !== '.') {
      updateFromField(field, val);
    }
  };

  const handleFocus = (field: 'perSecond' | 'perDay' | 'perMonth') => {
    setFocusedField(field);
    setRawInputs((prev) => ({ ...prev, [field]: String(rates[field]) }));
  };

  const handleBlur = (field: 'perSecond' | 'perDay' | 'perMonth') => {
    setFocusedField(null);
    setRawInputs((prev) => ({ ...prev, [field]: '' }));
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    field: 'perSecond' | 'perDay' | 'perMonth',
  ) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const idx = RATE_FIELDS.findIndex((f) => f.key === field);
      const next = e.shiftKey
        ? RATE_FIELDS[Math.max(0, idx - 1)]
        : RATE_FIELDS[Math.min(RATE_FIELDS.length - 1, idx + 1)];
      if (next.key !== field) {
        e.preventDefault();
        document.getElementById(`frc-input-${next.key}`)?.focus();
      }
    }
  };

  const displayValue = (field: 'perSecond' | 'perDay' | 'perMonth'): string => {
    if (focusedField === field && rawInputs[field] !== '') {
      return rawInputs[field];
    }
    const val = rates[field];
    if (val === 0) return '0';
    if (val < 0.000001) return val.toExponential(4);
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };

  const maxVal = Math.max(rates.perSecond, rates.perDay, rates.perMonth, 1e-10);

  const getBarWidth = (val: number) => Math.max((val / maxVal) * 100, 0.5);

  const getBarPercent = (val: number) => {
    if (maxVal <= 1e-10) return 0;
    return Math.round((val / maxVal) * 100);
  };

  const handleSavePreset = () => {
    const name = saveName.trim();
    if (!name) return;
    const updated = [...presets, { name, ratePerSecond: rates.perSecond }];
    setPresets(updated);
    persistPresets(updated);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleLoadPreset = (p: Preset) => {
    updateFromField('perSecond', p.ratePerSecond);
    setShowPresets(false);
  };

  const handleDeletePreset = (name: string) => {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    persistPresets(updated);
  };

  const presetMatch = presets.find(
    (p) => Math.abs(p.ratePerSecond - rates.perSecond) < 1e-10,
  );

  useEffect(() => {
    if (showSaveInput) saveInputRef.current?.focus();
  }, [showSaveInput]);

  return (
    <div
      className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] px-5 py-4 space-y-4"
      data-testid="flow-rate-calculator"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-cyan-400" />
          <p className="font-body text-[10px] uppercase tracking-widest text-cyan-400/80">
            Flow Rate Calculator
          </p>
          {presetMatch && (
            <span className="font-body text-[9px] uppercase tracking-wider text-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              {presetMatch.name}
            </span>
          )}
        </div>
        <span className="font-body text-[10px] text-white/25">
          {DAYS_IN_CURRENT_MONTH}-day month
        </span>
      </div>

      <div className="space-y-4">
        {RATE_FIELDS.map(({ key, label, shortLabel }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`frc-input-${key}`}
                className="font-body text-xs font-bold text-white/50 uppercase tracking-wider"
              >
                {label}
              </label>
              <span className="font-ticker text-xs text-white/30 tabular-nums">
                {getBarPercent(rates[key])}%
              </span>
            </div>

            <div
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all duration-200',
                readOnly
                  ? 'border-white/5 bg-white/[0.02]'
                  : focusedField === key
                    ? 'border-cyan-400/40 bg-cyan-400/5'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20',
              )}
            >
              <span className="font-body text-[11px] font-bold text-white/30 w-12 shrink-0">
                {shortLabel}
              </span>
              {readOnly ? (
                <span className="flex-1 font-ticker text-base text-white tabular-nums text-right">
                  {rates[key].toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                  <span className="text-white/30 ml-1 text-xs">{assetSymbol}</span>
                </span>
              ) : (
                <input
                  id={`frc-input-${key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={displayValue(key)}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  onFocus={() => handleFocus(key)}
                  onBlur={() => handleBlur(key)}
                  onKeyDown={(e) => handleKeyDown(e, key)}
                  className="flex-1 bg-transparent font-ticker text-base text-white/90 outline-none placeholder:text-white/15 tabular-nums text-right"
                  style={{ caretColor: '#22d3ee' }}
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={label}
                />
              )}
            </div>

            <div
              className="h-2 rounded-full bg-white/[0.04] overflow-hidden"
              role="progressbar"
              aria-valuenow={getBarPercent(rates[key])}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} relative size`}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400/30 to-cyan-400/70"
                style={{ boxShadow: '0 0 6px rgba(34,211,238,0.15)' }}
                animate={{ width: `${getBarWidth(rates[key])}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
            >
              <Clock size={12} />
              Presets
              <ChevronDown
                size={10}
                className={cn(
                  'transition-transform duration-200',
                  showPresets && 'rotate-180',
                )}
              />
              {presets.length > 0 && (
                <span className="text-[9px] text-white/30 ml-1">
                  ({presets.length})
                </span>
              )}
            </button>

            {!showSaveInput ? (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-cyan-400/70 hover:text-cyan-400 transition-colors"
              >
                <Save size={10} />
                Save
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePreset();
                    if (e.key === 'Escape') {
                      setShowSaveInput(false);
                      setSaveName('');
                    }
                  }}
                  placeholder="Preset name..."
                  className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1 font-body text-xs text-white/80 outline-none focus:border-cyan-400/40 placeholder:text-white/20"
                  aria-label="Preset name"
                />
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!saveName.trim()}
                  className="font-body text-[10px] text-cyan-400/70 hover:text-cyan-400 disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveInput(false);
                    setSaveName('');
                  }}
                  className="font-body text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {showPresets && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 space-y-1 overflow-hidden"
            >
              {presets.length === 0 ? (
                <p className="font-body text-[11px] text-white/25 text-center py-3">
                  No saved presets yet. Save your current rate to reuse it later.
                </p>
              ) : (
                presets.map((p) => {
                  const isActive = Math.abs(p.ratePerSecond - rates.perSecond) < 1e-10;
                  return (
                    <div
                      key={p.name}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-3 py-2 transition-colors group',
                        isActive
                          ? 'bg-cyan-400/10 border border-cyan-400/20'
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(p)}
                        className="flex items-center gap-2 min-w-0 flex-1"
                      >
                        <span
                          className={cn(
                            'font-body text-xs transition-colors truncate',
                            isActive ? 'text-cyan-400 font-bold' : 'text-white/60',
                          )}
                        >
                          {p.name}
                        </span>
                        <span className="font-ticker text-[10px] text-white/30 tabular-nums shrink-0">
                          {p.ratePerSecond < 0.001
                            ? p.ratePerSecond.toExponential(2)
                            : p.ratePerSecond.toFixed(6)}{' '}
                          {assetSymbol}/sec
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(p.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1"
                        aria-label={`Delete preset ${p.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </div>
      )}

      <div className="text-center">
        <p className="font-body text-[9px] text-white/15 tracking-wider">
          1 sec = {SECONDS_IN_DAY.toLocaleString()} days | 1 month = {DAYS_IN_CURRENT_MONTH} days
        </p>
      </div>
    </div>
  );
}
