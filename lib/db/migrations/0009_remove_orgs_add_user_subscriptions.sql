-- Single-user SaaS migration: remove all organization concepts and add per-user Stripe billing.
-- All organization-scoped tables are dropped; org_id columns are removed from retained tables;
-- per-user fields are added on users; new user_subscriptions table is created.

-- 1. Drop FKs in sessions that reference organizations (must precede dropping organizations)
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_active_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_active_organization_slug_organizations_slug_fk";--> statement-breakpoint

-- 2. Drop org-related columns from sessions
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "active_organization_role";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "active_organization_id";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "active_organization_slug";--> statement-breakpoint

-- 3. Drop org-related tables (CASCADE handles cross-references)
DROP TABLE IF EXISTS "order_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "orders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tasks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "invitations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "org_memberships" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "org_subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organizations" CASCADE;--> statement-breakpoint

-- 4. Drop org-related enums
DROP TYPE IF EXISTS "public"."order_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."task_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."org_role";--> statement-breakpoint

-- 5. Explicitly drop org FKs on retained tables (CASCADE above usually handles this, but make idempotent)
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "rag_settings" DROP CONSTRAINT IF EXISTS "rag_settings_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "llm_logs" DROP CONSTRAINT IF EXISTS "llm_logs_organization_id_organizations_id_fk";--> statement-breakpoint

-- 6. Drop organization_id columns from retained tables
ALTER TABLE "documents" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "rag_settings" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint
ALTER TABLE "llm_logs" DROP COLUMN IF EXISTS "organization_id";--> statement-breakpoint

-- 7. rag_settings was org-scoped; clear and rewire to per-user with unique constraint.
TRUNCATE TABLE "rag_settings";--> statement-breakpoint
ALTER TABLE "rag_settings" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rag_settings" ADD CONSTRAINT "rag_settings_user_id_unique" UNIQUE ("user_id");--> statement-breakpoint
ALTER TABLE "rag_settings" ADD CONSTRAINT "rag_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 8. Re-add documents.user_id FK with ON DELETE CASCADE (previously no action)
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 9. Add stripe_customer_id to users (per-user Stripe billing)
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_unique" UNIQUE ("stripe_customer_id");--> statement-breakpoint

-- 10. Create user_subscriptions table
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"stripe_price_id" text,
	"status" text NOT NULL,
	"tier" text NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" text DEFAULT 'false' NOT NULL,
	"scheduled_downgrade_tier" text,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
