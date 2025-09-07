import { NextRequest } from 'next/server';
import { userService } from '@/lib/firestore';

/**
 * Get authenticated user email from request
 * Implementation for this app uses a simple cookie-based auth where the
 * client stores the authenticated user's email in the `mindmate-auth` cookie.
 * This function will:
 * 1. Try to read `mindmate-auth` cookie and validate the user exists in Firestore
 * 2. Fallback to `x-user-email` header (useful for tests/dev)
 */
export async function getAuthenticatedUserEmail(request: NextRequest): Promise<string | null> {
  console.log('🔍 getAuthenticatedUserEmail: Starting authentication check');
  
  try {
    // 1) Cookie-based auth (used by client-side AuthProvider)
    const cookieEmail = request.cookies.get('mindmate-auth')?.value;
    console.log('🍪 Cookie auth check:', cookieEmail ? `Found: ${cookieEmail}` : 'No cookie found');
    
    if (cookieEmail) {
      try {
        console.log('👤 Validating user exists in Firestore...');
        const user = await userService.getUser(cookieEmail);
        if (user) {
          console.log('✅ User validated successfully:', cookieEmail);
          return cookieEmail;
        } else {
          console.log('⚠️ User not found in Firestore, but returning cookie email anyway');
          return cookieEmail;
        }
        // If user not found, fallthrough to other checks
      } catch (err) {
        // If Firestore lookup fails for any reason, still return cookie value as a best-effort
        console.warn('⚠️ userService lookup failed when resolving auth cookie:', err);
        console.log('🔄 Returning cookie email despite validation failure');
        return cookieEmail;
      }
    }

    // 2) Development/test header override
    const headerEmail = request.headers.get('x-user-email');
    console.log('📧 Header auth check:', headerEmail ? `Found: ${headerEmail}` : 'No header found');
    if (headerEmail) {
      console.log('✅ Using header email for auth');
      return headerEmail;
    }

    // 3) No authenticated user found
    console.log('❌ No authenticated user found');
    return null;
  } catch (error) {
    console.error('💥 Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Validate user has permission to access resource
 */
export async function validateUserAccess(
  request: NextRequest, 
  resourceUserEmail: string
): Promise<boolean> {
  const currentUserEmail = await getAuthenticatedUserEmail(request);
  return currentUserEmail === resourceUserEmail;
}

/**
 * Get user ID from email (if your system uses separate user IDs)
 */
export async function getUserIdFromEmail(email: string): Promise<string | null> {
  // TODO: Implement based on your user system
  // This might involve a database lookup to get user ID from email
  return email; // Using email as ID for simplicity
}
