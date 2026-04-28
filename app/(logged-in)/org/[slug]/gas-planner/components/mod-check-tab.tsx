import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ModCheckTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">MOD Check</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground flex h-48 flex-col items-center justify-center text-center">
          <p className="text-sm">MOD Check calculator coming next.</p>
          <p className="mt-1 text-xs">Compare a blend&apos;s MOD by ppO₂, density and END.</p>
        </div>
      </CardContent>
    </Card>
  );
}
