'use client';

import { useState } from 'react';

import { AlertTriangle, Calculator, Droplet, Gauge, Thermometer, Waves, Wind } from 'lucide-react';

import {
  type DivingMode,
  type MODCheckResult,
  type MODLimiter,
  calculateMODCheck,
} from '@/lib/gas-planner/calculations';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const DEFAULTS = {
  o2Percent: 21,
  hePercent: 35,
  targetPpO2: 1.4,
  targetEND: 30,
  targetDensity: 5.2,
  waterTemp: 20,
};

const TEMP_MIN = 0;
const TEMP_MAX = 32;

interface ModCheckTabProps {
  mode: DivingMode;
}

export function ModCheckTab({ mode }: ModCheckTabProps) {
  const [o2Percent, setO2Percent] = useState<number>(DEFAULTS.o2Percent);
  const [hePercent, setHePercent] = useState<number>(DEFAULTS.hePercent);
  const [targetPpO2, setTargetPpO2] = useState<number>(DEFAULTS.targetPpO2);
  const [targetEND, setTargetEND] = useState<number>(DEFAULTS.targetEND);
  const [targetDensity, setTargetDensity] = useState<number>(DEFAULTS.targetDensity);
  const [waterTemp, setWaterTemp] = useState<number>(DEFAULTS.waterTemp);
  const [result, setResult] = useState<MODCheckResult | null>(null);

  const n2Percent = Math.max(0, 100 - o2Percent - hePercent);
  const mixIsValid = o2Percent >= 0 && hePercent >= 0 && o2Percent + hePercent <= 100;

  const handleCalculate = () => {
    if (!mixIsValid) return;
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
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <Card className="lg:col-span-2">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">Parameters</CardTitle>
          <p className="text-muted-foreground text-sm">
            Enter your gas and the limits you want to check against.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Gas mix */}
          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">Gas Mix</Label>
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
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Balance N₂</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  !mixIsValid && 'text-destructive font-semibold'
                )}
              >
                {mixIsValid ? `${n2Percent.toFixed(1)}%` : 'O₂ + He exceeds 100%'}
              </span>
            </div>
          </div>

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

          {/* Target END */}
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

          {/* Target density */}
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

          {/* Water temperature */}
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

          <Button onClick={handleCalculate} disabled={!mixIsValid} className="w-full" size="lg">
            <Calculator className="h-4 w-4" />
            Calculate
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="lg:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">MOD Check</CardTitle>
          <p className="text-muted-foreground text-sm">
            Maximum operating depth from each limit. The smallest is the binding one.
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

function ResultsEmpty() {
  return (
    <div className="text-muted-foreground flex h-64 flex-col items-center justify-center text-center">
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
    ? `${result.limitingMOD.toFixed(0)} m`
    : '—';

  return (
    <div className="space-y-8">
      {/* Headline limiting MOD */}
      <div className="bg-muted/40 flex items-start gap-4 rounded-md p-5">
        <AlertTriangle className="text-chart-3 mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Limiting MOD
          </p>
          <p className="text-3xl font-semibold tabular-nums">{limitingDisplay}</p>
          <p className="text-muted-foreground text-sm">
            This blend is constrained by{' '}
            <span className="text-foreground font-medium">{LIMITER_LABEL[result.limiter]}</span> at
            the depth above.
          </p>
        </div>
      </div>

      {/* Per-limit breakdown */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          Per-limit Maximum Operating Depth
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MODCard
            label="MOD by ppO₂"
            value={result.modByPpO2}
            isLimiter={result.limiter === 'ppO2'}
          />
          <MODCard
            label="MOD by END"
            value={result.modByEND}
            isLimiter={result.limiter === 'END'}
          />
          <MODCard
            label="MOD by Density"
            value={result.modByDensity}
            isLimiter={result.limiter === 'density'}
          />
        </div>
      </div>
    </div>
  );
}

interface MODCardProps {
  label: string;
  value: number;
  isLimiter: boolean;
}

function MODCard({ label, value, isLimiter }: MODCardProps) {
  const display = Number.isFinite(value) ? `${value.toFixed(0)} m` : '—';
  return (
    <div
      className={cn(
        'rounded-md p-4 transition-colors',
        isLimiter ? 'bg-primary/10 border-primary/40 border' : 'bg-muted/40'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">{label}</p>
        {isLimiter && (
          <span className="text-primary text-[10px] font-semibold tracking-wide uppercase">
            Limiting
          </span>
        )}
      </div>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', isLimiter && 'text-primary')}>
        {display}
      </p>
    </div>
  );
}
