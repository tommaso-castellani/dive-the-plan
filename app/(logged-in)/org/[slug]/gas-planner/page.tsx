'use client';

import { useState } from 'react';

import type { DivingMode } from '@/lib/gas-planner/calculations';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BestMixTab } from './components/best-mix-tab';
import { GasCheckTab } from './components/gas-check-tab';
import { ModCheckTab } from './components/mod-check-tab';

export default function GasPlannerPage() {
  const [mode, setMode] = useState<DivingMode>('CCR');

  const handleModeChange = (next: string) => {
    if (next !== 'OC' && next !== 'CCR') return;
    setMode(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Gas Planner</h1>
          <p className="text-muted-foreground text-sm">
            Calculate optimal blends, verify gases, and check MOD limits for technical diving.
          </p>
        </div>
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTrigger value="OC">Open Circuit</TabsTrigger>
            <TabsTrigger value="CCR">CCR</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs defaultValue="best-mix" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="best-mix">Best Mix</TabsTrigger>
          <TabsTrigger value="gas-check">Gas Check</TabsTrigger>
          <TabsTrigger value="mod-check">MOD Check</TabsTrigger>
        </TabsList>

        <TabsContent value="best-mix">
          {/* `key={mode}` remounts the tab on OC/CCR switch so its state
              re-initializes from mode-appropriate defaults. */}
          <BestMixTab key={mode} mode={mode} />
        </TabsContent>

        <TabsContent value="gas-check">
          <GasCheckTab key={mode} mode={mode} />
        </TabsContent>

        <TabsContent value="mod-check">
          <ModCheckTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
