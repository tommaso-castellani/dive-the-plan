'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FillUpTab } from './fill-up-tab';
import { TopUpTab } from './top-up-tab';

export function GasMixerSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Gas Mixer</h2>
        <p className="text-muted-foreground text-sm">
          Plan partial-pressure blends from any starting tank state, or preview the resulting mix
          after a top-up.
        </p>
      </div>

      <Tabs defaultValue="fill-up" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="fill-up">Fill Up</TabsTrigger>
          <TabsTrigger value="top-up">Top Up</TabsTrigger>
        </TabsList>

        <TabsContent value="fill-up">
          <FillUpTab />
        </TabsContent>

        <TabsContent value="top-up">
          <TopUpTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
