'use client';

import { useState } from 'react';

import {
  ArrowRight,
  Calculator,
  Droplet,
  Gauge,
  Layers,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react';

import {
  type FillFirstGas,
  type FillUpResult,
  type FillUpStep,
  calculateFillUp,
} from '@/lib/gas-mixer/mixer';
import { cn } from '@/lib/utils';

import { NumberField } from '@/components/number-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TopUpPreset = '21' | '32' | 'custom';

const PRESET_TO_O2: Record<Exclude<TopUpPreset, 'custom'>, number> = {
  '21': 21, // Air
  '32': 32, // EAN32
};

const TEMP_MIN = 0;
const TEMP_MAX = 40;

export function FillUpTab() {
  // Starting state
  const [startPressure, setStartPressure] = useState<number>(50);
  const [startO2Percent, setStartO2Percent] = useState<number>(21);
  const [startHePercent, setStartHePercent] = useState<number>(0);

  // Target state
  const [endPressure, setEndPressure] = useState<number>(200);
  const [finalO2Percent, setFinalO2Percent] = useState<number>(18);
  const [finalHePercent, setFinalHePercent] = useState<number>(45);

  // Settings
  const [topUpPreset, setTopUpPreset] = useState<TopUpPreset>('21');
  const [customTopUpO2Percent, setCustomTopUpO2Percent] = useState<number>(21);
  const [customTopUpHePercent, setCustomTopUpHePercent] = useState<number>(0);
  const [firstGas, setFirstGas] = useState<FillFirstGas>('He');
  const [ambientTemp, setAmbientTemp] = useState<number>(20);

  const [result, setResult] = useState<FillUpResult | null>(null);

  const topUpO2Percent =
    topUpPreset === 'custom' ? customTopUpO2Percent : PRESET_TO_O2[topUpPreset];
  const topUpHePercent = topUpPreset === 'custom' ? customTopUpHePercent : 0;

  // Live N₂ readouts
  const startN2 = Math.max(0, 100 - startO2Percent - startHePercent);
  const finalN2 = Math.max(0, 100 - finalO2Percent - finalHePercent);
  const topUpN2 = Math.max(0, 100 - topUpO2Percent - topUpHePercent);

  const isStartMixInvalid = startO2Percent + startHePercent > 100;
  const isFinalMixInvalid = finalO2Percent + finalHePercent > 100;
  const isTopUpMixInvalid = topUpO2Percent + topUpHePercent > 100;
  const isPressureInvalid = endPressure <= startPressure;

  // Treat empty/unparseable fields (NaN) as incomplete so we don't compute on them.
  const hasMissingValue =
    !Number.isFinite(startPressure) ||
    !Number.isFinite(startO2Percent) ||
    !Number.isFinite(startHePercent) ||
    !Number.isFinite(endPressure) ||
    !Number.isFinite(finalO2Percent) ||
    !Number.isFinite(finalHePercent) ||
    (topUpPreset === 'custom' &&
      (!Number.isFinite(customTopUpO2Percent) || !Number.isFinite(customTopUpHePercent)));

  const hasInputError =
    hasMissingValue ||
    isStartMixInvalid ||
    isFinalMixInvalid ||
    isTopUpMixInvalid ||
    isPressureInvalid;

  const handleCalculate = () => {
    if (hasInputError) return;
    setResult(
      calculateFillUp({
        startPressure,
        endPressure,
        startO2: startO2Percent / 100,
        startHe: startHePercent / 100,
        finalO2: finalO2Percent / 100,
        finalHe: finalHePercent / 100,
        topUpO2: topUpO2Percent / 100,
        topUpHe: topUpHePercent / 100,
        firstGas,
        temperatureC: ambientTemp,
      })
    );
  };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-5">
      {/* Inputs column */}
      <div className="space-y-8 lg:col-span-2">
        <ColumnHeader
          title="Fill Plan"
          description="Enter your current tank state and the target blend & pressure."
        />

        {/* Starting state */}
        <section className="space-y-4">
          <SubSectionLabel hint="What's currently in the tank — drained, heel, or leftover mix.">
            Starting State
          </SubSectionLabel>
          <NumberField
            id="start-pressure"
            icon={<Gauge className="h-4 w-4" />}
            label="Starting Pressure"
            unit="bar"
            value={startPressure}
            min={0}
            max={400}
            step={1}
            onChange={setStartPressure}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="start-o2"
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
              id="start-he"
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

        {/* Target state */}
        <section className="space-y-4">
          <SubSectionLabel hint="Final tank pressure and the blend you want.">
            Target
          </SubSectionLabel>
          <NumberField
            id="end-pressure"
            icon={<Gauge className="h-4 w-4" />}
            label="Final Pressure"
            unit="bar"
            value={endPressure}
            min={0}
            max={400}
            step={1}
            onChange={setEndPressure}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="final-o2"
              icon={<Droplet className="h-4 w-4" />}
              label="O₂"
              unit="%"
              value={finalO2Percent}
              min={0}
              max={100}
              step={1}
              onChange={setFinalO2Percent}
            />
            <NumberField
              id="final-he"
              icon={<Wind className="h-4 w-4" />}
              label="He"
              unit="%"
              value={finalHePercent}
              min={0}
              max={100}
              step={1}
              onChange={setFinalHePercent}
            />
          </div>
          <N2Readout value={finalN2} invalid={isFinalMixInvalid} />
          {isPressureInvalid && (
            <p className="text-destructive text-xs">
              Final pressure must be greater than starting pressure.
            </p>
          )}
        </section>

        {/* Settings */}
        <section className="space-y-5">
          <SubSectionLabel>Settings</SubSectionLabel>

          {/* Top-up gas preset */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Top-up Gas</Label>
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
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="topup-o2"
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
                    id="topup-he"
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
          </div>

          {/* Add first */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4" />
              Add First
            </Label>
            <ToggleGroup
              type="single"
              value={firstGas}
              onValueChange={(value) => {
                if (value === 'O2' || value === 'He') setFirstGas(value);
              }}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="He" className="flex-1">
                Pure He
              </ToggleGroupItem>
              <ToggleGroupItem value="O2" className="flex-1">
                Pure O₂
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Ambient temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="ambient-temp"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Thermometer className="h-4 w-4" />
                Ambient Temperature
              </Label>
              <span className="text-muted-foreground font-mono text-sm tabular-nums">
                {ambientTemp}°C
              </span>
            </div>
            <Slider
              id="ambient-temp"
              value={[ambientTemp]}
              onValueChange={(values) => setAmbientTemp(values[0])}
              min={TEMP_MIN}
              max={TEMP_MAX}
              step={1}
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{TEMP_MIN}°C</span>
              <span>{TEMP_MAX}°C</span>
            </div>
          </div>
        </section>

        <Button onClick={handleCalculate} className="w-full" size="lg" disabled={hasInputError}>
          <Calculator className="h-4 w-4" />
          Calculate Fill Plan
        </Button>
      </div>

      {/* Results column */}
      <div className="space-y-8 lg:col-span-3 lg:border-l lg:border-border/60 lg:pl-12">
        <ColumnHeader
          title="Fill Steps"
          description="Add the gases in order. Watch the gauge reach each target pressure before switching."
        />
        {result ? <ResultsView result={result} ambientTemp={ambientTemp} /> : <ResultsEmpty />}
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

function SubSectionLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
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
      <p className="text-sm">Enter your fill parameters and press Calculate.</p>
      <p className="mt-1 text-xs">The fill order and gauge targets will appear here.</p>
    </div>
  );
}

function ResultsView({ result, ambientTemp }: { result: FillUpResult; ambientTemp: number }) {
  if (!result.feasibility.ok) {
    return (
      <div className="flex h-64 flex-col items-start justify-center">
        <p className="text-destructive text-sm font-medium">Cannot reach this target</p>
        <p className="text-muted-foreground mt-2 max-w-md text-xs">{result.feasibility.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="border-border/60 border-t">
        {result.steps.map((step, index) => (
          <StepRow key={index} number={index + 1} step={step} />
        ))}
      </ol>

      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <Thermometer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Gauge targets assume tank at thermal equilibrium near {ambientTemp}°C. Allow gases to
          cool between stages.
        </span>
      </div>
    </div>
  );
}

function StepRow({ number, step }: { number: number; step: FillUpStep }) {
  const isBleed = step.gas === 'Bleed';
  const isSkipped = !isBleed && step.addedBar < 0.1;

  const accent = isBleed
    ? 'text-destructive'
    : step.gas === 'O2'
      ? 'text-chart-1'
      : step.gas === 'He'
        ? 'text-chart-2'
        : 'text-chart-3';

  const title = isBleed ? step.label : `Add ${step.label}`;
  const unitCaption = isBleed ? 'bar released' : 'bar added';

  return (
    <li
      className={cn(
        'border-border/60 grid grid-cols-[auto_1fr_auto] items-center gap-x-6 border-b py-4',
        isSkipped && 'opacity-40'
      )}
    >
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        {String(number).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', accent)}>
          {title}
          {isSkipped && (
            <span className="text-muted-foreground ml-2 text-xs font-normal">— not needed</span>
          )}
        </p>
        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 font-mono text-xs tabular-nums">
          <span>{step.fromPressure.toFixed(1)} bar</span>
          <ArrowRight className="h-3 w-3" />
          <span>{step.toPressure.toFixed(1)} bar</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 text-right">
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {step.addedBar.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-xs">{unitCaption}</span>
      </div>
    </li>
  );
}
