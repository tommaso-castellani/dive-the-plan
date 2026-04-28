'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BestMixTab } from './components/best-mix-tab';
import { GasCheckTab } from './components/gas-check-tab';
import { ModCheckTab } from './components/mod-check-tab';

export default function GasPlannerPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Gas Planner</h1>
        <p className="text-muted-foreground text-sm">
          Calculate optimal blends, verify gases, and check MOD limits for technical diving.
        </p>
      </div>

      <Tabs defaultValue="best-mix" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="best-mix">Best Mix</TabsTrigger>
          <TabsTrigger value="gas-check">Gas Check</TabsTrigger>
          <TabsTrigger value="mod-check">MOD Check</TabsTrigger>
        </TabsList>

        <TabsContent value="best-mix">
          <BestMixTab />
        </TabsContent>

        <TabsContent value="gas-check">
          <GasCheckTab />
        </TabsContent>

        <TabsContent value="mod-check">
          <ModCheckTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
