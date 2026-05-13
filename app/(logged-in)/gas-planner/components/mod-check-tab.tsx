'use client';

import { useState } from 'react';

import { AlertTriangle, Calculator, Droplet, Gauge, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type DivingMode,
  type MODCheckResult,
  type MODLimiter,
  calculateMODCheck,
} from '@/lib/gas-planner/calculations';
import { GAS_PLANNER_DEFAULTS, defaultPpO2 } from '@/lib/gas-planner/defaults';
import { cn } from '@/lib/utils';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const TEMP_MIN = 0;
const TEMP_MAX = 32;

interface ModCheckTabProps {
  mode: DivingMode;
}

// Gas (O₂/He) is intentionally left empty (NaN) — must be entered by the
// user. The component is remounted by the parent on mode change (via
// `key={mode}`), so mode-aware defaults pick the right ppO₂ on mount.
export function ModCheckTab({ mode }: ModCheckTabProps) {
  const [o2Percent, setO2Percent] = useState<number>(NaN);
  const [hePercent, setHePercent] = useState<number>(NaN);
  const [targetPpO2, setTargetPpO2] = useState<number>(defaultPpO2(mode));
  const [targetEND, setTargetEND] = useState<number>(GAS_PLANNER_DEFAULTS.targetEND);
  const [targetDensity, setTargetDensity] = useState<number>(GAS_PLANNER_DEFAULTS.maxDensity);
  const [waterTemp, setWaterTemp] = useState<number>(GAS_PLANNER_DEFAULTS.waterTemp);
  const [result, setResult] = useState<MODCheckResult | null>(null);

  const gasEntered = Number.isFinite(o2Percent) && Number.isFinite(hePercent);
  const n2Percent = gasEntered ? Math.max(0, 100 - o2Percent - hePercent) : 0;
  const mixIsValid = gasEntered && o2Percent >= 0 && hePercent >= 0 && o2Percent + hePercent <= 100;
  const canCalculate =
    mixIsValid &&
    Number.isFinite(targetPpO2) &&
    Number.isFinite(targetEND) &&
    Number.isFinite(targetDensity);

  const handleCalculate = () => {
    if (!canCalculate) return;
    const computed = calculateMODCheck({
      fO2: o2Percent / 100,
      fHe: hePercent / 100,
      targetPpO2,
      targetEND,
      targetDensity,
      waterTemp,
    });
    setResult(computed);
  };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-5">
      {/* Inputs column */}
      <div className="space-y-8 lg:col-span-2">
        <ColumnHeader
          title="Parameters"
          description="Enter your gas and the limits you want to check against."
        />

        {/* Gas mix */}
        <section className="space-y-4">
          <SubSectionLabel>Gas Mix</SubSectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="o2"
              icon={<Droplet className="h-4 w-4" />}
              label="O₂"
              unit="%"
              value={o2Percent}
              min={0}
              max={100}
              step={1}
              onChange={setO2Percent}
            />
            <NumberField
              id="he"
              icon={<Wind className="h-4 w-4" />}
              label="He"
              unit="%"
              value={hePercent}
              min={0}
              max={100}
              step={1}
              onChange={setHePercent}
            />
          </div>
          <N2Readout entered={gasEntered} mixIsValid={mixIsValid} value={n2Percent} />
        </section>

        <div className="space-y-5">
          {/* Target ppO2 / Setpoint — copy switches by mode */}
          <NumberField
            id="target-ppo2"
            icon={<Gauge className="h-4 w-4" />}
            label={mode === 'CCR' ? 'Target Setpoint' : 'Target ppO₂'}
            unit="bar"
            value={targetPpO2}
            min={0.16}
            max={1.6}
            step={0.05}
            onChange={setTargetPpO2}
          />

          <NumberField
            id="target-end"
            icon={<Waves className="h-4 w-4" />}
            label="Target END"
            unit="m"
            value={targetEND}
            min={0}
            max={60}
            step={1}
            onChange={setTargetEND}
          />

          <NumberField
            id="target-density"
            icon={<Wind className="h-4 w-4" />}
            label="Target Density"
            unit="g/L"
            value={targetDensity}
            min={3}
            max={8}
            step={0.1}
            onChange={setTargetDensity}
          />

          <TemperatureSlider value={waterTemp} onChange={setWaterTemp} />
        </div>

        <Button onClick={handleCalculate} disabled={!canCalculate} className="w-full" size="lg">
          <Calculator className="h-4 w-4" />
          Calculate
        </Button>
      </div>

      {/* Results column */}
      <div className="space-y-8 lg:col-span-3 lg:border-l lg:border-border/60 lg:pl-12">
        <ColumnHeader
          title="MOD Check"
          description="Maximum operating depth from each limit. The smallest is the binding one."
        />
        {result ? <ResultsView result={result} /> : <ResultsEmpty />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColumnHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </header>
  );
}

function SubSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

function N2Readout({
  entered,
  mixIsValid,
  value,
}: {
  entered: boolean;
  mixIsValid: boolean;
  value: number;
}) {
  const invalid = entered && !mixIsValid;
  const display = !entered ? '—' : invalid ? 'O₂ + He exceeds 100%' : `${value.toFixed(1)}%`;
  return (
    <div className="border-border/60 flex items-baseline justify-between border-t pt-2.5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Waves className="h-3.5 w-3.5" />
        <span>N₂ balance</span>
      </div>
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          invalid ? 'text-destructive' : entered ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {display}
      </span>
    </div>
  );
}

function TemperatureSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="water-temp" className="flex items-center gap-2 text-sm font-medium">
          <Thermometer className="h-4 w-4" />
          Water Temperature
        </Label>
        <span className="text-muted-foreground font-mono text-sm tabular-nums">{value}°C</span>
      </div>
      <Slider
        id="water-temp"
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={TEMP_MIN}
        max={TEMP_MAX}
        step={1}
      />
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{TEMP_MIN}°C</span>
        <span>{TEMP_MAX}°C</span>
      </div>
    </div>
  );
}

function ResultsEmpty() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-start justify-center">
      <p className="text-sm">Enter your gas and limits, then press Calculate.</p>
      <p className="mt-1 text-xs">
        We&apos;ll show the MOD imposed by ppO₂, END and density — the smallest one wins.
      </p>
    </div>
  );
}

const LIMITER_LABEL: Record<MODLimiter, string> = {
  ppO2: 'ppO₂',
  END: 'END',
  density: 'density',
};

function ResultsView({ result }: { result: MODCheckResult }) {
  const limitingDisplay = Number.isFinite(result.limitingMOD)
    ? result.limitingMOD.toFixed(0)
    : '—';

  return (
    <div className="space-y-10">
      {/* Headline limiting MOD — typography-led, no tinted block. */}
      <div className="space-y-3">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] uppercase">
          <AlertTriangle className="text-chart-3 h-3.5 w-3.5" />
          Limiting MOD
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-5xl font-semibold tabular-nums leading-none">
            {limitingDisplay}
          </span>
          <span className="text-muted-foreground text-xl font-medium">m</span>
        </div>
        <p className="text-muted-foreground text-sm">
          This blend is constrained by{' '}
          <span className="text-foreground font-medium">{LIMITER_LABEL[result.limiter]}</span> at
          the depth above.
        </p>
      </div>

      {/* Per-limit breakdown */}
      <div className="border-border/60 space-y-5 border-t pt-6">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          Per-limit Maximum Operating Depth
        </p>
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-3">
          <ModBlock
            label="MOD by ppO₂"
            value={result.modByPpO2}
            isLimiter={result.limiter === 'ppO2'}
          />
          <ModBlock
            label="MOD by END"
            value={result.modByEND}
            isLimiter={result.limiter === 'END'}
          />
          <ModBlock
            label="MOD by Density"
            value={result.modByDensity}
            isLimiter={result.limiter === 'density'}
          />
        </div>
      </div>
    </div>
  );
}

interface ModBlockProps {
  label: string;
  value: number;
  isLimiter: boolean;
}

function ModBlock({ label, value, isLimiter }: ModBlockProps) {
  const display = Number.isFinite(value) ? value.toFixed(0) : '—';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{label}</p>
        {isLimiter && (
          <span className="text-primary text-[10px] font-medium tracking-[0.08em] uppercase">
            Limiting
          </span>
        )}
      </div>
      <p
        className={cn(
          'flex items-baseline gap-1 font-mono text-2xl font-semibold tabular-nums',
          isLimiter && 'text-primary'
        )}
      >
        {display}
        {Number.isFinite(value) && (
          <span
            className={cn(
              'text-sm font-medium',
              isLimiter ? 'text-primary/80' : 'text-muted-foreground'
            )}
          >
            m
          </span>
        )}
      </p>
    </div>
  );
}
