import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Enums
export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'system']);
export const documentStatusEnum = pgEnum('document_status', ['in_progress', 'ready', 'error']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  displayName: text('display_name').notNull(),
  profileImageUrl: text('profile_image_url'),
  notificationSettings: text('notification_settings'), // JSON string for notification preferences
  stripeCustomerId: text('stripe_customer_id').unique(), // Stripe customer ID for per-user billing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('accounts_userId_idx').on(table.userId)]
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)]
);

export const systemConfig = pgTable(
  'system_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull().unique(), // e.g., 'STRIPE_WEBHOOK_SECRET'
    value: text('value').notNull(), // Encrypted value (base64 encoded: iv:encrypted_data:auth_tag)
    description: text('description'), // Human-readable description
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('system_config_key_idx').on(table.key)]
);

// User Subscriptions - One subscription per user (Stripe-managed billing)
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique() // Enforce one subscription per user at database level
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  stripeSubscriptionId: text('stripe_subscription_id').unique(), // Stripe subscription ID (nullable for free tier)
  stripeCustomerId: text('stripe_customer_id'), // Stripe customer ID (references user's customer)
  stripePriceId: text('stripe_price_id'), // Stripe price ID (nullable for free tier)
  status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'unpaid', 'incomplete'
  tier: text('tier').notNull(), // Stores Stripe lookup_key (e.g., 'free_monthly', 'pro_monthly', 'business_monthly')
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: text('cancel_at_period_end').notNull().default('false'), // 'true' or 'false' - Stripe cancellation pattern
  scheduledDowngradeTier: text('scheduled_downgrade_tier'), // Target lookup_key for scheduled downgrade (nullable)
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Activity Logs - Optional app-specific logging
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  metadata: text('metadata'), // JSON string for additional context
});

// Documents - Files uploaded to Google File Search Store (per-user)
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  // Google Document resource identifier (format: fileSearchStores/*/documents/*) - used for deletion
  documentResourceName: text('document_resource_name'), // Nullable until File Search upload completes
  fileSearchStoreName: text('file_search_store_name'), // Nullable until File Search upload completes
  storageUrl: text('storage_url').notNull(), // S3 or local storage URL
  mimeType: text('mime_type').notNull(),
  sizeBytes: text('size_bytes').notNull(), // Stored as text to preserve large numbers
  status: documentStatusEnum('status').notNull().default('in_progress'), // Upload status
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// RAG Settings - Per-user RAG/AI configuration
export const ragSettings = pgTable('rag_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  systemPrompt: text('system_prompt'),
  maxOutputTokens: integer('max_output_tokens'),
  temperature: real('temperature'),
  topP: real('top_p'),
  topK: integer('top_k'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Chat Sessions - Conversation sessions with documents (per-user)
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  title: text('title').notNull(), // Auto-generated from first message
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Chat Messages - Individual messages in a chat session
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatSessionId: uuid('chat_session_id')
    .notNull()
    .references(() => chatSessions.id, {
      onDelete: 'cascade',
    }),
  role: chatMessageRoleEnum('role').notNull(),
  parts: text('parts').notNull(), // JSON string of UIMessagePart[] array
  metadata: text('metadata'), // JSON string for message metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// LLM Logs - General-purpose AI logging for all LLM operations
export const llmLogs = pgTable(
  'llm_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    endpoint: text('endpoint').notNull(), // 'chat', 'embeddings', 'summarization', etc.
    model: text('model').notNull(),
    systemPrompt: text('system_prompt'),
    userPrompt: text('user_prompt'), // JSON string of UIMessagePart[] array
    response: text('response'), // JSON string of UIMessagePart[] array
    tokensUsed: integer('tokens_used'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    reasoningTokens: integer('reasoning_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    responseTimeMs: integer('response_time_ms'),
    finishReason: text('finish_reason'), // 'stop', 'length', 'content-filter', 'tool-calls', 'error', 'other', 'unknown'
    errorMessage: text('error_message'),
    generationConfig: text('generation_config'), // JSON string of generationConfig from request
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    chatSessionId: uuid('chat_session_id').references(() => chatSessions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_llm_logs_timestamp').on(table.timestamp.desc()),
    index('idx_llm_logs_endpoint').on(table.endpoint),
    index('idx_llm_logs_user_id').on(table.userId),
    index('idx_llm_logs_chat_session_id').on(table.chatSessionId),
  ]
);

export const userRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  documents: many(documents),
  chatSessions: many(chatSessions),
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  ragSettings: one(ragSettings, {
    fields: [users.id],
    references: [ragSettings.userId],
  }),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const chatSessionRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.chatSessionId],
    references: [chatSessions.id],
  }),
}));

export const userSubscriptionRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
}));

export const ragSettingsRelations = relations(ragSettings, ({ one }) => ({
  user: one(users, {
    fields: [ragSettings.userId],
    references: [users.id],
  }),
}));

// Enums for type safety
// SubscriptionTier is now derived from products.json - import from @/lib/billing/products
export { SubscriptionTier } from '@/lib/billing/products';
export type { SubscriptionTierType } from '@/lib/billing/products';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
}

export enum ActivityType {
  SIGN_UP = 'sign_up',
  SIGN_IN = 'sign_in',
  SIGN_OUT = 'sign_out',
  UPDATE_PASSWORD = 'update_password',
  DELETE_ACCOUNT = 'delete_account',
  UPDATE_ACCOUNT = 'update_account',
  UPDATE_PREFERENCES = 'update_preferences',
  UPDATE_PROFILE = 'update_profile',
  PROFILE_IMAGE_UPDATED = 'profile_image_updated',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
}

// Types (derive from Drizzle schema to avoid Zod instance mismatches)
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Verification = InferSelectModel<typeof verifications>;
export type NewVerification = InferInsertModel<typeof verifications>;
export type UserSubscription = InferSelectModel<typeof userSubscriptions>;
export type NewUserSubscription = InferInsertModel<typeof userSubscriptions>;
export type ActivityLog = InferSelectModel<typeof activityLogs>;
export type NewActivityLog = InferInsertModel<typeof activityLogs>;
export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;
export type ChatSession = InferSelectModel<typeof chatSessions>;
export type NewChatSession = InferInsertModel<typeof chatSessions>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type NewChatMessage = InferInsertModel<typeof chatMessages>;
export type LLMLog = InferSelectModel<typeof llmLogs>;
export type NewLLMLog = InferInsertModel<typeof llmLogs>;
export type RagSettings = InferSelectModel<typeof ragSettings>;
export type NewRagSettings = Pick<
  InferInsertModel<typeof ragSettings>,
  'userId' | 'systemPrompt' | 'maxOutputTokens' | 'temperature' | 'topP' | 'topK'
>;
export type SystemConfig = InferSelectModel<typeof systemConfig>;
export type NewSystemConfig = InferInsertModel<typeof systemConfig>;

// Infer enum types from schema
export type ChatMessageRole = (typeof chatMessageRoleEnum.enumValues)[number];
export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];
