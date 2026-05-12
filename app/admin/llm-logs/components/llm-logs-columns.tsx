'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { inferRouterOutputs } from '@trpc/server';
import { format } from 'date-fns';

import type { AppRouter } from '@/lib/trpc/router';

import { Badge } from '@/components/ui/badge';

type RouterOutput = inferRouterOutputs<AppRouter>;
type LlmLogRow = RouterOutput['admin']['llmLogs']['list']['logs'][number];

export function getLlmLogsColumns(): ColumnDef<LlmLogRow>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="text-sm">{format(row.original.timestamp, 'MMM d, yyyy HH:mm:ss')}</span>
      ),
    },
    {
      accessorKey: 'endpoint',
      header: 'Endpoint',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.endpoint ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'model',
      header: 'Model',
      cell: ({ row }) => <span className="text-sm">{row.original.model ?? '—'}</span>,
    },
    {
      accessorKey: 'userDisplayName',
      header: 'User',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.userDisplayName ?? row.original.userEmail ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'tokensUsed',
      header: 'Tokens',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.tokensUsed ?? 0}</span>
      ),
    },
    {
      accessorKey: 'responseTimeMs',
      header: 'Latency',
      cell: ({ row }) => {
        const ms = row.original.responseTimeMs;
        return <span className="font-mono text-sm">{ms != null ? `${ms} ms` : '—'}</span>;
      },
    },
    {
      accessorKey: 'finishReason',
      header: 'Status',
      cell: ({ row }) => {
        const hasError = !!row.original.errorMessage;
        const finish = row.original.finishReason;
        if (hasError) {
          return <Badge variant="destructive">error</Badge>;
        }
        return <Badge variant="secondary">{finish ?? 'unknown'}</Badge>;
      },
    },
  ];
}
