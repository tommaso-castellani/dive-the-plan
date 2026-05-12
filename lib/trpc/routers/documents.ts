import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike } from 'drizzle-orm';

import { deleteDocumentFromFileSearchStore, deleteFileSearchStore } from '@/lib/ai/rag';
import { db } from '@/lib/db/drizzle';
import { documents } from '@/lib/db/schema';
import { addIndexDocumentJob } from '@/lib/queue/queues/documents';
import { deleteDocument, getPresignedDownloadUrl, uploadDocument } from '@/lib/storage';
import { protectedProcedure, router } from '@/lib/trpc/init';
import {
  deleteDocumentSchema,
  getDownloadUrlSchema,
  listDocumentsSchema,
  uploadDocumentSchema,
} from '@/lib/trpc/schemas/documents';

export const documentsRouter = router({
  /**
   * List all documents for the current user
   */
  list: protectedProcedure.input(listDocumentsSchema).query(async ({ ctx, input }) => {
    const { searchQuery, page, pageSize } = input;
    const { userId } = ctx;

    const conditions = [eq(documents.userId, userId)];

    // Add search filter
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = `%${searchQuery.trim()}%`;
      conditions.push(ilike(documents.displayName, searchTerm));
    }

    const offset = (page - 1) * pageSize;

    const totalResult = await db
      .select({ count: documents.id })
      .from(documents)
      .where(and(...conditions));
    const total = totalResult.length;

    const results = await db
      .select({
        id: documents.id,
        displayName: documents.displayName,
        sizeBytes: documents.sizeBytes,
        status: documents.status,
        createdAt: documents.createdAt,
        storageUrl: documents.storageUrl,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      documents: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }),

  /**
   * Get a presigned download URL for a document
   * Production: Returns S3 presigned URL (5 min expiry)
   * Development: Returns authenticated API route URL
   */
  getDownloadUrl: protectedProcedure.input(getDownloadUrlSchema).query(async ({ ctx, input }) => {
    const { id } = input;
    const { userId } = ctx;

    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    const downloadUrl = await getPresignedDownloadUrl(document.storageUrl);

    return {
      url: downloadUrl,
      displayName: document.displayName,
    };
  }),

  /**
   * Upload a document to S3 and queue for File Search indexing
   * Returns immediately after S3 upload - indexing happens async
   */
  upload: protectedProcedure.input(uploadDocumentSchema).mutation(async ({ ctx, input }) => {
    const { displayName, mimeType, sizeBytes, fileData } = input;
    const { userId } = ctx;

    // Convert base64 to buffer (strip data URL prefix if present)
    const base64Data = fileData.split(',')[1] || fileData;
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const file = new File([fileBuffer], displayName, { type: mimeType });

    const storageUrl = await uploadDocument(file, userId);

    // Store document metadata in database with 'in_progress' status
    // documentResourceName and fileSearchStoreName will be set by the queue job
    const [newDocument] = await db
      .insert(documents)
      .values({
        userId,
        displayName,
        mimeType,
        sizeBytes,
        storageUrl,
        status: 'in_progress',
      })
      .returning();

    // Queue document for File Search indexing (async)
    await addIndexDocumentJob({
      documentId: newDocument.id,
      userId,
      storageUrl,
      displayName,
      mimeType,
      fileData,
    });

    console.log('[DOCUMENTS] 📤 Document uploaded to storage, queued for indexing:', {
      documentId: newDocument.id,
      displayName,
    });

    return { id: newDocument.id, status: newDocument.status };
  }),

  /**
   * Delete a document from S3, File Search Store, and database
   */
  delete: protectedProcedure.input(deleteDocumentSchema).mutation(async ({ ctx, input }) => {
    const { id } = input;
    const { userId } = ctx;

    const document = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Delete from database
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));

    // Delete from S3 or local storage
    await deleteDocument(document.storageUrl);

    // Delete document chunks from File Search Store (only if indexed)
    if (document.documentResourceName && document.status === 'ready') {
      try {
        await deleteDocumentFromFileSearchStore({ name: document.documentResourceName });
      } catch (error) {
        console.error('Failed to delete document from File Search Store:', error);
        // Continue with DB deletion even if File Search deletion fails
      }

      // Check if this was the last document in the file search store
      if (document.fileSearchStoreName) {
        const remainingDocs = await db.query.documents.findFirst({
          where: eq(documents.fileSearchStoreName, document.fileSearchStoreName),
        });

        // If no more documents, delete the file search store
        if (!remainingDocs) {
          try {
            await deleteFileSearchStore({ name: document.fileSearchStoreName });
          } catch (error) {
            console.error('Failed to delete file search store:', error);
            // Don't throw error as document is already deleted
          }
        }
      }
    }

    return { success: true };
  }),
});
