import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const RouteResultSchema = new Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Reference to the optimization allocation jobId
  allocationJobId: {
    type: String,
    ref: 'OptimizationResult',
    index: true
  },

  user: {
    type: Schema.Types.ObjectId,
    ref: 'FleetManager',
    required: true
  },
  sources: [{
    type: String,
    required: true
  }],
  destinations: [{
    type: String,
    required: true
  }],
  // Customer data fields
  processCustomerData: {
    type: Boolean,
    default: false
  },
  customerColumnName: {
    type: String
  },
  customers: [{
    type: String
  }],
  pairCount: {
    type: Number,
    default: 0
  },
  skippedPairs: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  executionTime: {
    type: Number
  },
  results: {
    type: mongoose.Schema.Types.Mixed, // Allows more flexible storing
    default: {}
  },
  errorMessage: {
    type: String
  },
  // Track if this was a file upload or direct input
  inputMethod: {
    type: String,
    enum: ['file', 'direct', 'batch'],
    default: 'direct'
  },
  // File upload details (if applicable)
  fileUpload: {
    originalFilename: String,
    fileSize: Number,
    mimetype: String
  }
}, { timestamps: true });

// Indexes for faster queries
RouteResultSchema.index({ user: 1, createdAt: -1 });
RouteResultSchema.index({ status: 1 });
RouteResultSchema.index({ optimizationJobId: 1 });

// Virtual for computing the age of the job
RouteResultSchema.virtual('ageInMinutes').get(function() {
  return Math.round((Date.now() - this.createdAt) / (1000 * 60));
});

// Method to check if the job has timed out
RouteResultSchema.methods.hasTimedOut = function(timeoutMinutes = 5) {
  return this.status === 'processing' && this.ageInMinutes > timeoutMinutes;
};

// Method to format results for client consumption
RouteResultSchema.methods.formatForClient = function() {
  return {
    jobId: this.jobId,
    allocationJobId: this.allocationJobId || null,
    status: this.status,
    createdAt: this.createdAt,
    completedAt: this.completedAt,
    executionTime: this.executionTime ? `${(this.executionTime / 1000).toFixed(2)} seconds` : null,
    pairCount: this.pairCount,
    skippedPairs: this.skippedPairs,
    processCustomerData: this.processCustomerData,
    routes: this.results?.routes || [],
    errors: this.results?.errors || [],
    totalProcessed: this.results?.totalProcessed || 0,
    successCount: this.results?.successCount || 0,
    errorCount: this.results?.errorCount || 0,
    error: this.errorMessage || null,
    inputMethod: this.inputMethod
  };
};

// Static method to clean up old records
RouteResultSchema.statics.cleanupOldRecords = async function(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({ createdAt: { $lt: cutoffDate } });
  return result.deletedCount;
};

// Static method to process raw data and extract valid source-destination pairs
RouteResultSchema.statics.extractValidPairs = function(rawData) {
  const validSources = [];
  const validDestinations = [];
  const validCustomers = [];
  let skippedCount = 0;
  
  // Ensure rawData is an array
  const dataArray = Array.isArray(rawData) ? rawData : [];
  
  dataArray.forEach(item => {
    if (item && typeof item === 'object') {
      const source = item.source || item.sourceLocation;
      const destination = item.destination || item.destinationLocation;
      const customer = item.customer || null;
      
      // Only include rows with both source and destination
      if (source && destination) {
        validSources.push(source);
        validDestinations.push(destination);
        validCustomers.push(customer);
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  });
  
  return {
    sources: validSources,
    destinations: validDestinations,
    customers: validCustomers,
    pairCount: validSources.length,
    skippedPairs: skippedCount
  };
};

// Find routes by optimization job ID
RouteResultSchema.statics.findByOptimizationJobId = function(allocationJobId) {
  return this.find({ optimizationJobId: allocationJobId });
};

export default mongoose.model('RouteResult', RouteResultSchema);