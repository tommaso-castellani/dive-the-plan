import { z } from 'zod';

// User Management Schemas
export const adminUserListFiltersSchema = z
  .object({
    searchQuery: z.string().optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
  })
  .optional();

export const adminUpdateUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1).max(255).optional(),
  email: z.email().optional(),
  emailVerified: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export const adminDeleteUserSchema = z.object({
  id: z.uuid(),
});

export const adminCreateUserSchema = z.object({
  email: z.email('Invalid email address'),
  role: z.enum(['admin', 'user']).optional().default('user'),
});

// LLM Logs Schemas
export const adminLlmLogsListSchema = z
  .object({
    searchQuery: z.string().optional(),
    userId: z.uuid().optional(),
    chatSessionId: z.uuid().optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(20),
  })
  .optional();

export const adminGetLlmLogSchema = z.object({
  id: z.uuid(),
});
