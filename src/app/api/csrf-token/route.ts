import { NextRequest, NextResponse } from 'next/server';
import { setCSRFCookie } from '@/lib/security/csrf';

/**
 * GET /api/csrf-token
 * Returns a new CSRF token and sets it in a secure HTTP-only cookie
 * Client should store this token and include it in subsequent requests
 */
export async function GET(request: NextRequest) {
  try {
    const token = await setCSRFCookie();
    
    return NextResponse.json({ 
      token,
      message: 'CSRF token generated successfully. Include this token in the x-csrf-token header for protected requests.'
    });
  } catch (error) {
    console.error('[CSRF Token API] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
