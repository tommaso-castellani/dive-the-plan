'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FillUpTab } from './components/fill-up-tab';
import { TopUpTab } from './components/top-up-tab';

// Underline-style sub-tabs anchored on a single page-spanning hairline.
// Reads like an editorial section nav, not a SaaS pill switch.
const TAB_LIST =
  'h-auto w-full justify-start gap-2 rounded-none border-b border-border/60 bg-transparent p-0';
const TAB_TRIGGER =
  'h-auto rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

export default function GasMixerPage() {
  return (
    <div className="max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gas Mixer</h1>
        <p className="text-muted-foreground text-sm">
          Plan partial-pressure blends from any starting tank state, or preview the resulting mix
          after a top-up.
        </p>
      </header>

      <Tabs defaultValue="fill-up" className="space-y-10">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="fill-up" className={TAB_TRIGGER}>
            Fill Up
          </TabsTrigger>
          <TabsTrigger value="top-up" className={TAB_TRIGGER}>
            Top Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fill-up" className="mt-0">
          <FillUpTab />
        </TabsContent>

        <TabsContent value="top-up" className="mt-0">
          <TopUpTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
