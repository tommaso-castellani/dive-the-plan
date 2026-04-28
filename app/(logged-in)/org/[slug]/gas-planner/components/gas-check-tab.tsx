import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GasCheckTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gas Check</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground flex h-48 flex-col items-center justify-center text-center">
          <p className="text-sm">Gas Check calculator coming next.</p>
          <p className="mt-1 text-xs">Verify ppO₂, ppN₂, density and END for any blend at depth.</p>
        </div>
      </CardContent>
    </Card>
  );
}
