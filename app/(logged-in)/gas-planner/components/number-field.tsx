'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

/**
 * Numeric input that keeps its own raw-string state so the user can:
 *  - clear the field (instead of getting stuck on "0")
 *  - type decimals naturally (e.g. "1." → "1.5") without losing the trailing dot
 *  - type a leading minus sign or partial values without them being rewritten
 *
 * Emits `NaN` to the parent when the field is empty or unparseable, so callers
 * can disable submission until a valid number is entered. Numeric values from
 * the parent are mirrored into the input only when they differ from what the
 * user has currently typed (preventing "fights" with React re-renders).
 */
export function NumberField({
  id,
  icon,
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: NumberFieldProps) {
  // Raw text the user is typing. The parent's numeric `value` is mirrored in
  // here, but user input is the source of truth between renders.
  const [text, setText] = useState<string>(() => (Number.isFinite(value) ? String(value) : ''));

  // Sync external numeric changes (e.g. mode-switch defaults) into the input
  // when they don't match what's currently typed. Comparing via parseFloat
  // means "1.50" and 1.5 are treated as equal and don't cause a re-set.
  useEffect(() => {
    const parsed = parseFloat(text);
    if (Number.isFinite(value)) {
      if (!Number.isFinite(parsed) || parsed !== value) {
        setText(String(value));
      }
    } else if (text !== '' && Number.isFinite(parsed)) {
      // Parent cleared the value while the field still has a parseable number.
      setText('');
    }
    // We deliberately only react to `value` changes here — depending on `text`
    // would cause this effect to fight the user's keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    // Intermediate states the user is mid-typing — surface as "no number yet".
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      onChange(Number.NaN);
      return;
    }

    const parsed = parseFloat(raw);
    onChange(Number.isFinite(parsed) ? parsed : Number.NaN);
  };

  const handleBlur = () => {
    // On blur, tidy the display: clear unparseable text, and canonicalise
    // things like "01" → "1". Preserve a trailing dot in case the user clicked
    // away while still composing a decimal.
    const parsed = parseFloat(text);
    if (!Number.isFinite(parsed)) {
      if (text !== '') setText('');
      return;
    }
    if (text.endsWith('.')) return;
    const canonical = String(parsed);
    if (canonical !== text) setText(canonical);
  };

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
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={handleBlur}
          className="pr-12"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}
