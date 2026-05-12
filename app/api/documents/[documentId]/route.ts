/**
 * Document Download Proxy
 *
 * This endpoint serves as a proxy for document downloads with presigned URLs.
 * It validates user access and generates fresh presigned URLs on each request.
 *
 * Security:
 * - Authenticates user via Better Auth
 * - Validates document exists and belongs to the authenticated user
 * - Generates fresh presigned URLs (1 hour expiry)
 *
 * Usage:
 * GET /api/documents/{documentId}
 */
import { NextRequest, NextResponse } from 'next/server';

import { and, eq } from 'drizzle-orm';

import { ApiResponseHandler } from '@/lib/api/responses';
import { auth } from '@/lib/auth/providers';
import { db } from '@/lib/db/drizzle';
import { documents } from '@/lib/db/schema';
import { getPresignedDownloadUrl } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ documentId: string }> }
) {
  try {
    const params = await props.params;
    const { documentId } = params;

    // Validate required parameters
    if (!documentId) {
      return ApiResponseHandler.badRequest('Missing documentId');
    }

    // Authenticate user
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;

    if (!user?.id) {
      return ApiResponseHandler.unauthorized();
    }

    // Verify the document exists and belongs to the authenticated user
    const document = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
      .limit(1);

    if (document.length === 0) {
      return ApiResponseHandler.notFound('Document not found');
    }

    const doc = document[0];

    if (!doc.storageUrl) {
      return ApiResponseHandler.notFound('Document has no storage URL');
    }

    // Generate presigned URL
    const presignedUrl = await getPresignedDownloadUrl(doc.storageUrl);

    // Redirect to presigned URL
    return NextResponse.redirect(presignedUrl);
  } catch (error) {
    console.error('Error serving document:', error);
    return ApiResponseHandler.internalServerError(
      error instanceof Error ? error.message : 'Failed to serve document'
    );
  }
}
