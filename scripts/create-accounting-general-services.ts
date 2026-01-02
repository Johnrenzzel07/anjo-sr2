/**
 * Script to create Accounting Head and General Services Head accounts
 * Run with: npx ts-node scripts/create-accounting-general-services.ts
 * Or use: npm run create-accounts
 */

import mongoose from 'mongoose';
import User, { UserRole } from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

async function createAccounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const password = 'anjo123';
    const hashedPassword = await hashPassword(password);

    const accounts: Array<{
      name: string;
      email: string;
      department: string;
      role: UserRole;
      password: string;
    }> = [
      {
        name: 'Accounting Head',
        email: 'accounting.head@anjoworld.com',
        department: 'Accounting',
        role: 'APPROVER',
        password: hashedPassword,
      },
      {
        name: 'General Services Head',
        email: 'general.services@anjoworld.com',
        department: 'General Services',
        role: 'APPROVER',
        password: hashedPassword,
      },
    ];

    const results = [];

    for (const account of accounts) {
      const existingUser = await User.findOne({ email: account.email.toLowerCase() });

      if (existingUser) {
        // Update existing user
        existingUser.name = account.name;
        existingUser.role = account.role;
        existingUser.department = account.department;
        existingUser.isActive = true;
        existingUser.password = account.password;
        await existingUser.save();
        results.push({ email: account.email, action: 'updated' });
        console.log(`✓ Updated: ${account.email}`);
      } else {
        // Create new user
        const user = new User({
          email: account.email.toLowerCase(),
          password: account.password,
          name: account.name,
          role: account.role,
          department: account.department,
          isActive: true,
        });
        await user.save();
        results.push({ email: account.email, action: 'created' });
        console.log(`✓ Created: ${account.email}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log('Password for both accounts: anjo123');
    results.forEach(r => {
      console.log(`${r.email}: ${r.action}`);
    });

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAccounts();

