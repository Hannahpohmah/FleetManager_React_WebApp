import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Enhanced Schema with more robust customer data handling
const AllocationSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  destination_customer: {
    type: String,
    default: null
  },
  customer_metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
});

const OptimizationResultSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fleetManager: {
    type: Schema.Types.ObjectId,
    ref: 'FleetManager',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  sourceCount: {
    type: Number,
    required: true
  },
  destinationCount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  executionTimeMs: Number,
  allocations: [AllocationSchema],
  // Standardized customer data storage
  destination_customer: [{
    destination: {
      type: String,
      required: true
    },
    customer: {
      type: String,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  }]
});

// Add compound index for efficient queries by fleet manager
OptimizationResultSchema.index({ fleetManager: 1, createdAt: -1 });

// Add static method to find optimizations by fleet manager
OptimizationResultSchema.statics.findByFleetManager = function(fleetManagerId, limit = 20) {
  return this.find({ fleetManager: fleetManagerId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Add static method to get recent successful optimizations
OptimizationResultSchema.statics.getRecentSuccessful = function(fleetManagerId, limit = 5) {
  return this.find({ 
    fleetManager: fleetManagerId,
    status: 'completed'
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Add virtual for formatted creation date
OptimizationResultSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

export default mongoose.model('OptimizationResult', OptimizationResultSchema);

