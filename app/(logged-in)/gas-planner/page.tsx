'use client';

import { useState } from 'react';

import type { DivingMode } from '@/lib/gas-planner/calculations';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BestMixTab } from './components/best-mix-tab';
import { GasCheckTab } from './components/gas-check-tab';
import { ModCheckTab } from './components/mod-check-tab';

// Underline-style sub-tabs to match the editorial layout. The top-right
// OC/CCR mode switch keeps the default segmented control — it's a binary
// configuration, not a navigation surface.
const SUB_TAB_LIST =
  'h-auto w-full justify-start gap-2 rounded-none border-b border-border/60 bg-transparent p-0';
const SUB_TAB_TRIGGER =
  'h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

export default function GasPlannerPage() {
  const [mode, setMode] = useState<DivingMode>('CCR');

  const handleModeChange = (next: string) => {
    if (next !== 'OC' && next !== 'CCR') return;
    setMode(next);
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Gas Planner</h1>
          <p className="text-muted-foreground text-sm">
            Calculate optimal blends, verify gases, and check MOD limits for technical diving.
          </p>
        </header>
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList>
            <TabsTrigger value="OC">Open Circuit</TabsTrigger>
            <TabsTrigger value="CCR">CCR</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs defaultValue="best-mix" className="space-y-10">
        <TabsList className={SUB_TAB_LIST}>
          <TabsTrigger value="best-mix" className={SUB_TAB_TRIGGER}>
            Best Mix
          </TabsTrigger>
          <TabsTrigger value="gas-check" className={SUB_TAB_TRIGGER}>
            Gas Check
          </TabsTrigger>
          <TabsTrigger value="mod-check" className={SUB_TAB_TRIGGER}>
            MOD Check
          </TabsTrigger>
        </TabsList>

        <TabsContent value="best-mix" className="mt-0">
          {/* `key={mode}` remounts the tab on OC/CCR switch so its state
              re-initializes from mode-appropriate defaults. */}
          <BestMixTab key={mode} mode={mode} />
        </TabsContent>

        <TabsContent value="gas-check" className="mt-0">
          <GasCheckTab key={mode} mode={mode} />
        </TabsContent>

        <TabsContent value="mod-check" className="mt-0">
          <ModCheckTab key={mode} mode={mode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
