'use client';

import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { useAdminLlmLog } from '@/hooks/use-admin-llm-logs';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface LlmLogDrawerProps {
  logId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5">
      <div className="text-muted-foreground w-32 shrink-0 text-sm">{label}</div>
      <div className="flex-1 text-sm break-all">{value ?? '—'}</div>
    </div>
  );
}

export function LlmLogDrawer({ logId, open, onOpenChange }: LlmLogDrawerProps) {
  const { data: log, isLoading } = useAdminLlmLog(logId ?? '');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>LLM Log Details</SheetTitle>
          <SheetDescription>Full details for the selected LLM API call.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-1 px-4 pb-6">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : !log ? (
            <div className="text-muted-foreground py-8 text-sm">Log not found.</div>
          ) : (
            <>
              <Row label="ID" value={<span className="font-mono">{log.id}</span>} />
              <Row label="Timestamp" value={format(log.timestamp, 'PPP HH:mm:ss')} />
              <Row label="Endpoint" value={<span className="font-mono">{log.endpoint}</span>} />
              <Row label="Model" value={log.model} />
              <Row
                label="User"
                value={
                  log.user ? `${log.user.displayName ?? log.user.email} (${log.user.email})` : '—'
                }
              />
              <Row label="Chat Session" value={log.chatSession ? log.chatSession.title : '—'} />
              <Row label="Tokens Used" value={log.tokensUsed} />
              <Row label="Prompt Tokens" value={log.promptTokens} />
              <Row label="Completion Tokens" value={log.completionTokens} />
              <Row label="Reasoning Tokens" value={log.reasoningTokens} />
              <Row label="Cached Input Tokens" value={log.cachedInputTokens} />
              <Row
                label="Latency"
                value={log.responseTimeMs != null ? `${log.responseTimeMs} ms` : '—'}
              />
              <Row
                label="Finish Reason"
                value={
                  log.errorMessage ? (
                    <Badge variant="destructive">error</Badge>
                  ) : (
                    <Badge variant="secondary">{log.finishReason ?? 'unknown'}</Badge>
                  )
                }
              />
              {log.errorMessage && (
                <Row
                  label="Error"
                  value={<span className="text-destructive">{log.errorMessage}</span>}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
