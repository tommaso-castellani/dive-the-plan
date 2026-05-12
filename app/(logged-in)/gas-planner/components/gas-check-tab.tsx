'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Mountain, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type DivingMode,
  type GasCheckResult,
  calculateGasCheck,
} from '@/lib/gas-planner/calculations';
import { GAS_PLANNER_DEFAULTS } from '@/lib/gas-planner/defaults';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { NumberField } from './number-field';

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

  // Live N2 readout — only meaningful once both gas fractions are entered.
  // Treat empty (NaN) O₂/He fields as "incomplete" rather than "invalid mix"
  // so the message reflects what the user actually did.
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
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Gas & Conditions</CardTitle>
          <p className="text-muted-foreground text-sm">
            Enter your blend, depth, and water temperature.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* O2 */}
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

          {/* He */}
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

          {/* N2 derived readout */}
          <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Waves className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">N₂ (balance)</span>
            </div>
            <span
              className={`font-mono text-sm tabular-nums ${isMixInvalid ? 'text-destructive' : ''}`}
            >
              {!gasEntered ? '—' : isMixInvalid ? 'Invalid mix' : `${n2Percent.toFixed(0)}%`}
            </span>
          </div>

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

          <Button onClick={handleCalculate} className="w-full" size="lg" disabled={!canCalculate}>
            <Calculator className="h-4 w-4" />
            Calculate
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="lg:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">At Depth</CardTitle>
          <p className="text-muted-foreground text-sm">
            Operational metrics for the entered blend at the target depth.
          </p>
        </CardHeader>
        <CardContent>
          {result ? <ResultsView result={result} mode={mode} /> : <ResultsEmpty />}
        </CardContent>
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
      <p className="text-sm">Enter your gas and conditions, then press Calculate.</p>
      <p className="mt-1 text-xs">ppO₂, density, and END at depth will appear here.</p>
    </div>
  );
}

function ResultsView({ result, mode }: { result: GasCheckResult; mode: DivingMode }) {
  return (
    <div className="space-y-8">
      {/* Mix display */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
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
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          At Target Depth
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            icon={<Gauge className="h-4 w-4" />}
            label={mode === 'OC' ? 'ppO₂' : 'Diluent ppO₂'}
            value={`${result.partialPressures.ppO2.toFixed(2)} bar`}
            secondary={`ppN₂ ${result.partialPressures.ppN2.toFixed(2)} · ppHe ${result.partialPressures.ppHe.toFixed(2)}`}
          />
          <MetricCard
            icon={<Wind className="h-4 w-4" />}
            label="Gas Density"
            value={`${result.densityAtDepth.toFixed(2)} g/L`}
            secondary="Recommended ≤ 5.2 g/L"
          />
          <MetricCard
            icon={<Waves className="h-4 w-4" />}
            label="END"
            value={`${result.endAtDepth.toFixed(0)} m`}
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

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}

function MetricCard({ icon, label, value, secondary }: MetricCardProps) {
  return (
    <div className="bg-muted/40 rounded-md p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {secondary && <p className="text-muted-foreground mt-1 text-xs">{secondary}</p>}
    </div>
  );
}
