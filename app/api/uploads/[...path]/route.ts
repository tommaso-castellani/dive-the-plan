/**
 * Authenticated File Server for Development
 *
 * This route serves files from the local uploads/ directory in development only.
 * In production, files are served directly from S3 using presigned URLs.
 *
 * Security:
 * - Authenticates user via Better Auth
 * - Validates document exists and belongs to the authenticated user
 * - Prevents directory traversal attacks
 */
import { NextRequest, NextResponse } from 'next/server';

import { readFile } from 'fs/promises';
import path from 'path';

import { and, eq } from 'drizzle-orm';

import { ApiResponseHandler } from '@/lib/api';
import { auth } from '@/lib/auth/providers';
import { db } from '@/lib/db/drizzle';
import { documents } from '@/lib/db/schema';
import { getContentTypeByExtension } from '@/lib/documents/constants';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await props.params;
    const session = await auth.api.getSession({ headers: await request.headers });
    const user = session?.user;

    if (!user?.id) {
      return ApiResponseHandler.unauthorized();
    }

    // Reconstruct the file path from the URL segments
    const filePath = params.path.join('/');

    // Security: Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return ApiResponseHandler.badRequest('Invalid file path');
    }

    // Extract userId from the path (documents/{userId}/...)
    const pathParts = filePath.split('/');
    if (pathParts[0] !== 'documents' || !pathParts[1]) {
      return ApiResponseHandler.badRequest('Invalid file path');
    }

    const userIdFromPath = pathParts[1];

    // Ensure the user owns this path
    if (userIdFromPath !== user.id) {
      return ApiResponseHandler.forbidden('You do not have access to this file');
    }

    // Verify the document exists in the database and belongs to this user
    const document = await db
      .select()
      .from(documents)
      .where(and(eq(documents.storageUrl, filePath), eq(documents.userId, user.id)))
      .limit(1);

    if (document.length === 0) {
      return ApiResponseHandler.notFound('Document not found');
    }

    // Serve the file from local storage
    const fullPath = path.join(UPLOAD_DIR, filePath);
    const fileBuffer = await readFile(fullPath);

    // Determine content type from file extension using centralized constants
    const contentType = getContentTypeByExtension(filePath);

    const DOWNLOAD_CACHE_MAX_AGE = 60 * 60; // 1 hour
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document[0].displayName}"`,
        'Cache-Control': `private, max-age=${DOWNLOAD_CACHE_MAX_AGE}`,
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return ApiResponseHandler.notFound('File not found');
  }
}
