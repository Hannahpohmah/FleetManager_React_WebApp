import Assignment from '../models/Assignments.js';
import Notification from '../models/Notification.js';
import RouteJob from '../models/routes_optimized.js'; // For accessing the route job data

class NotificationService {
  /**
   * Check assignment status changes for the logged-in fleet manager's assignments
   * @param {string} managerId - ID of the logged-in fleet manager
   */
  static async checkAssignmentStatusChanges(managerId) {
    try {
      // Validate managerId before proceeding
      if (!managerId) {
        console.error('Invalid managerId: Cannot check assignment status changes');
        return 0;
      }

      // Find assignments created or updated by this fleet manager
      const assignments = await Assignment.find({
        $or: [
          { assignedBy: managerId },
          { lastUpdatedBy: managerId }
        ]
      }).populate('driverId');

      // Track notifications to create
      const notificationsToCreate = [];

      // Process each assignment
      for (const assignment of assignments) {
        // Ensure all required fields exist before creating notification
        if (!assignment._id) {
          console.warn('Assignment missing _id, skipping notification creation');
          continue;
        }

        // Check if a notification for this status change already exists
        const existingNotification = await Notification.findOne({
          assignmentId: assignment._id,
          newStatus: assignment.status,
          recipient: managerId
        });

        // If no existing notification, prepare to create one
        if (!existingNotification) {
          // Ensure all required fields are present
          const notificationData = {
            recipient: managerId,
            assignmentId: assignment._id,
            type: 'status_change',
            driverId: assignment.driverId?._id || assignment.driverId, // Handle both populated and unpopulated cases
            newStatus: assignment.status,
            message: await this.generateNotificationMessage(assignment)
          };
          
          // Validate required fields before adding to creation array
          if (notificationData.recipient && notificationData.assignmentId && notificationData.type && notificationData.message) {
            notificationsToCreate.push(notificationData);
          } else {
            console.warn('Missing required fields for notification:', 
              JSON.stringify({
                hasRecipient: !!notificationData.recipient,
                hasAssignmentId: !!notificationData.assignmentId,
                hasType: !!notificationData.type,
                hasMessage: !!notificationData.message
              })
            );
          }
        }
      }

      // Bulk create notifications if any
      if (notificationsToCreate.length > 0) {
        await Notification.insertMany(notificationsToCreate);
      }

      return notificationsToCreate.length;
    } catch (error) {
      console.error('Error checking assignment status changes:', error);
      return 0;
    }
  }

  /**
   * Generate a human-readable notification message
   * @param {Object} assignment - Assignment document
   */
  static async generateNotificationMessage(assignment) {
    const driverName = assignment.driverId?.name || 'Unknown Driver';
    let destinationText = 'Unknown Destination';

    try {
      if (assignment.routeId) {
        // Parse the routeId to extract the job ID and route index
        // Format is expected to be like "jobId-index"
        const parts = assignment.routeId.split('-');
        const jobId = parts.length > 1 ? parts.slice(0, -1).join('-') : assignment.routeId;
        const routeIndex = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) : 0;
        
        // Find the route job by jobId
        const routeJob = await RouteJob.findOne({ jobId });
        
        if (routeJob && routeJob.results && routeJob.results.routes && 
            Array.isArray(routeJob.results.routes) && 
            routeJob.results.routes.length > routeIndex) {
          
          // Extract the destination from the route at the specified index
          const route = routeJob.results.routes[routeIndex];
          if (route && route.end) {
            destinationText = route.end;
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching destination for notification:', error);
    }

    switch(assignment.status) {
      case 'assigned':
        return `New assignment created for ${driverName} to ${destinationText}`;
      case 'in_progress':
        return `Assignment for ${driverName} to ${destinationText} is now in progress`;
      case 'completed':
        return `Assignment for ${driverName} to ${destinationText} has been completed`;
      case 'cancelled':
        return `Assignment for ${driverName} to ${destinationText} has been cancelled`;
      default:
        return `Assignment status updated for ${driverName} to ${destinationText}`;
    }
  }
}

export default NotificationService;