'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Waves, Wind } from 'lucide-react';

import { type TopUpResult, calculateTopUp } from '@/lib/gas-planner/mixer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TopUpPreset = '21' | '32' | 'custom';

const PRESET_TO_O2: Record<Exclude<TopUpPreset, 'custom'>, number> = {
  '21': 21,
  '32': 32,
};

export function TopUpTab() {
  // Starting state in the tank
  const [startPressure, setStartPressure] = useState<number>(80);
  const [startO2Percent, setStartO2Percent] = useState<number>(32);
  const [startHePercent, setStartHePercent] = useState<number>(0);

  // Top-up gas
  const [topUpPreset, setTopUpPreset] = useState<TopUpPreset>('21');
  const [customTopUpO2Percent, setCustomTopUpO2Percent] = useState<number>(21);
  const [customTopUpHePercent, setCustomTopUpHePercent] = useState<number>(0);

  // Final pressure
  const [endPressure, setEndPressure] = useState<number>(200);

  const [result, setResult] = useState<TopUpResult | null>(null);

  const topUpO2Percent =
    topUpPreset === 'custom' ? customTopUpO2Percent : PRESET_TO_O2[topUpPreset];
  const topUpHePercent = topUpPreset === 'custom' ? customTopUpHePercent : 0;

  const startN2 = Math.max(0, 100 - startO2Percent - startHePercent);
  const topUpN2 = Math.max(0, 100 - topUpO2Percent - topUpHePercent);

  const isStartMixInvalid = startO2Percent + startHePercent > 100;
  const isTopUpMixInvalid = topUpO2Percent + topUpHePercent > 100;
  const isPressureInvalid = endPressure <= startPressure;

  const hasInputError = isStartMixInvalid || isTopUpMixInvalid || isPressureInvalid;

  const handleCalculate = () => {
    if (hasInputError) return;
    setResult(
      calculateTopUp({
        startPressure,
        endPressure,
        startO2: startO2Percent / 100,
        startHe: startHePercent / 100,
        topUpO2: topUpO2Percent / 100,
        topUpHe: topUpHePercent / 100,
      })
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Top-Up</CardTitle>
          <p className="text-muted-foreground text-sm">
            Adding a known gas on top of the existing mix — see the resulting blend.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Current tank */}
          <section className="space-y-4">
            <SubSection title="In The Tank" hint="What's already in the cylinder." />
            <NumberField
              id="topup-start-pressure"
              icon={<Gauge className="h-4 w-4" />}
              label="Initial Pressure"
              unit="bar"
              value={startPressure}
              min={0}
              max={400}
              step={1}
              onChange={setStartPressure}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="topup-start-o2"
                icon={<Droplet className="h-4 w-4" />}
                label="O₂"
                unit="%"
                value={startO2Percent}
                min={0}
                max={100}
                step={1}
                onChange={setStartO2Percent}
              />
              <NumberField
                id="topup-start-he"
                icon={<Wind className="h-4 w-4" />}
                label="He"
                unit="%"
                value={startHePercent}
                min={0}
                max={100}
                step={1}
                onChange={setStartHePercent}
              />
            </div>
            <N2Readout value={startN2} invalid={isStartMixInvalid} />
          </section>

          {/* Top-up gas */}
          <section className="space-y-4">
            <SubSection title="Top-Up Gas" />
            <ToggleGroup
              type="single"
              value={topUpPreset}
              onValueChange={(value) => {
                if (value === '21' || value === '32' || value === 'custom') {
                  setTopUpPreset(value);
                }
              }}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="21" className="flex-1">
                Air 21
              </ToggleGroupItem>
              <ToggleGroupItem value="32" className="flex-1">
                EAN 32
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="flex-1">
                Custom
              </ToggleGroupItem>
            </ToggleGroup>

            {topUpPreset === 'custom' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="topup-gas-o2"
                    icon={<Droplet className="h-4 w-4" />}
                    label="Top-up O₂"
                    unit="%"
                    value={customTopUpO2Percent}
                    min={0}
                    max={100}
                    step={1}
                    onChange={setCustomTopUpO2Percent}
                  />
                  <NumberField
                    id="topup-gas-he"
                    icon={<Wind className="h-4 w-4" />}
                    label="Top-up He"
                    unit="%"
                    value={customTopUpHePercent}
                    min={0}
                    max={100}
                    step={1}
                    onChange={setCustomTopUpHePercent}
                  />
                </div>
                <N2Readout value={topUpN2} invalid={isTopUpMixInvalid} />
              </>
            )}

            <NumberField
              id="topup-end-pressure"
              icon={<Gauge className="h-4 w-4" />}
              label="Final Pressure"
              unit="bar"
              value={endPressure}
              min={0}
              max={400}
              step={1}
              onChange={setEndPressure}
            />
            {isPressureInvalid && (
              <p className="text-destructive text-xs">
                Final pressure must be greater than the starting pressure.
              </p>
            )}
          </section>

          <Button
            onClick={handleCalculate}
            className="w-full"
            size="lg"
            disabled={hasInputError}
          >
            <Calculator className="h-4 w-4" />
            Calculate Final Mix
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="lg:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Resulting Mix</CardTitle>
          <p className="text-muted-foreground text-sm">
            The composition of the cylinder after topping up to your final pressure.
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

interface NumberFieldProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ id, icon, label, unit, value, min, max, step, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
          className="pr-12"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}

function SubSection({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function N2Readout({ value, invalid }: { value: number; invalid: boolean }) {
  return (
    <div className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Waves className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground">N₂ (balance)</span>
      </div>
      <span
        className={`font-mono text-sm tabular-nums ${invalid ? 'text-destructive' : ''}`}
      >
        {invalid ? 'Invalid mix' : `${value.toFixed(0)}%`}
      </span>
    </div>
  );
}

function ResultsEmpty() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-center justify-center text-center">
      <p className="text-sm">Enter the current mix and top-up gas, then press Calculate.</p>
      <p className="mt-1 text-xs">The resulting blend will appear here.</p>
    </div>
  );
}

function ResultsView({ result }: { result: TopUpResult }) {
  if (!result.feasibility.ok) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-64 flex-col items-center justify-center rounded-md p-6 text-center">
        <p className="text-sm font-medium">Cannot compute the mix</p>
        <p className="mt-2 max-w-xs text-xs">{result.feasibility.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Final mix */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <MixStat
          icon={<Droplet className="h-4 w-4" />}
          label="O₂"
          value={result.finalO2Percent}
          accent="text-chart-1"
        />
        <MixStat
          icon={<Wind className="h-4 w-4" />}
          label="He"
          value={result.finalHePercent}
          accent="text-chart-2"
        />
        <MixStat
          icon={<Waves className="h-4 w-4" />}
          label="N₂"
          value={result.finalN2Percent}
          accent="text-chart-3"
        />
      </div>

      {/* Added gas summary */}
      <div className="bg-muted/40 rounded-md p-4">
        <p className="text-muted-foreground text-xs">Top-up gas added</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {result.addedBar.toFixed(1)}
          <span className="text-muted-foreground ml-1 text-sm font-normal">bar</span>
        </p>
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
