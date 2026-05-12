import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { type NewRagSettings, type RagSettings, ragSettings } from '@/lib/db/schema';

/**
 * Get RAG settings for a user
 * @param userId - The ID of the user
 * @returns The RAG settings or null if not found
 */
export async function getRAGSettings(
  userId: NewRagSettings['userId']
): Promise<RagSettings | null> {
  const [settings] = await db
    .select()
    .from(ragSettings)
    .where(eq(ragSettings.userId, userId));

  return settings ?? null;
}
