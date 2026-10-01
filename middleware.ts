import { NextRequest, NextResponse } from 'next/server';

// Simple password gate for reviewers. Works on every Vercel plan.
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    const [, pass] = atob(header.slice(6)).split(':');
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Case study prototype"' },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|case|video).*)'] };
