/**
 * Admin tRPC Router
 * Admin-only - all procedures require admin role
 *
 * This router wraps Better Auth's admin plugin functionality in tRPC procedures.
 * User and session management operations are delegated to Better Auth's admin API.
 *
 * See: https://www.better-auth.com/docs/plugins/admin
 */
import { headers } from 'next/headers';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { invalidateWebhookSecretCache } from '@/app/api/billing/webhook/route';

import { auth } from '@/lib/auth/providers';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import * as configService from '@/lib/services/config-service';
import { CONFIG_KEYS, type ConfigKey } from '@/lib/services/constants';
import * as llmLogsService from '@/lib/services/llm-logs-service';
import { validateUserDeletion } from '@/lib/services/user-service';
import { handleApiError } from '@/lib/utils';

import { adminProcedure, router } from '../init';
import {
  adminCreateUserSchema,
  adminDeleteUserSchema,
  adminGetLlmLogSchema,
  adminLlmLogsListSchema,
  adminUpdateUserSchema,
  adminUserListFiltersSchema,
} from '../schemas/admin';
import {
  deleteConfigSchema,
  getConfigSchema,
  listConfigsSchema,
  setConfigSchema,
} from '../schemas/config';

export const adminRouter = router({
  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  users: router({
    /**
     * List all users with filters and pagination
     * Uses Better Auth's admin.listUsers API
     */
    list: adminProcedure.input(adminUserListFiltersSchema).query(async ({ input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const offset = (page - 1) * pageSize;

      try {
        const result = await auth.api.listUsers({
          query: {
            limit: pageSize,
            offset,
            sortBy: 'createdAt',
            sortDirection: 'desc',
            ...(input?.searchQuery && {
              searchValue: input.searchQuery,
              searchField: 'email',
              searchOperator: 'contains',
            }),
          },
          headers: await headers(),
        });

        return {
          users: result.users.map((user) => ({
            ...user,
            displayName: user.name,
          })),
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list users',
          cause: error,
        });
      }
    }),

    /**
     * Get single user details
     */
    get: adminProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
      const user = await auth.api.getUser({
        query: {
          id: input.id,
        },
        headers: await headers(),
      });

      const [userRole] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      return {
        user: {
          ...user,
          displayName: user.name, // returned mapped custom fields
          role: userRole?.role,
        },
      };
    }),

    /**
     * Create new user
     *
     * Note: Better Auth's admin.createUser doesn't support passwordless authentication yet.
     * See: https://github.com/better-auth/better-auth/issues/4226
     * For now, we create users directly in the database
     */
    create: adminProcedure.input(adminCreateUserSchema).mutation(async ({ input }) => {
      const { email, role } = input;

      // Check if user already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser) {
        throw new TRPCError({ code: 'CONFLICT', message: 'User with this email already exists' });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          displayName: email,
          emailVerified: false,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newUser;
    }),

    /**
     * Update user details
     * Uses Better Auth's admin.updateUser API
     */
    update: adminProcedure.input(adminUpdateUserSchema).mutation(async ({ input }) => {
      const { id, displayName, ...updates } = input;

      await auth.api.adminUpdateUser({
        body: {
          userId: id,
          data: {
            ...updates,
            // map displayName to name
            name: displayName,
          },
        },
        headers: await headers(),
      });

      /**
       * Revoke all active sessions when security-sensitive fields change.
       * This ensures users must re-authenticate after:
       * - Role changes (admin permissions granted/revoked)
       * - Email verification status changes (security state change)
       */
      if (updates.role !== undefined || updates.emailVerified !== undefined) {
        await auth.api.revokeUserSessions({
          body: {
            userId: id,
          },
          headers: await headers(),
        });
      }

      return { success: true, message: 'User updated successfully' };
    }),

    /**
     * Hard deletes a user from the database.
     * Uses Better Auth's admin.removeUser API which properly handles session cleanup.
     */
    delete: adminProcedure.input(adminDeleteUserSchema).mutation(async ({ input }) => {
      const { id: userId } = input;

      try {
        await validateUserDeletion(userId);

        await auth.api.removeUser({
          body: {
            userId,
          },
          headers: await headers(),
        });

        await auth.api.revokeUserSessions({
          body: {
            userId,
          },
          headers: await headers(),
        });
      } catch (error) {
        handleApiError(error);
      }
    }),
  }),

  // ============================================================
  // LLM LOGS MANAGEMENT
  // ============================================================

  llmLogs: router({
    /**
     * List LLM logs with filters and pagination
     */
    list: adminProcedure.input(adminLlmLogsListSchema).query(async ({ input }) => {
      try {
        return await llmLogsService.listLlmLogs(input ?? {});
      } catch (error) {
        handleApiError(error);
      }
    }),

    /**
     * Get single LLM log with full details
     */
    get: adminProcedure.input(adminGetLlmLogSchema).query(async ({ input }) => {
      try {
        return await llmLogsService.getLlmLogById(input.id);
      } catch (error) {
        handleApiError(error);
      }
    }),
  }),

  /**
   * System configuration management
   * Nested router for system-wide config (Stripe keys)
   */
  config: router({
    /**
     * List configuration status for all CONFIG_KEYS
     * Returns masked values and existence status for each key
     */
    list: adminProcedure.input(listConfigsSchema).query(async () => {
      try {
        return await configService.listConfigStatus();
      } catch (error) {
        handleApiError(error);
      }
    }),

    /**
     * Get a single config (masked value only)
     */
    get: adminProcedure.input(getConfigSchema).query(async ({ input }) => {
      try {
        const value = await configService.getConfig(input.key);
        return {
          key: input.key,
          value: value ? configService.maskConfigValue(value) : null,
          exists: !!value,
        };
      } catch (error) {
        handleApiError(error);
      }
    }),

    /**
     * Set/update a config value
     */
    set: adminProcedure.input(setConfigSchema).mutation(async ({ input }) => {
      try {
        await configService.setConfig(input);

        // Invalidate webhook secret cache when updated
        if (input.key === CONFIG_KEYS.STRIPE_WEBHOOK_SECRET) {
          invalidateWebhookSecretCache();
        }

        return { success: true };
      } catch (error) {
        handleApiError(error);
      }
    }),

    /**
     * Delete a config value
     */
    delete: adminProcedure.input(deleteConfigSchema).mutation(async ({ input }) => {
      try {
        const deleted = await configService.deleteConfig(input.key as ConfigKey);

        // Invalidate webhook secret cache when deleted
        if (input.key === CONFIG_KEYS.STRIPE_WEBHOOK_SECRET) {
          invalidateWebhookSecretCache();
        }

        return { success: deleted };
      } catch (error) {
        handleApiError(error);
      }
    }),
  }),
});
