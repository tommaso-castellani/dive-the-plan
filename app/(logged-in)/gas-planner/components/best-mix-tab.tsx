'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Mountain, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type BestMixResult,
  type DivingMode,
  calculateBestMix,
} from '@/lib/gas-planner/calculations';
import { GAS_PLANNER_DEFAULTS, defaultPpO2 } from '@/lib/gas-planner/defaults';
import { cn } from '@/lib/utils';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const TEMP_MIN = 0;
const TEMP_MAX = 32;

interface BestMixTabProps {
  mode: DivingMode;
}

// Note: this component is remounted by the parent when `mode` changes (via
// `key={mode}`), so initial state derived from the mode is sufficient to
// keep inputs in sync — no effect needed. Depth is intentionally left empty
// (NaN) so the user must enter a value before calculating.
export function BestMixTab({ mode }: BestMixTabProps) {
  const [depth, setDepth] = useState<number>(NaN);
  const [ppO2, setPpO2] = useState<number>(defaultPpO2(mode));
  const [targetEND, setTargetEND] = useState<number>(GAS_PLANNER_DEFAULTS.targetEND);
  const [maxDensity, setMaxDensity] = useState<number>(GAS_PLANNER_DEFAULTS.maxDensity);
  const [waterTemp, setWaterTemp] = useState<number>(GAS_PLANNER_DEFAULTS.waterTemp);
  const [result, setResult] = useState<BestMixResult | null>(null);

  const requiredFilled =
    Number.isFinite(depth) &&
    Number.isFinite(ppO2) &&
    Number.isFinite(targetEND) &&
    (mode === 'OC' || Number.isFinite(maxDensity));

  const handleCalculate = () => {
    if (!requiredFilled) return;
    const computed = calculateBestMix({
      mode,
      depth,
      ppO2,
      targetEND,
      maxDensity: mode === 'CCR' ? maxDensity : undefined,
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
          description="Set your dive profile to compute the mix."
        />

        <div className="space-y-5">
          <NumberField
            id="depth"
            icon={<Mountain className="h-4 w-4" />}
            label="Depth"
            unit="m"
            value={depth}
            min={0}
            max={300}
            step={1}
            onChange={setDepth}
          />

          <NumberField
            id="ppo2"
            icon={<Gauge className="h-4 w-4" />}
            label={mode === 'OC' ? 'Max ppO₂' : 'Diluent ppO₂'}
            unit="bar"
            value={ppO2}
            min={0.16}
            max={1.6}
            step={0.05}
            onChange={setPpO2}
          />

          <NumberField
            id="end"
            icon={<Waves className="h-4 w-4" />}
            label="Target END"
            unit="m"
            value={targetEND}
            min={0}
            max={60}
            step={1}
            onChange={setTargetEND}
          />

          {mode === 'CCR' && (
            <NumberField
              id="density"
              icon={<Wind className="h-4 w-4" />}
              label="Max Gas Density"
              unit="g/L"
              value={maxDensity}
              min={3}
              max={8}
              step={0.1}
              onChange={setMaxDensity}
            />
          )}

          <TemperatureSlider value={waterTemp} onChange={setWaterTemp} />
        </div>

        <Button onClick={handleCalculate} disabled={!requiredFilled} className="w-full" size="lg">
          <Calculator className="h-4 w-4" />
          Calculate
        </Button>
      </div>

      {/* Results column */}
      <div className="space-y-8 lg:col-span-3 lg:border-l lg:border-border/60 lg:pl-12">
        <ColumnHeader
          title="Best Mix"
          description="Optimal blend and operational depth limits."
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
      <p className="text-sm">Enter your parameters and press Calculate.</p>
      <p className="mt-1 text-xs">The recommended mix and MODs will appear here.</p>
    </div>
  );
}

function ResultsView({ result }: { result: BestMixResult }) {
  return (
    <div className="space-y-8">
      {/* Big mix display */}
      <div className="grid grid-cols-3 gap-x-6 sm:gap-x-10">
        <MixStat
          icon={<Droplet className="h-4 w-4" />}
          label="O₂"
          value={result.bestO2Percent}
          accent="text-chart-1"
        />
        <MixStat
          icon={<Wind className="h-4 w-4" />}
          label="He"
          value={result.bestHePercent}
          accent="text-chart-2"
        />
        <MixStat
          icon={<Waves className="h-4 w-4" />}
          label="N₂"
          value={result.n2Percent}
          accent="text-chart-3"
        />
      </div>

      {/* MOD breakdown */}
      <div className="border-border/60 space-y-5 border-t pt-6">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          Maximum Operating Depth
        </p>
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-3">
          <ModBlock
            label="MOD by ppO₂"
            value={result.modByPpO2}
            secondary={`${result.partialPressures.ppO2.toFixed(2)} bar at depth`}
            isLimiter={result.limiter === 'ppO2'}
          />
          <ModBlock
            label="MOD by Density"
            value={result.modByDensity}
            secondary={`${result.densityAtDepth.toFixed(2)} g/L at depth`}
            isLimiter={result.limiter === 'density'}
          />
          <ModBlock
            label="MOD by END"
            value={result.modByEND}
            secondary={`END ${result.endAtDepth.toFixed(0)} m at depth`}
            isLimiter={result.limiter === 'END'}
          />
        </div>
      </div>
    </div>
  );
}

interface MixStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}

function MixStat({ icon, label, value, accent }: MixStatProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn('font-mono text-3xl font-semibold tracking-tight tabular-nums', accent)}
        >
          {value.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-sm font-medium">%</span>
      </div>
    </div>
  );
}

interface ModBlockProps {
  label: string;
  value: number;
  secondary?: string;
  isLimiter: boolean;
}

function ModBlock({ label, value, secondary, isLimiter }: ModBlockProps) {
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
      {secondary && <p className="text-muted-foreground text-[11px]">{secondary}</p>}
    </div>
  );
}
