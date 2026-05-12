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

/**
 * Update RAG settings for a user
 * Creates settings if they don't exist
 * @param settings - The settings to update
 * @returns The updated RAG settings
 */
export async function updateRAGSettings(settings: NewRagSettings): Promise<RagSettings> {
  const { userId, ...updates } = settings;
  // Check if settings exist
  const existing = await getRAGSettings(userId);

  if (existing) {
    // Update existing settings
    const [updated] = await db
      .update(ragSettings)
      .set(updates)
      .where(eq(ragSettings.userId, userId))
      .returning();

    return updated;
  } else {
    // Create new settings
    const [created] = await db
      .insert(ragSettings)
      .values({
        userId,
        ...updates,
      })
      .returning();

    return created;
  }
}
