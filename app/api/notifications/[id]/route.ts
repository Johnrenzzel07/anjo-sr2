import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';
import { getAuthUser } from '@/lib/auth';

// Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { isRead } = body;

    const notification = await Notification.findOne({
      _id: id,
      userId: authUser.id, // Ensure user can only update their own notifications
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    notification.isRead = isRead !== undefined ? isRead : true;
    if (notification.isRead && !notification.readAt) {
      notification.readAt = new Date().toISOString();
    } else if (!notification.isRead) {
      notification.readAt = undefined;
    }

    await notification.save();

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await Notification.updateMany(
      { userId: authUser.id, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}

