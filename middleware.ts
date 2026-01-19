import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Whitelist of allowed IP addresses
// Can be overridden by ALLOWED_IPS environment variable (comma-separated)
const DEFAULT_ALLOWED_IPS = [
  '143.44.162.23',
  '122.53.24.194',
  '180.190.243.109',
  '27.49.218.2',
  '112.198.193.120',
  '58.69.229.122',
  '27.49.70.2',
  '222.127.50.75',
  '27.49.69.5',
  '127.0.0.1',      // Localhost IPv4
  '::1',            // Localhost IPv6
  'localhost',      // Localhost hostname
];

// Get allowed IPs from environment variable or use default
const getWhitelistedIPs = (): string[] => {
  const envIPs = process.env.ALLOWED_IPS;
  if (envIPs) {
    const ips = envIPs.split(',').map(ip => ip.trim()).filter(Boolean);
    return [...ips, '127.0.0.1', '::1', 'localhost']; // Always include localhost
  }
  return DEFAULT_ALLOWED_IPS;
};

const ALLOWED_IPS = getWhitelistedIPs();

export function middleware(request: NextRequest) {
  // Get client IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';

  // Allow localhost during development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isLocalhost = request.headers.get('host')?.includes('localhost') || 
                      request.headers.get('host')?.includes('127.0.0.1');

  if (isDevelopment && isLocalhost) {
    return NextResponse.next();
  }

  // Check if IP is in whitelist
  if (!ALLOWED_IPS.includes(ip)) {
    console.log(`Access denied for IP: ${ip}`);
    
    // Return 403 Forbidden with a custom page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Denied</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
            }
            h1 {
              color: #dc2626;
              margin-bottom: 1rem;
              font-size: 2rem;
            }
            p {
              color: #6b7280;
              line-height: 1.6;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            .ip {
              background: #f3f4f6;
              padding: 0.5rem 1rem;
              border-radius: 5px;
              margin-top: 1rem;
              font-family: monospace;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">🚫</div>
            <h1>Access Denied</h1>
            <p>Your IP address is not authorized to access this website.</p>
            <p>If you believe this is an error, please contact the administrator.</p>
            <div class="ip">Your IP: ${ip}</div>
          </div>
        </body>
      </html>
      `,
      {
        status: 403,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }

  console.log(`Access granted for IP: ${ip}`);
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
