import express from 'express';
import mongoose from 'mongoose';
import Assignment from '../models/Assignments.js';
import Driver from '../models/Driver.js';
import auth from '../../src/middleware/auth.js';

const router = express.Router();

// Get all assignments
router.get('/', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate('driverId', 'name email status')
      .sort({ date: -1 });
    res.json(assignments);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get assignments for a specific date
router.get('/date/:date', auth, async (req, res) => {
  try {
    const date = new Date(req.params.date);
    // Ensure valid date
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    
    // Set time to beginning of day
    date.setHours(0, 0, 0, 0);
    
    // Find assignments for this date
    const assignments = await Assignment.find({ 
      date: {
        $gte: date,
        $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('driverId', 'name email status');
    
    res.json(assignments);
  } catch (err) {
    console.error('Error fetching assignments by date:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get assignments for a specific driver
router.get('/driver/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid driver ID' });
    }
    
    const assignments = await Assignment.find({ driverId: req.params.id })
      .sort({ date: -1 });
    
    res.json(assignments);
  } catch (err) {
    console.error('Error fetching driver assignments:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create new assignments (batch operation)
router.post('/', auth, async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'No valid assignments provided' });
    }
    
    // Validate assignment data
    for (const assignment of assignments) {
      if (!assignment.routeId) {
        return res.status(400).json({ message: 'Route ID is required for all assignments' });
      }
      if (!assignment.driverId || !mongoose.Types.ObjectId.isValid(assignment.driverId)) {
        return res.status(400).json({ message: 'Valid driver ID is required for all assignments' });
      }
      if (!assignment.date) {
        return res.status(400).json({ message: 'Date is required for all assignments' });
      }
      
      // Verify driver exists and is active
      const driver = await Driver.findById(assignment.driverId);
      if (!driver) {
        return res.status(404).json({ message: `Driver with ID ${assignment.driverId} not found` });
      }
      if (driver.status !== 'active') {
        return res.status(400).json({ 
          message: `Driver ${driver.name} is not active (current status: ${driver.status})` 
        });
      }
    }
    
    // Check for duplicate route assignments for the same date
    const routeIds = assignments.map(a => a.routeId);
    const dates = assignments.map(a => new Date(a.date));
    
    // Set all dates to start of day for consistent comparison
    const normalizedDates = dates.map(date => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    });
    
    // Find the earliest and latest dates in the batch
    const minDate = new Date(Math.min(...normalizedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...normalizedDates.map(d => d.getTime())) + 24 * 60 * 60 * 1000);
    
    // Check for existing assignments in the date range
    const existingAssignments = await Assignment.find({
      routeId: { $in: routeIds },
      date: { $gte: minDate, $lt: maxDate }
    });
    
    // Create mapping of route+date to detect conflicts
    const routeDateMap = new Map();
    existingAssignments.forEach(assignment => {
      const assignDate = new Date(assignment.date);
      assignDate.setHours(0, 0, 0, 0);
      const key = `${assignment.routeId}-${assignDate.toISOString().split('T')[0]}`;
      routeDateMap.set(key, assignment);
    });
    
    // Filter out assignments that would create conflicts
    const newAssignments = [];
    const conflictAssignments = [];
    
    for (const assignment of assignments) {
      const assignDate = new Date(assignment.date);
      assignDate.setHours(0, 0, 0, 0);
      const key = `${assignment.routeId}-${assignDate.toISOString().split('T')[0]}`;
      
      if (routeDateMap.has(key)) {
        conflictAssignments.push({
          routeId: assignment.routeId,
          date: assignDate.toISOString().split('T')[0],
          existingDriver: (await Driver.findById(routeDateMap.get(key).driverId)).name
        });
      } else {
        newAssignments.push({
          routeId: assignment.routeId,
          driverId: assignment.driverId,
          date: assignDate,
          status: 'assigned',
          assignedBy: req.user.id,
          assignedAt: new Date(),
          notes: assignment.notes || '' // Save driver instructions from request
        });
        // Mark this as taken to catch duplicates within the batch
        routeDateMap.set(key, { driverId: assignment.driverId });
      }
    }
    
    if (conflictAssignments.length > 0) {
      return res.status(409).json({
        message: 'Some routes already have assignments for the specified dates',
        conflicts: conflictAssignments
      });
    }
    
    // Create the new assignments
    const result = await Assignment.insertMany(newAssignments);
    
    // Update driver statuses to on_delivery
    const driverIds = [...new Set(newAssignments.map(a => a.driverId))];
    await Driver.updateMany(
      { _id: { $in: driverIds } },
      { status: 'on_delivery' }
    );
    
    res.status(201).json({
      message: 'Assignments created successfully',
      count: result.length,
      assignments: result
    });
  } catch (err) {
    console.error('Error creating assignments:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update assignment status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }
    
    if (!req.body.status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    // Valid statuses
    const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Update the assignment
    assignment.status = req.body.status;
    assignment.lastUpdatedBy = req.user.id;
    assignment.lastUpdatedAt = new Date();
    
    // Update notes if provided
    if (req.body.notes !== undefined) {
      assignment.notes = req.body.notes;
    }
    
    // If completing or cancelling, update driver status
    if (req.body.status === 'completed' || req.body.status === 'cancelled') {
      // Check if driver has other active assignments
      const activeAssignments = await Assignment.countDocuments({
        _id: { $ne: req.params.id },
        driverId: assignment.driverId,
        status: { $in: ['assigned', 'in_progress'] }
      });
      
      // If no other active assignments, update driver status back to active
      if (activeAssignments === 0) {
        await Driver.findByIdAndUpdate(
          assignment.driverId,
          { status: 'active' }
        );
      }
    }
    
    await assignment.save();
    
    res.json(assignment);
  } catch (err) {
    console.error('Error updating assignment status:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update assignment notes only
router.patch('/:id/notes', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }
    
    if (req.body.notes === undefined) {
      return res.status(400).json({ message: 'Notes are required' });
    }
    
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Update the notes
    assignment.notes = req.body.notes;
    assignment.lastUpdatedBy = req.user.id;
    assignment.lastUpdatedAt = new Date();
    
    await assignment.save();
    
    res.json(assignment);
  } catch (err) {
    console.error('Error updating assignment notes:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete an assignment
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }
    
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Store driver ID before deletion
    const driverId = assignment.driverId;
    
    await Assignment.findByIdAndDelete(req.params.id);
    
    // Check if driver has other active assignments
    const activeAssignments = await Assignment.countDocuments({
      driverId: driverId,
      status: { $in: ['assigned', 'in_progress'] }
    });
    
    // If no other active assignments, update driver status back to active
    if (activeAssignments === 0) {
      await Driver.findByIdAndUpdate(
        driverId,
        { status: 'active' }
      );
    }
    
    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('Error deleting assignment:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;