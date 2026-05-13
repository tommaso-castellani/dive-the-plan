'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Mountain, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type DivingMode,
  type GasCheckResult,
  calculateGasCheck,
} from '@/lib/gas-planner/calculations';
import { GAS_PLANNER_DEFAULTS } from '@/lib/gas-planner/defaults';
import { cn } from '@/lib/utils';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const TEMP_MIN = 0;
const TEMP_MAX = 32;

interface GasCheckTabProps {
  mode: DivingMode;
}

// Gas (O₂/He) and depth are intentionally left empty (NaN) — they're
// dive-specific and must be entered by the user before calculating.
export function GasCheckTab({ mode }: GasCheckTabProps) {
  const [depth, setDepth] = useState<number>(NaN);
  const [o2Percent, setO2Percent] = useState<number>(NaN);
  const [hePercent, setHePercent] = useState<number>(NaN);
  const [waterTemp, setWaterTemp] = useState<number>(GAS_PLANNER_DEFAULTS.waterTemp);
  const [result, setResult] = useState<GasCheckResult | null>(null);

  const gasEntered = Number.isFinite(o2Percent) && Number.isFinite(hePercent);
  const n2Percent = gasEntered ? Math.max(0, 100 - o2Percent - hePercent) : 0;
  const isMixInvalid =
    gasEntered && (o2Percent + hePercent > 100 || o2Percent < 0 || hePercent < 0);
  const canCalculate = gasEntered && !isMixInvalid && Number.isFinite(depth);

  const handleCalculate = () => {
    if (!canCalculate) return;
    const computed = calculateGasCheck({
      mode,
      depth,
      waterTemp,
      fO2: o2Percent / 100,
      fHe: hePercent / 100,
    });
    setResult(computed);
  };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-5">
      {/* Inputs column */}
      <div className="space-y-8 lg:col-span-2">
        <ColumnHeader
          title="Gas & Conditions"
          description="Enter your blend, depth, and water temperature."
        />

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
          <N2Readout entered={gasEntered} invalid={isMixInvalid} value={n2Percent} />
        </section>

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

          <TemperatureSlider value={waterTemp} onChange={setWaterTemp} />
        </div>

        <Button onClick={handleCalculate} className="w-full" size="lg" disabled={!canCalculate}>
          <Calculator className="h-4 w-4" />
          Calculate
        </Button>
      </div>

      {/* Results column */}
      <div className="space-y-8 lg:col-span-3 lg:border-l lg:border-border/60 lg:pl-12">
        <ColumnHeader
          title="At Depth"
          description="Operational metrics for the entered blend at the target depth."
        />
        {result ? <ResultsView result={result} mode={mode} /> : <ResultsEmpty />}
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
  invalid,
  value,
}: {
  entered: boolean;
  invalid: boolean;
  value: number;
}) {
  const display = !entered ? '—' : invalid ? 'Invalid mix' : `${value.toFixed(0)}%`;
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
      <p className="text-sm">Enter your gas and conditions, then press Calculate.</p>
      <p className="mt-1 text-xs">ppO₂, density, and END at depth will appear here.</p>
    </div>
  );
}

function ResultsView({ result, mode }: { result: GasCheckResult; mode: DivingMode }) {
  return (
    <div className="space-y-8">
      {/* Mix display */}
      <div className="grid grid-cols-3 gap-x-6 sm:gap-x-10">
        <MixStat
          icon={<Droplet className="h-4 w-4" />}
          label="O₂"
          value={result.o2Percent}
          accent="text-chart-1"
        />
        <MixStat
          icon={<Wind className="h-4 w-4" />}
          label="He"
          value={result.hePercent}
          accent="text-chart-2"
        />
        <MixStat
          icon={<Waves className="h-4 w-4" />}
          label="N₂"
          value={result.n2Percent}
          accent="text-chart-3"
        />
      </div>

      {/* Operational metrics */}
      <div className="border-border/60 space-y-5 border-t pt-6">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          At Target Depth
        </p>
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-3">
          <Metric
            icon={<Gauge className="h-4 w-4" />}
            label={mode === 'OC' ? 'ppO₂' : 'Diluent ppO₂'}
            value={result.partialPressures.ppO2.toFixed(2)}
            unit="bar"
            secondary={`ppN₂ ${result.partialPressures.ppN2.toFixed(2)} · ppHe ${result.partialPressures.ppHe.toFixed(2)}`}
          />
          <Metric
            icon={<Wind className="h-4 w-4" />}
            label="Gas Density"
            value={result.densityAtDepth.toFixed(2)}
            unit="g/L"
            secondary="Recommended ≤ 5.2 g/L"
          />
          <Metric
            icon={<Waves className="h-4 w-4" />}
            label="END"
            value={result.endAtDepth.toFixed(0)}
            unit="m"
            secondary="Equivalent Narcotic Depth"
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

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  secondary?: string;
}

function Metric({ icon, label, value, unit, secondary }: MetricProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="flex items-baseline gap-1 font-mono text-2xl font-semibold tabular-nums">
        {value}
        {unit && (
          <span className="text-muted-foreground text-sm font-medium">{unit}</span>
        )}
      </p>
      {secondary && <p className="text-muted-foreground text-[11px]">{secondary}</p>}
    </div>
  );
}
