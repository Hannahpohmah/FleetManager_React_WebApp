import express from 'express';
import Notification from '../models/Notification.js';
import NotificationService from '../Services/NotificationService.js';
import auth from '../../src/middleware/auth.js';

const router = express.Router();

// Get notifications for the logged-in fleet manager
router.get('/', auth, async (req, res) => {
  try {
    // Get the logged-in fleet manager's ID
    const managerId = req.user.id;

    // First, check for any new status changes
    const newNotificationsCount = await NotificationService.checkAssignmentStatusChanges(managerId);

    // Fetch recent notifications (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const notifications = await Notification.find({
      recipient: managerId,
      createdAt: { $gte: thirtyDaysAgo }
    })
    .sort({ createdAt: -1 }) // Most recent first
    .limit(50) // Limit to 50 most recent notifications
    .populate('driverId') // Populate driver details if needed
    .populate('assignmentId'); // Populate assignment details if needed

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      recipient: managerId,
      isRead: false
    });

    res.json({
      notifications,
      unreadCount,
      newNotificationsCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark all notifications as read
router.post('/mark-read', auth, async (req, res) => {
  try {
    const managerId = req.user.id;

    // Mark all unread notifications as read
    await Notification.updateMany(
      { 
        recipient: managerId, 
        isRead: false 
      },
      { 
        isRead: true 
      }
    );

    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Error marking notifications' });
  }
});

export default router;