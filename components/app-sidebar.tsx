'use client';

import * as React from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { FlaskConical, Gauge, Shield } from 'lucide-react';

import { useClient } from '@/hooks/use-client';
import { useUser } from '@/hooks/use-user';

import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

const NAV_ITEMS = [
  {
    title: 'Gas Planner',
    url: '/gas-planner',
    icon: Gauge,
  },
  {
    title: 'Gas Mixer',
    url: '/gas-mixer',
    icon: FlaskConical,
  },
];

function SidebarBrand() {
  const { isClient } = useClient();

  // Default to dark logo during SSR to avoid hydration mismatch
  const logoSrc = isClient ? '/logos/logo.svg' : '/logos/logo-dark.svg';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src={logoSrc} alt="Kosuke" width={120} height={24} priority />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isLoading } = useUser();
  const isAdmin = user?.role === 'admin';

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        {isLoading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <NavMain items={NAV_ITEMS} />

            {isAdmin && (
              <NavSecondary
                items={[
                  {
                    title: 'Admin',
                    url: '/admin',
                    icon: Shield,
                  },
                ]}
                className="mt-auto"
              />
            )}
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
