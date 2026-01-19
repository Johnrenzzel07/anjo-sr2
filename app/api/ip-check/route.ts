import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get client IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isLocalhost = request.headers.get('host')?.includes('localhost') || 
                      request.headers.get('host')?.includes('127.0.0.1');

  return NextResponse.json({
    ip,
    environment: process.env.NODE_ENV,
    isDevelopment,
    isLocalhost,
    headers: {
      'x-forwarded-for': forwarded,
      'x-real-ip': realIp,
      host: request.headers.get('host'),
    },
    message: 'Your IP address and connection details',
  });
}
