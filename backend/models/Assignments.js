//models/Assignments.js
import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: true,
    ref: 'RouteResult',
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'assigned'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetManager'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetManager'
  },
  lastUpdatedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster lookups
assignmentSchema.index({ routeId: 1, date: 1 }, { unique: true });
assignmentSchema.index({ driverId: 1, date: 1 });
assignmentSchema.index({ status: 1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;