
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('mindful-tasks-auth');
  const { pathname } = request.nextUrl;

  // If user is authenticated
  if (authCookie) {
    // If they try to access login or signup, redirect them to the home page
    if (pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Otherwise, allow the request
    return NextResponse.next();
  }

  // If user is not authenticated and trying to access a protected route
  if (!authCookie && pathname !== '/login' && pathname !== '/signup') {
    // Redirect them to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow access to login/signup for unauthenticated users
  return NextResponse.next();
}

export const config = {
  // Match all routes except for static assets and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
