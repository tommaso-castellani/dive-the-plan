import { NextRequest, NextResponse } from 'next/server';

import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

import { getStripe } from '@/lib/billing/client';
import { SubscriptionTier, SubscriptionTierType } from '@/lib/billing/products';
import { db } from '@/lib/db';
import { SubscriptionStatus, userSubscriptions, users } from '@/lib/db/schema';
import { getConfigOrEnv } from '@/lib/services/config-service';
import { CONFIG_KEYS } from '@/lib/services/constants';

/**
 * Stripe Webhook Handler
 * Processes subscription lifecycle events from Stripe
 *
 * Endpoint: /api/billing/webhook
 * Events handled:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 * - subscription_schedule.completed (for downgrades)
 * - subscription_schedule.canceled (when user cancels pending downgrade)
 */

// Cache webhook secret to avoid database query on every webhook call
let cachedWebhookSecret: string | null = null;
let webhookSecretCacheExpiry: number = 0;
const WEBHOOK_SECRET_CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Get webhook secret with caching
 * Caches the secret for 1 hour to avoid repeated database queries
 */
async function getWebhookSecret(): Promise<string | null> {
  const now = Date.now();
  if (cachedWebhookSecret && now < webhookSecretCacheExpiry) {
    return cachedWebhookSecret;
  }

  const secret = await getConfigOrEnv(CONFIG_KEYS.STRIPE_WEBHOOK_SECRET);
  if (secret) {
    cachedWebhookSecret = secret;
    webhookSecretCacheExpiry = now + WEBHOOK_SECRET_CACHE_TTL;
  }

  return secret;
}

/**
 * Invalidate webhook secret cache
 * Call this when the webhook secret is updated via admin panel
 */
export function invalidateWebhookSecretCache(): void {
  cachedWebhookSecret = null;
  webhookSecretCacheExpiry = 0;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('❌ Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Get webhook secret with caching (avoids database query on every webhook call)
    const webhookSecret = await getWebhookSecret();

    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Initialize Stripe client and verify webhook signature
    const stripe = await getStripe();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('✅ Stripe webhook event:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'subscription_schedule.completed':
        await handleSubscriptionScheduleCompleted(event.data.object);
        break;
      case 'subscription_schedule.canceled':
        await handleSubscriptionScheduleCanceled(event.data.object);
        break;
      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('💥 Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

/**
 * Helper: Get userId from subscription metadata with validation
 */
function getUserId(subscription: Stripe.Subscription): string | null {
  const userId = subscription.metadata?.userId as string;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.error('❌ Invalid or missing userId in metadata:', subscription.metadata);
    return null;
  }
  return userId;
}

/**
 * Helper: Get tier from subscription metadata with validation
 */
function getTier(subscription: Stripe.Subscription): string | null {
  const tier = subscription.metadata?.tier as SubscriptionTierType;
  if (!tier || typeof tier !== 'string') {
    console.error('❌ Invalid or missing tier in metadata:', subscription.metadata);
    return null;
  }

  // Validate against known subscription tiers
  const validTiers = Object.values(SubscriptionTier);
  if (!validTiers.includes(tier)) {
    console.error('❌ Invalid tier value in metadata:', tier, 'Valid tiers:', validTiers);
    return null;
  }

  return tier;
}

/**
 * Helper: Verify user exists in the database
 */
async function userExists(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!user;
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const userId = getUserId(subscription);
    const tier = getTier(subscription);

    if (!userId || !tier) {
      console.error('❌ Missing or invalid metadata in subscription.created:', subscription.id);
      return;
    }

    const stripe = await getStripe();

    // Verify user exists to prevent orphaned subscription records
    if (!(await userExists(userId))) {
      console.error(
        '❌ Cannot create subscription for non-existent user:',
        userId,
        'subscription:',
        subscription.id
      );
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      console.error('❌ No subscription items found:', subscription.id);
      return;
    }

    // Get period dates from subscription item (most reliable source)
    const currentPeriodStart = subscriptionItem.current_period_start;
    const currentPeriodEnd = subscriptionItem.current_period_end;

    if (!currentPeriodStart || !currentPeriodEnd) {
      console.error('❌ Missing period dates in subscription item:', subscription.id);
      return;
    }

    // Check if a subscription record already exists for this user (one-per-user constraint)
    const existingSubscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
    });

    // Idempotency: if this exact subscription already exists, skip
    if (existingSubscription?.stripeSubscriptionId === subscription.id) {
      console.log(
        `ℹ️  Subscription ${subscription.id} already exists in database, skipping creation`
      );
      return;
    }

    // If an existing subscription exists for this user, cancel it in Stripe (if active)
    // and replace the local record. This handles all upgrade scenarios including Free → Paid.
    if (existingSubscription) {
      if (
        existingSubscription.status === SubscriptionStatus.ACTIVE &&
        existingSubscription.stripeSubscriptionId &&
        existingSubscription.stripeSubscriptionId !== subscription.id
      ) {
        try {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
          console.log(
            `✅ Canceled Stripe subscription ${existingSubscription.stripeSubscriptionId} for user upgrade`
          );
        } catch (error) {
          console.error(
            `⚠️ Failed to cancel Stripe subscription ${existingSubscription.stripeSubscriptionId}:`,
            error
          );
          // Continue anyway to update local database
        }
      }

      // Update existing record (unique constraint on userId means we cannot insert another)
      await db
        .update(userSubscriptions)
        .set({
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: priceId,
          status: subscription.status,
          tier,
          currentPeriodStart: new Date(currentPeriodStart * 1000),
          currentPeriodEnd: new Date(currentPeriodEnd * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end ? 'true' : 'false',
          canceledAt: null,
          scheduledDowngradeTier: null,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, existingSubscription.id));

      console.log('✅ Subscription replaced in database for user:', userId, subscription.id);
      return;
    }

    // No existing subscription - insert new record
    await db.insert(userSubscriptions).values({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      status: subscription.status,
      tier,
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ? 'true' : 'false',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Subscription created in database:', subscription.id);
  } catch (error) {
    console.error('💥 Error handling subscription.created:', error);
    throw error;
  }
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const priceId = subscription.items.data[0]?.price.id;
    const subscriptionItem = subscription.items.data[0];

    if (!subscriptionItem) {
      console.error('❌ No subscription items found:', subscription.id);
      return;
    }

    const currentPeriodStart = subscriptionItem.current_period_start;
    const currentPeriodEnd = subscriptionItem.current_period_end;

    if (!currentPeriodStart || !currentPeriodEnd) {
      console.error('❌ Missing period dates in subscription item:', subscription.id);
      return;
    }

    await db
      .update(userSubscriptions)
      .set({
        status: subscription.status,
        stripePriceId: priceId,
        currentPeriodStart: new Date(currentPeriodStart * 1000),
        currentPeriodEnd: new Date(currentPeriodEnd * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ? 'true' : 'false',
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

    console.log('✅ Subscription updated in database:', subscription.id);
  } catch (error) {
    console.error('💥 Error handling subscription.updated:', error);
    throw error;
  }
}

/**
 * Handle subscription.deleted event
 * This event fires when a subscription is permanently deleted (e.g., customer deleted)
 * Unlike cancel_at_period_end, this is an immediate termination
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // When a subscription is deleted, it's immediately terminated
    // Set cancelAtPeriodEnd to 'true' and currentPeriodEnd to now to reflect immediate cancellation
    const now = new Date();

    await db
      .update(userSubscriptions)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: 'true',
        canceledAt: now,
        currentPeriodEnd: now, // Set to now to indicate immediate termination
        updatedAt: now,
      })
      .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));

    console.log('✅ Subscription marked as deleted in database:', subscription.id);
  } catch (error) {
    console.error('💥 Error handling subscription.deleted:', error);
    throw error;
  }
}

/**
 * Handle invoice.paid event (successful renewal)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    // @ts-expect-error - subscription exists in webhook events but not in Invoice type
    const sub = invoice.subscription;
    if (!sub) return;

    const subscriptionId = typeof sub === 'string' ? sub : sub.id;

    // Update subscription with period info from invoice + ensure active status
    await db
      .update(userSubscriptions)
      .set({
        status: 'active',
        currentPeriodStart: new Date(invoice.period_start * 1000),
        currentPeriodEnd: new Date(invoice.period_end * 1000),
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId));

    console.log('✅ Invoice paid, subscription confirmed active:', subscriptionId);
  } catch (error) {
    console.error('💥 Error handling invoice.paid:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    // Stripe webhook events include subscription property but TypeScript definitions don't
    // @ts-expect-error - subscription exists in webhook events but not in Invoice type
    const sub = invoice.subscription;
    if (!sub) return;

    const subscriptionId = typeof sub === 'string' ? sub : sub.id;

    // Mark subscription as past_due
    await db
      .update(userSubscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId));

    console.log('⚠️ Payment failed for subscription:', subscriptionId);
  } catch (error) {
    console.error('💥 Error handling invoice.payment_failed:', error);
    throw error;
  }
}

/**
 * Handle subscription_schedule.completed event
 * This fires when a scheduled downgrade is activated (e.g., Business → Pro)
 */
async function handleSubscriptionScheduleCompleted(schedule: Stripe.SubscriptionSchedule) {
  try {
    const userId = schedule.metadata?.userId;
    const targetTier = schedule.metadata?.targetTier;

    if (!userId || !targetTier) {
      console.error('❌ Missing metadata in subscription_schedule.completed:', schedule.id);
      return;
    }

    // Verify user exists
    if (!(await userExists(userId))) {
      console.error(
        '❌ Cannot complete schedule for non-existent user:',
        userId,
        'schedule:',
        schedule.id
      );
      return;
    }

    console.log(
      `✅ Subscription schedule completed for user ${userId}, downgrading to ${targetTier}`
    );

    // The schedule automatically creates a new subscription when it completes
    // The subscription.created event will handle creating the new subscription record
    // We just need to clear the scheduledDowngradeTier field from the existing subscription
    const currentSub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
    });

    if (currentSub) {
      await db
        .update(userSubscriptions)
        .set({
          scheduledDowngradeTier: null,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.id, currentSub.id));
    }

    console.log('✅ Scheduled downgrade completed successfully');
  } catch (error) {
    console.error('💥 Error handling subscription_schedule.completed:', error);
    throw error;
  }
}

/**
 * Handle subscription_schedule.canceled event
 * This fires when a pending downgrade is canceled by the user
 */
async function handleSubscriptionScheduleCanceled(schedule: Stripe.SubscriptionSchedule) {
  try {
    const userId = schedule.metadata?.userId;
    const currentSubscriptionId = schedule.metadata?.currentSubscriptionId;

    if (!userId || !currentSubscriptionId) {
      console.error('❌ Missing metadata in subscription_schedule.canceled:', schedule.id);
      return;
    }

    console.log(`✅ Subscription schedule canceled for user ${userId}`);

    // Remove the scheduled downgrade and reactivate the current subscription
    await db
      .update(userSubscriptions)
      .set({
        scheduledDowngradeTier: null,
        cancelAtPeriodEnd: 'false',
        canceledAt: null,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.stripeSubscriptionId, currentSubscriptionId));

    console.log('✅ Pending downgrade removed, current subscription reactivated');
  } catch (error) {
    console.error('💥 Error handling subscription_schedule.canceled:', error);
    throw error;
  }
}
