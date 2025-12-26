import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check environment variables
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set');
      return NextResponse.json(
        { error: 'Server configuration error: MONGODB_URI not set. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Connect to database
    await connectDB();
    
    // Parse request body
    const body = await request.json();
    const { email, password, name, department } = body;

    // Validation
    if (!email || !password || !name || !department) {
      return NextResponse.json(
        { error: 'Email, password, name, and department are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userData = {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'REQUESTER' as const,
      department,
      isActive: true,
    };

    const user = new User(userData);
    await user.save();

    // Create auth user object
    const userId = user._id ? String(user._id) : '';
    const authUser = {
      id: userId,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };

    // Create response
    const response = NextResponse.json({
      user: authUser,
      message: 'Signup successful',
    }, { status: 201 });

    // Set auth cookie
    return setAuthCookie(response, authUser);
  } catch (error: any) {
    // Log detailed error information
    console.error('=== SIGNUP ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    console.error('MONGODB_URI set:', !!process.env.MONGODB_URI);
    console.error('JWT_SECRET set:', !!process.env.JWT_SECRET);
    console.error('===================');
    
    return NextResponse.json(
      { 
        error: error.message || 'Signup failed',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        } : undefined
      },
      { status: 500 }
    );
  }
}

