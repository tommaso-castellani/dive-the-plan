/**
 * Hook for managing user's organizations
 * Fetches and manages the list of organizations the user belongs to
 * Uses Better Auth's organization plugin
 *
 * Resolves the active organization in this priority order:
 * 1. URL slug (when on an `/org/[slug]/...` page) — source of truth for org-scoped routes
 * 2. Session `activeOrganizationId` — fallback for non-scoped pages (e.g. /settings/billing)
 *
 * This guards against stale/missing `activeOrganizationId` in the session leaving the
 * sidebar (and other org-aware UI) stuck on a loading skeleton.
 */

'use client';

import { useParams } from 'next/navigation';

import { trpc } from '@/lib/trpc/client';

import { useAuth } from '@/hooks/use-auth';

export function useOrganization() {
  const { isSignedIn, activeOrganizationId, user: currentUser, activeOrganizationRole } = useAuth();

  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : undefined;

  const byIdEnabled = isSignedIn && !slug && !!activeOrganizationId;
  const bySlugEnabled = isSignedIn && !!slug;

  const byIdQuery = trpc.organizations.getOrganization.useQuery(
    { organizationId: activeOrganizationId! },
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      enabled: byIdEnabled,
    }
  );

  const bySlugQuery = trpc.organizations.getOrganizationBySlug.useQuery(
    { organizationSlug: slug! },
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      enabled: bySlugEnabled,
    }
  );

  const activeQuery = slug ? bySlugQuery : byIdQuery;
  const organization = activeQuery.data;
  const isLoading = activeQuery.isLoading;
  const error = activeQuery.error;
  const refetch = activeQuery.refetch;

  const pendingInvitations =
    organization?.invitations.filter((invitation) => invitation.status === 'pending') ?? [];

  const members = organization?.members ?? [];
  const currentUserMembership = members.find((m) => m.userId === currentUser?.id);

  return {
    organization: organization ?? null,
    invitations: pendingInvitations,
    members,
    currentUserRole: activeOrganizationRole,
    currentUserMembership,
    isLoading,
    error,
    refetch,
  };
}
