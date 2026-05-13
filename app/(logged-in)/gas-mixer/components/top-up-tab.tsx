'use client';

import { useState } from 'react';

import { Calculator, Droplet, Gauge, Waves, Wind } from 'lucide-react';

import { type TopUpResult, calculateTopUp } from '@/lib/gas-mixer/mixer';
import { cn } from '@/lib/utils';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
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

  const hasMissingValue =
    !Number.isFinite(startPressure) ||
    !Number.isFinite(startO2Percent) ||
    !Number.isFinite(startHePercent) ||
    !Number.isFinite(endPressure) ||
    (topUpPreset === 'custom' &&
      (!Number.isFinite(customTopUpO2Percent) || !Number.isFinite(customTopUpHePercent)));

  const hasInputError =
    hasMissingValue || isStartMixInvalid || isTopUpMixInvalid || isPressureInvalid;

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
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-5">
      {/* Inputs column */}
      <div className="space-y-8 lg:col-span-2">
        <ColumnHeader
          title="Top-Up"
          description="Adding a known gas on top of the existing mix — see the resulting blend."
        />

        {/* Current tank */}
        <section className="space-y-4">
          <SubSectionLabel hint="What's already in the cylinder.">In The Tank</SubSectionLabel>
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
          <SubSectionLabel>Top-Up Gas</SubSectionLabel>
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
            <div className="space-y-3">
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
            </div>
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

        <Button onClick={handleCalculate} className="w-full" size="lg" disabled={hasInputError}>
          <Calculator className="h-4 w-4" />
          Calculate Final Mix
        </Button>
      </div>

      {/* Results column */}
      <div className="lg:border-border/60 space-y-8 lg:col-span-3 lg:border-l lg:pl-12">
        <ColumnHeader
          title="Resulting Mix"
          description="The composition of the cylinder after topping up to your final pressure."
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

function SubSectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
        {children}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function N2Readout({ value, invalid }: { value: number; invalid: boolean }) {
  return (
    <div className="border-border/60 flex items-baseline justify-between border-t pt-2.5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Waves className="h-3.5 w-3.5" />
        <span>N₂ balance</span>
      </div>
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          invalid ? 'text-destructive' : 'text-foreground'
        )}
      >
        {invalid ? 'Invalid mix' : `${value.toFixed(0)}%`}
      </span>
    </div>
  );
}

function ResultsEmpty() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-start justify-center">
      <p className="text-sm">Enter the current mix and top-up gas, then press Calculate.</p>
      <p className="mt-1 text-xs">The resulting blend will appear here.</p>
    </div>
  );
}

function ResultsView({ result }: { result: TopUpResult }) {
  if (!result.feasibility.ok) {
    return (
      <div className="flex h-64 flex-col items-start justify-center">
        <p className="text-destructive text-sm font-medium">Cannot compute the mix</p>
        <p className="text-muted-foreground mt-2 max-w-md text-xs">{result.feasibility.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Final mix */}
      <div className="grid grid-cols-3 gap-x-6 sm:gap-x-10">
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
      <div className="border-border/60 border-t pt-5">
        <p className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase">
          Top-up gas added
        </p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {result.addedBar.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-sm font-medium">bar</span>
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
