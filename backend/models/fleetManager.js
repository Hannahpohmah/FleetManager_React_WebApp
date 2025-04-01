import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const fleetManagerSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pwd: {
    type: String,
    required: true
  },
  customData: {
    company: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // Convert to lowercase when saving
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  roles: [{
    role: {
      type: String,
      required: true
    },
    db: {
      type: String,
      required: true
    }
  }]
});

// Hash password before saving
fleetManagerSchema.pre('save', async function(next) {
  if (!this.isModified('pwd')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.pwd = await bcrypt.hash(this.pwd, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
fleetManagerSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.pwd);
};

// Method to generate JWT token
fleetManagerSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    {
      id: this._id,
      username: this.user,
      email: this.customData.email,
      company: this.customData.company,
      roles: this.roles.map(r => r.role)
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const FleetManager = mongoose.model('fleetManager', fleetManagerSchema, 'Fleet_Manager');

export default FleetManager;