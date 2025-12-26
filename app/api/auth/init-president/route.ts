import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';

export async function POST() {
  try {
    await connectDB();
    const defaultPassword = 'anjo123';
    const hashedPassword = await hashPassword(defaultPassword);

    // Check if Chester Lim already exists
    const existingUser = await User.findOne({ email: 'clim@anjoworld.com' });
    
    if (existingUser) {
      // Update existing user
      existingUser.name = 'Chester Lim';
      existingUser.role = 'SUPER_ADMIN';
      existingUser.department = 'President';
      existingUser.isActive = true;
      existingUser.password = hashedPassword; // Reset password
      await existingUser.save();
      
      return NextResponse.json({
        message: 'Chester Lim account updated successfully',
        email: 'clim@anjoworld.com',
        password: defaultPassword,
        action: 'updated',
      });
    } else {
      // Create new user
      const user = new User({
        email: 'clim@anjoworld.com',
        password: hashedPassword,
        name: 'Chester Lim',
        role: 'SUPER_ADMIN',
        department: 'President',
        isActive: true,
      });
      await user.save();
      
      return NextResponse.json({
        message: 'Chester Lim account created successfully',
        email: 'clim@anjoworld.com',
        password: defaultPassword,
        action: 'created',
      });
    }
  } catch (error: any) {
    console.error('Init president error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize president account' },
      { status: 500 }
    );
  }
}

