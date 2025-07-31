
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('mindmate-auth');
  const { pathname } = request.nextUrl;

const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup';
    
  const isPublicPage = 
    isAuthPage ||
    pathname.startsWith('/share');
  // If user is authenticated
  if (authCookie) {
    // If they try to access an auth page (login/signup), redirect them to the home page
    if (isAuthPage) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Otherwise, allow the request to proceed
    return NextResponse.next();
  }

  // If user is not authenticated and is trying to access a protected route
  if (!isPublicPage) {
    // Redirect them to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow unauthenticated access to login, signup, and share pages
  return NextResponse.next();
}

export const config = {
  // Match all routes except for static assets and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
