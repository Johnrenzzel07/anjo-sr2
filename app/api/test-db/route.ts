import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET() {
  try {
    // Test MongoDB connection
    await connectDB();
    
    // Test query
    const userCount = await User.countDocuments();
    
    return NextResponse.json({
      success: true,
      message: 'MongoDB connection successful',
      userCount,
      mongodbUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      mongodbUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
    }, { status: 500 });
  }
}

