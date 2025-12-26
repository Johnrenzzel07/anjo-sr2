import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { comparePassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return NextResponse.json({
        exists: false,
        message: 'User not found',
        email: email.toLowerCase(),
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);

    return NextResponse.json({
      exists: true,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      passwordMatch: isPasswordValid,
      message: isPasswordValid ? 'Password is correct' : 'Password does not match',
    });
  } catch (error: any) {
    console.error('Check user error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check user' },
      { status: 500 }
    );
  }
}

