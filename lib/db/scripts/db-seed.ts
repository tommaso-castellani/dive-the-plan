#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * This script populates the database with dummy data for development and testing.
 * It creates users, subscriptions, and activity logs.
 *
 * ⚠️ WARNING: This script should ONLY be run in development/test environments!
 *
 * Ensure you have run `bun run db:migrate` and `bun run db:push` before running this script.
 *
 * Usage: bun run db:seed
 */
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';

import { getStripe } from '@/lib/billing/client';
import { withPrefix } from '@/lib/billing/lookup-keys';
import { db } from '@/lib/db/drizzle';

import {
  ActivityType,
  type NewActivityLog,
  type NewUser,
  type NewUserSubscription,
  SubscriptionStatus,
  SubscriptionTier,
  activityLogs,
  userSubscriptions,
  users,
} from '../schema';

if (process.env.NODE_ENV === 'production') {
  console.error('Error: Seed script cannot be run in production environment!');
  console.error('This script is for development and testing only.');
  process.exit(1);
}

console.log('🔒 Environment check passed: Running in development mode\n');

function calculatePeriodEnd(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
}

async function seed() {
  console.log('🌱 Starting database seed...\n');
  console.log('📌 Note: If you encounter duplicate key errors, run `bun run db:reset`');
  const stripe = await getStripe();

  try {
    const janeSmithEmail = 'jane+dive_the_plan@example.com';
    const johnDoeEmail = 'john+dive_the_plan@example.com';

    console.log('👤 Creating users...');

    const johnNewUser: NewUser = {
      email: johnDoeEmail,
      displayName: 'John Doe',
      profileImageUrl: null,
      emailVerified: true,
      role: 'admin',
    };

    const janeNewUser: NewUser = {
      email: janeSmithEmail,
      displayName: 'Jane Smith',
      profileImageUrl: null,
      emailVerified: true,
      role: 'user',
    };

    const [johnUser] = await db
      .insert(users)
      .values(johnNewUser)
      .onConflictDoUpdate({ target: users.email, set: johnNewUser })
      .returning();

    const [janeUser] = await db
      .insert(users)
      .values(janeNewUser)
      .onConflictDoUpdate({ target: users.email, set: janeNewUser })
      .returning();

    console.log(`  ✅ Created admin user: ${johnDoeEmail}`);
    console.log(`  ✅ Created user: ${janeSmithEmail}\n`);

    // Create per-user free tier subscriptions
    console.log('💳 Creating subscriptions...');

    let freePriceId: string | null = null;

    try {
      const freeTierLookupKey = withPrefix(SubscriptionTier.FREE_MONTHLY);
      console.log(
        `  🔍 Fetching free tier price from Stripe (lookup key: ${freeTierLookupKey})...`
      );

      const freePrices = await stripe.prices.list({
        lookup_keys: [freeTierLookupKey],
        limit: 1,
        active: true,
      });
      freePriceId = freePrices.data[0]?.id || null;

      console.log(`  ✅ Found Stripe price ID: ${freePriceId || 'not found'}`);
    } catch (error) {
      console.warn(
        '  ⚠️  Could not fetch Stripe prices. Subscriptions will be created without Stripe data.'
      );
      console.warn(
        '     Make sure to run `bun run stripe:seed` first to create products in Stripe.'
      );
      console.warn('     Error:', error instanceof Error ? error.message : error);
    }

    async function createFreeTierSubscription(user: {
      id: string;
      email: string;
      displayName: string;
    }) {
      if (!freePriceId) {
        console.log(`  ℹ️  ${user.email}: No Stripe prices found - skipping subscription`);
        return;
      }

      try {
        const stripeCustomer = await stripe.customers.create({
          email: user.email,
          name: user.displayName,
          metadata: { userId: user.id },
        });

        await db
          .update(users)
          .set({ stripeCustomerId: stripeCustomer.id, updatedAt: new Date() })
          .where(eq(users.id, user.id));

        const stripeSubscription = await stripe.subscriptions.create({
          customer: stripeCustomer.id,
          items: [{ price: freePriceId }],
          metadata: {
            userId: user.id,
            tier: SubscriptionTier.FREE_MONTHLY,
          },
          collection_method: 'send_invoice',
          days_until_due: 0,
        });

        const periodStart = new Date();
        const subscription: NewUserSubscription = {
          userId: user.id,
          status: SubscriptionStatus.ACTIVE,
          tier: SubscriptionTier.FREE_MONTHLY,
          stripeCustomerId: stripeCustomer.id,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: freePriceId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: calculatePeriodEnd(periodStart),
          cancelAtPeriodEnd: 'false',
        };

        await db.insert(userSubscriptions).values(subscription).onConflictDoNothing();
        console.log(`  ✅ ${user.email}: Free tier subscription synced from Stripe`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to create Stripe subscription for ${user.email}`);
        console.warn('     Error:', error instanceof Error ? error.message : error);
      }
    }

    await createFreeTierSubscription(johnUser);
    await createFreeTierSubscription(janeUser);
    console.log('');

    // Activity logs
    console.log('📊 Creating activity logs...');

    const activityTypes = [
      ActivityType.SIGN_IN,
      ActivityType.UPDATE_PROFILE,
      ActivityType.PROFILE_IMAGE_UPDATED,
      ActivityType.UPDATE_PREFERENCES,
      ActivityType.SUBSCRIPTION_CREATED,
    ];

    const buildActivityLogs = (userId: string, count: number): NewActivityLog[] =>
      Array.from({ length: count }, (_, i) => ({
        userId,
        action: activityTypes[i % activityTypes.length],
        timestamp: faker.date.recent({ days: 30 }),
        ipAddress: faker.internet.ipv4(),
        metadata: JSON.stringify({
          userAgent: faker.internet.userAgent(),
          location: faker.location.city(),
        }),
      }));

    await db
      .insert(activityLogs)
      .values([...buildActivityLogs(janeUser.id, 5), ...buildActivityLogs(johnUser.id, 5)]);

    console.log('  ✅ Created 5 activity logs for Jane');
    console.log('  ✅ Created 5 activity logs for John\n');

    console.log('✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log('  • 2 users created');
    console.log('  • 2 free tier subscriptions created');
    console.log('  • 10 activity logs created\n');
    console.log('🔑 Test Users:');
    console.log(`  • ${janeSmithEmail} (regular user)`);
    console.log(`  • ${johnDoeEmail} (admin)\n`);
    console.log(
      "    To log in with the test users, use Kosuke's verification code: \x1b[1m424242\x1b[0m"
    );
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
