import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { comparePassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error('Login failed: User not found', { email: email.toLowerCase() });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      console.error('Login failed: User is inactive', { email: user.email });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.error('Login failed: Password mismatch', { 
        email: user.email,
        providedPassword: password,
        storedHash: user.password.substring(0, 10) + '...' // Log first 10 chars only
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const authUser = {
      id: (user._id as any)?.toString() || '',
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };

    const response = NextResponse.json({
      user: authUser,
      message: 'Login successful',
    });

    return setAuthCookie(response, authUser);
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

