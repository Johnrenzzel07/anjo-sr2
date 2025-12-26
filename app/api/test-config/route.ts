import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    mongodbUri: process.env.MONGODB_URI ? 'Set (hidden)' : 'NOT SET',
    jwtSecret: process.env.JWT_SECRET ? 'Set (hidden)' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  return NextResponse.json(config);
}

