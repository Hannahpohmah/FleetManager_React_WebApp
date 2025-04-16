// routes/drivers.js
import express from 'express';
import Driver from '../models/Driver.js';
import Location from '../models/TrackerData.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Specific route for getting driver counts
// In drivers.js routes file
router.get('/locations', async (req, res) => {
  try {
    // Find most recent locations for each driver
    const locations = await Location.find()
      .sort({ timestamp: -1 })
      .populate('driver', 'name status') // Populate driver details
      .limit(50); // Limit to recent entries
      
    // Group by driver and take most recent for each
    const driverMap = new Map();
    
    locations.forEach(location => {
      const driverId = location.driver._id.toString();
      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driverId: driverId,
          driverName: location.driver.name,
          status: location.driver.status,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: location.timestamp
        });
      }
    });
    
    const driverLocations = Array.from(driverMap.values());
    
    res.json(driverLocations);
  } catch (err) {
    console.error('Error fetching driver locations:', err);
    res.status(500).json({ message: err.message });
  }
});
// Middleware to validate routes that expect an ObjectId
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  // If route includes an ID parameter, validate it
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      message: 'Invalid ObjectId provided', 
      receivedValue: id 
    });
  }
  
  next();
};

// Stats route with explicit error handling
router.get('/stats', async (req, res) => {
  try {
    // Detailed logging for debugging
    //console.log('Stats request received at:', new Date().toISOString());

    const [
      totalDrivers,
      activeDrivers,
      inactiveDrivers,
      onDeliveryDrivers,
      onLeaveDrivers
    ] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ status: 'active' }),
      Driver.countDocuments({ status: 'inactive' }),
      Driver.countDocuments({ status: 'on_delivery' }),
      Driver.countDocuments({ status: 'on_leave' })
    ]);

    // More robust response structure
    const statsResponse = {
      totalDrivers,
      activeDrivers,
      inactiveDrivers,
      onDeliveryDrivers,
      onLeaveDrivers,
      timestamp: new Date().toISOString()
    };

    res.json(statsResponse);
  } catch (err) {
    console.error('Detailed stats error:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({ 
      message: 'Failed to fetch driver stats', 
      error: err.toString(),
      timestamp: new Date().toISOString()
    });
  }
});



// Apply ObjectId validation to routes that need it
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new driver
router.post('/', async (req, res) => {
  try {
    // Check if email already exists
    const existingDriver = await Driver.findOne({ email: req.body.email });
    if (existingDriver) {
      return res.status(400).json({ message: 'A driver with this email already exists' });
    }
    
    const driver = new Driver(req.body);
    const newDriver = await driver.save();
    res.status(201).json(newDriver);
  } catch (err) {
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: err.message });
  }
});

// Update a driver
router.put('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json(driver);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: err.message });
  }
});

// Delete a driver
router.delete('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json({ message: 'Driver deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update driver status
router.patch('/:id/status', async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


export default router;