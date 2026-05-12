import { TRPCError } from '@trpc/server';
import { UIDataTypes, UIMessagePart, UITools } from 'ai';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { chatMessages, chatSessions } from '@/lib/db/schema';
import { protectedProcedure, router } from '@/lib/trpc/init';
import {
  createChatSessionSchema,
  deleteChatSessionSchema,
  getMessagesSchema,
  getSessionSchema,
  listChatSessionsSchema,
  updateChatSessionTitleSchema,
} from '@/lib/trpc/schemas/documents';
import { messageMetadataSchema } from '@/lib/types/chat';

// Sources are now stored in message metadata (not parts)
// Metadata format: { sources: [{ documentId: string, title: string, url?: string }] }

export const chatRouter = router({
  /**
   * List all chat sessions for the current user
   * Uses efficient SQL COUNT() for pagination
   */
  listSessions: protectedProcedure.input(listChatSessionsSchema).query(async ({ ctx, input }) => {
    const { page, pageSize } = input;
    const offset = (page - 1) * pageSize;

    // Get total count using SQL COUNT() function (efficient)
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(chatSessions)
      .where(eq(chatSessions.userId, ctx.userId));

    // Get paginated results
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, ctx.userId))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      sessions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }),

  getSession: protectedProcedure.input(getSessionSchema).query(async ({ ctx, input }) => {
    const { chatSessionId } = input;

    const session = await db.query.chatSessions.findFirst({
      where: and(eq(chatSessions.id, chatSessionId), eq(chatSessions.userId, ctx.userId)),
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Chat session not found',
      });
    }

    return session;
  }),

  /**
   * Get all messages for a chat session in UIMessage format
   * Sources contain document IDs + proxy URLs for downloads
   * Uses Zod validation for runtime type safety
   */
  getMessages: protectedProcedure.input(getMessagesSchema).query(async ({ ctx, input }) => {
    const { chatSessionId } = input;

    // Verify session exists and belongs to the user
    const session = await db.query.chatSessions.findFirst({
      where: and(eq(chatSessions.id, chatSessionId), eq(chatSessions.userId, ctx.userId)),
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Chat session not found',
      });
    }

    // Get messages ordered by creation time
    const rawMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatSessionId, chatSessionId))
      .orderBy(asc(chatMessages.createdAt));

    // Parse messages with runtime validation
    const messages = rawMessages.map((message) => {
      try {
        const parts = JSON.parse(message.parts) as UIMessagePart<UIDataTypes, UITools>[];

        const metadata = message.metadata ? JSON.parse(message.metadata) : undefined;

        // Validate metadata structure (contains document sources)
        if (metadata) {
          messageMetadataSchema.parse(metadata);
        }

        return {
          id: message.id,
          role: message.role,
          parts,
          metadata,
          createdAt: message.createdAt,
        };
      } catch (error) {
        console.error('Message validation failed:', {
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to parse message data',
          cause: error,
        });
      }
    });

    return { messages };
  }),

  /**
   * Create a new chat session
   */
  createSession: protectedProcedure
    .input(createChatSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const { title } = input;

      const [session] = await db
        .insert(chatSessions)
        .values({
          userId: ctx.userId,
          title,
        })
        .returning();

      return session;
    }),

  /**
   * Delete a chat session
   */
  deleteSession: protectedProcedure
    .input(deleteChatSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const { chatSessionId } = input;

      // Delete session (messages will cascade delete)
      await db
        .delete(chatSessions)
        .where(and(eq(chatSessions.id, chatSessionId), eq(chatSessions.userId, ctx.userId)));

      return { success: true };
    }),

  /**
   * Update chat session title
   */
  updateSession: protectedProcedure
    .input(updateChatSessionTitleSchema)
    .mutation(async ({ ctx, input }) => {
      const { chatSessionId, title } = input;

      await db
        .update(chatSessions)
        .set({ title, updatedAt: new Date() })
        .where(and(eq(chatSessions.id, chatSessionId), eq(chatSessions.userId, ctx.userId)));

      return { success: true };
    }),
});
