'use client';

import { trpc } from '@/lib/trpc/client';

import { useAuth } from './use-auth';

/**
 * Check if Stripe API key is configured
 */
export function useStripeConfigured() {
  return trpc.billing.isConfigured.useQuery(undefined, {
    refetchOnMount: 'always',
  });
}

/**
 * Get user's subscription status
 */
export function useSubscriptionStatus() {
  const { user } = useAuth();

  return trpc.billing.getStatus.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns from Stripe popup
  });
}

/**
 * Check if user can subscribe or perform subscription actions
 */
export function useCanSubscribe() {
  const { user } = useAuth();

  return trpc.billing.canSubscribe.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns from Stripe popup
  });
}

/**
 * Get pricing data
 */
export const usePricingData = () => {
  const { user } = useAuth();

  return trpc.billing.getPricing.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true, // Refetch when user returns from Stripe popup
  });
};
