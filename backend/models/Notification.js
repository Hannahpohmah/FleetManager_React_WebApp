import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fleet_Manager', // Can be a fleet manager or admin
    required: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  type: {
    type: String,
    enum: ['status_change', 'new_assignment', 'urgent'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  routeId: {
    type: String,
    ref: 'RouteResult'
  },
  oldStatus: {
    type: String
  },
  newStatus: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ assignmentId: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;