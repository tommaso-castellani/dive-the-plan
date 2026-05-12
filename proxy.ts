import { NextRequest, NextResponse } from 'next/server';

import { SIGN_IN_ATTEMPT_EMAIL_COOKIE, getSessionFromCookie } from '@/lib/auth/utils';

/**
 * Create a route matcher function
 * Supports exact matches and wildcard patterns with (.*)
 *
 * @example
 * const isPublic = createRouteMatcher(['/home', '/sign-in(.*)']);
 * isPublic('/sign-in/verify') // true
 */
function createRouteMatcher(routes: string[]) {
  return (request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

    return routes.some((route) => {
      if (route === pathname) return true;

      if (route.includes('(.*)')) {
        const baseRoute = route.replace('(.*)', '');
        return pathname === baseRoute || pathname.startsWith(baseRoute + '/');
      }

      return false;
    });
  };
}

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/home',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/terms',
  // SEO and metadata routes
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/opengraph-image.png',
]);

const isRootRoute = createRouteMatcher(['/']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);
const isSignInVerifyRoute = createRouteMatcher([
  '/sign-in/verify',
  '/sign-up/verify-email-address',
]);
const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export async function proxy(req: NextRequest) {
  // API routes handle their own authentication via protectedProcedures
  if (isApiRoute(req)) return NextResponse.next();

  const sessionData = getSessionFromCookie(req);
  const isAuthenticated = !!sessionData?.session;

  // Protect /sign-in/verify - requires active sign-in attempt cookie
  if (isSignInVerifyRoute(req)) {
    const attemptEmail = req.cookies.get(SIGN_IN_ATTEMPT_EMAIL_COOKIE)?.value;
    if (attemptEmail) return NextResponse.next();
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Admin route authorization - must be admin role
  if (isAuthenticated && isAdminRoute(req)) {
    if (sessionData.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  }

  // Redirect authenticated users away from public root/auth pages to the dashboard
  if (isAuthenticated && (isRootRoute(req) || isAuthRoute(req))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Redirect unauthenticated users trying to access protected routes
  if (!isAuthenticated && !isPublicRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Allow all other requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
