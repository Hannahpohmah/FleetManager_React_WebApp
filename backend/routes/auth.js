//routes.auth.js
import express from 'express';
import FleetManager from '../models/fleetManager.js';
import { check, validationResult } from 'express-validator';
import auth from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login manager and get token
 * @access  Public
 */
router.post('/login', [
  check('email', 'Valid email is required').isEmail(),
  check('pwd', 'Password is required').exists()
], async (req, res) => {
  // Log the entire incoming request body
  console.log('Incoming Login Request Body:', req.body);

  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation Errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, pwd } = req.body;

  try {
    // Log the email being searched
    console.log('Searching for email:', email);

    // Find manager by email in customData
    const manager = await FleetManager.findOne({ 'customData.email': email });
    
    // Log the result of the search
    console.log('Manager found:', manager ? 'Yes' : 'No');

    if (!manager) {
      console.log('No manager found with email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Log password comparison
    console.log('Comparing passwords');
    const isMatch = await manager.comparePassword(pwd);
    
    console.log('Password match:', isMatch);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = manager.generateAuthToken();

    res.json({
      token,
      manager: {
        id: manager._id,
        username: manager.user,
        email: manager.customData.email,
        company: manager.customData.company,
        roles: manager.roles.map(r => r.role)
      }
    });
  } catch (err) {
    console.error('Detailed Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get logged in manager's data
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const manager = await FleetManager.findById(req.user.id).select('-pwd');
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found' });
    }
    res.json({
      id: manager._id,
      username: manager.user,
      email: manager.customData.email,
      company: manager.customData.company,
      roles: manager.roles.map(r => r.role)
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', [
  // Validation middleware
  check('username', 'Username is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  check('company', 'Company is required').not().isEmpty()
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, company } = req.body;

  try {
    // Check if user already exists
    let existingManager = await FleetManager.findOne({ 
      $or: [
        { 'customData.email': email },
        { user: username }
      ]
    });

    if (existingManager) {
      return res.status(400).json({ 
        message: 'User already exists',
        field: existingManager.customData.email === email ? 'email' : 'username'
      });
    }

    // Create new fleet manager
    const newManager = new FleetManager({
      user: username,
      pwd: password, // The pre-save middleware will hash this
      customData: {
        company: company,
        email: email
      },
      roles: [
        {
          role: 'readWriteAnyDatabase',
          db: 'Driver_Db'
        }
      ]
    });

    // Save the new manager
    await newManager.save();

    // Generate authentication token
    const token = newManager.generateAuthToken();

    // Respond with token and user details
    res.status(201).json({
      token,
      manager: {
        id: newManager._id,
        username: newManager.user,
        email: newManager.customData.email,
        company: newManager.customData.company
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});
export { router };