'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Mountain, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type BestMixResult,
  type DivingMode,
  calculateBestMix,
} from '@/lib/gas-planner/calculations';
import { GAS_PLANNER_DEFAULTS, defaultPpO2 } from '@/lib/gas-planner/defaults';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Disable Calculate while any required field is empty / unparseable so we
  // don't quietly feed NaN into the calculation pipeline.
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
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Parameters</CardTitle>
          <p className="text-muted-foreground text-sm">Set your dive profile to compute the mix.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Depth */}
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

          {/* ppO2 — meaning differs by mode */}
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

          {/* Target END */}
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

          {/* Max density (CCR only, per spec) */}
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

          {/* Water temperature slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="water-temp" className="flex items-center gap-2 text-sm font-medium">
                <Thermometer className="h-4 w-4" />
                Water Temperature
              </Label>
              <span className="text-muted-foreground font-mono text-sm">{waterTemp}°C</span>
            </div>
            <Slider
              id="water-temp"
              value={[waterTemp]}
              onValueChange={(values) => setWaterTemp(values[0])}
              min={TEMP_MIN}
              max={TEMP_MAX}
              step={1}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{TEMP_MIN}°C</span>
              <span>{TEMP_MAX}°C</span>
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={!requiredFilled} className="w-full" size="lg">
            <Calculator className="h-4 w-4" />
            Calculate
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="lg:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Best Mix</CardTitle>
          <p className="text-muted-foreground text-sm">
            Optimal blend and operational depth limits.
          </p>
        </CardHeader>
        <CardContent>{result ? <ResultsView result={result} /> : <ResultsEmpty />}</CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResultsEmpty() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-center justify-center text-center">
      <p className="text-sm">Enter your parameters and press Calculate.</p>
      <p className="mt-1 text-xs">The recommended mix and MODs will appear here.</p>
    </div>
  );
}

function ResultsView({ result }: { result: BestMixResult }) {
  return (
    <div className="space-y-8">
      {/* Big mix display */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
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
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Maximum Operating Depth
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MODCard
            label="MOD by ppO₂"
            value={result.modByPpO2}
            secondary={`${result.partialPressures.ppO2.toFixed(2)} bar at depth`}
          />
          <MODCard
            label="MOD by Density"
            value={result.modByDensity}
            secondary={`${result.densityAtDepth.toFixed(2)} g/L at depth`}
          />
          <MODCard
            label="MOD by END"
            value={result.modByEND}
            secondary={`END ${result.endAtDepth.toFixed(0)} m at depth`}
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
    <div className="space-y-1">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-semibold tracking-tight tabular-nums ${accent}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-sm">%</span>
      </div>
    </div>
  );
}

interface MODCardProps {
  label: string;
  value: number;
  secondary?: string;
}

function MODCard({ label, value, secondary }: MODCardProps) {
  const display = Number.isFinite(value) ? `${value.toFixed(0)} m` : '—';
  return (
    <div className="bg-muted/40 rounded-md p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{display}</p>
      {secondary && <p className="text-muted-foreground mt-1 text-xs">{secondary}</p>}
    </div>
  );
}
