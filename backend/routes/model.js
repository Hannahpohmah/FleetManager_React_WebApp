// routes/model.js - updated with customer data handling
import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { PythonShell } from 'python-shell';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import OptimizationResult from '../models/allocation.js';
import RouteResult from '../models/routes_optimized.js'; 
import auth from '../middleware/auth.js';
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    console.log(`Setting upload destination to: ${uploadDir}`);
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      console.log(`Creating upload directory: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log(`Setting filename to: ${filename}`);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    console.log(`Received file: ${file.originalname}, mimetype: ${file.mimetype}`);
    // Accept only Excel files
    if (
      file.mimetype === 'application/vnd.ms-excel' || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      console.log('File accepted (valid Excel mimetype)');
      cb(null, true);
    } else {
      console.log(`File rejected (invalid mimetype: ${file.mimetype})`);
      cb(new Error('Only Excel files are allowed'), false);
    }
  } 
});

// Helper function to parse Excel file
const parseExcelFile = (filePath) => {
  console.log(`Parsing Excel file: ${filePath}`);
  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`Excel file loaded. Sheets: ${workbook.SheetNames.join(', ')}`);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Converted sheet to JSON. Found ${data.length} rows.`);
    console.log(`First row sample: ${JSON.stringify(data[0])}`);
    return data;
  } catch (error) {
    console.error(`Error parsing Excel file: ${error.message}`);
    throw error;
  }
};

// Define customer keywords once - expanded to include all variations
const CUSTOMER_KEYWORDS = [
  'customer', 'client', 'retailer', 'distributor'
];

// Helper function to check if a column name contains any customer keywords
const isCustomerColumn = (columnName) => {
  if (!columnName) return false;
  const normalizedCol = columnName.toLowerCase().trim();
  
  // First check for exact matches
  if (CUSTOMER_KEYWORDS.includes(normalizedCol)) return true;
  
  // Then check for partial matches
  return CUSTOMER_KEYWORDS.some(keyword => normalizedCol.includes(keyword));
};

// Helper function to find column key by name (handles spaces and case sensitivity)
const findColumnKey = (row, columnName) => {
  const key = Object.keys(row).find(key => 
    key.trim().toLowerCase() === columnName.toLowerCase() ||
    key.replace(/[^a-zA-Z]/g, '').toLowerCase() === columnName.replace(/[^a-zA-Z]/g, '').toLowerCase()
  );
  
  console.log(`Finding column key for "${columnName}": ${key ? `"${key}"` : 'not found'}`);
  return key;
};

// Function to find the customer column name from an array of column names
const findCustomerColumnName = (columns) => {
  // Try to find the first column that matches our customer criteria
  return columns.find(column => isCustomerColumn(column)) || null;
};

// Improved customer data preprocessing - caches results to avoid duplication
let customerCache = new Map();

function preprocessCustomerData(destinations) {
  if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
    console.warn('No destination data available for customer preprocessing');
    return customerCache.size > 0 ? customerCache : new Map();
  }
  
  // Return cached map if it's already populated and cache is enabled
  if (customerCache.size > 0) {
    console.log(`Using cached customer data with ${customerCache.size} entries`);
    return customerCache;
  }
  
  // Debug destinations structure
  console.log(`Preprocessing ${destinations.length} destinations for customer data`);
  console.log(`Sample destination:`, JSON.stringify(destinations[0]));
  
  const customerMap = new Map();
  const processedCount = {
    valid: 0,
    missing: 0
  };
  
  destinations.forEach(dest => {
    // Make sure to check for both uppercase and lowercase field names
    const streetValue = 
      dest.dest_street || dest.destStreet || dest.destination || 
      dest.Destination || dest.DEST_STREET || dest.street || null;
    
    const customerValue = 
      dest.customer || dest.Customer || dest.CUSTOMER || 
      dest.customerName || dest.name || null;
    
    if (streetValue && customerValue) {
      const normalizedStreet = String(streetValue).trim().toLowerCase();
      const normalizedCustomer = String(customerValue).trim();
      
      // Store both the original and normalized versions for matching
      customerMap.set(normalizedStreet, {
        customer: normalizedCustomer,
        metadata: dest.metadata || dest.customerData || null
      });
      
      // Also store versions with no spaces and no special chars
      customerMap.set(normalizedStreet.replace(/\s+/g, ''), {
        customer: normalizedCustomer,
        metadata: dest.metadata || dest.customerData || null
      });
      
      customerMap.set(normalizedStreet.replace(/[^a-z0-9]/g, ''), {
        customer: normalizedCustomer,
        metadata: dest.metadata || dest.customerData || null
      });
      
      console.log(`✓ Mapped "${streetValue}" to customer: "${normalizedCustomer}"`);
      processedCount.valid++;
    } else {
      console.warn(`✗ Incomplete destination data:`, 
        `street=${streetValue || 'MISSING'}`, 
        `customer=${customerValue || 'MISSING'}`);
      processedCount.missing++;
    }
  });
  
  console.log(`Customer data preprocessing complete:`);
  console.log(`- Valid mappings: ${processedCount.valid}`);
  console.log(`- Missing data: ${processedCount.missing}`);
  console.log(`- Total map entries: ${customerMap.size}`);
  
  // Update the cache if we found valid data
  if (customerMap.size > 0) {
    customerCache = customerMap;
  }
  
  return customerMap;
}

function mergeCustomerDataWithAllocations(allocations, sources, destinations) {
  // Validate input
  if (!allocations || !Array.isArray(allocations)) {
    console.error('Invalid allocations data for customer merging');
    return [];
  }
  
  console.log(`Merging customer data with ${allocations.length} allocations`);
  
  // Get preprocessed customer data - use the customer cache if it exists
  const customerMap = customerCache.size > 0 ? customerCache : preprocessCustomerData(destinations);
  
  if (customerMap.size === 0) {
    console.warn('No valid customer mappings found. Check your destinations data structure.');
    if (destinations && destinations.length > 0) {
      console.log('Destinations sample:', JSON.stringify(destinations.slice(0, 1)));
    }
    return allocations; // Return original allocations if no mappings
  }
  
  // Check if allocations already have customer data
  const alreadyEnhanced = allocations.some(alloc => alloc.destination_customer);
  if (alreadyEnhanced) {
    console.log('Allocations already have customer data, skipping enhancement');
    return allocations;
  }
  
  // Merge customer data into allocations
  const enhancedAllocations = allocations.map(allocation => {
    // Create a copy to avoid mutating original
    const enrichedAllocation = { ...allocation };
    
    if (!allocation.destination) {
      console.warn('Allocation missing destination, skipping customer merge');
      return enrichedAllocation;
    }
    
    // Normalize destination for matching
    const normalizedDest = String(allocation.destination).trim().toLowerCase();
    const normalizedDestNoSpaces = normalizedDest.replace(/\s+/g, '');
    const normalizedDestNoSpecial = normalizedDest.replace(/[^a-z0-9]/g, '');
    
    // Try multiple matching strategies
    const customerMatch = 
      customerMap.get(normalizedDest) || 
      customerMap.get(normalizedDestNoSpaces) ||
      customerMap.get(normalizedDestNoSpecial);
    
    if (customerMatch) {
      enrichedAllocation.destination_customer = customerMatch.customer;
      
      // Only add metadata if it exists
      if (customerMatch.metadata) {
        enrichedAllocation.customer_metadata = customerMatch.metadata;
      }
      
      console.log(`✓ Enhanced allocation: "${allocation.destination}" -> "${customerMatch.customer}"`);
    } else {
      console.log(`✗ No customer match found for: "${allocation.destination}"`);
    }
    
    return enrichedAllocation;
  });
  
  const matchedCount = enhancedAllocations.filter(a => a.destination_customer).length;
  console.log(`Enhancement complete: ${matchedCount}/${enhancedAllocations.length} allocations matched with customers`);
  
  return enhancedAllocations;
}

function extractCustomerData(allocations) {
  if (!allocations || !Array.isArray(allocations)) return [];
  
  return allocations
    .filter(alloc => alloc.destination_customer)
    .map(alloc => ({
      destination: alloc.destination,
      customer: alloc.destination_customer
    }));
}

// Helper function to extract customer data from allocations
function extractAndFormatCustomerData(allocations) {
  if (!allocations || !Array.isArray(allocations)) {
    console.warn('No allocations to extract customer data from');
    return [];
  }
  
  const customerData = allocations
    .filter(alloc => alloc.destination_customer)
    .map(alloc => ({
      destination: alloc.destination,
      customer: alloc.destination_customer,
      metadata: alloc.customer_metadata || null
    }));
  
  console.log(`Extracted ${customerData.length} customer records from ${allocations.length} allocations`);
  
  return customerData;
}

// Modify optimizeRoutesWithPython to focus on enhanced allocations
const optimizeRoutesWithPython = async (req, sources, destinations, customerData = null) => {
  // Extract fleet manager ID from the session token
  const fleetManagerId = req.user.id;
  
  if (!fleetManagerId) {
    throw new Error('Unable to identify fleet manager. Please log in again.');
  }
  
  // Generate a unique ID for this job
  const jobId = uuidv4();
  console.log(`Starting route optimization job: ${jobId} for fleet manager: ${fleetManagerId}`);
  console.log(`Processing ${sources.length} sources and ${destinations.length} destinations`);

  const dataPath = path.join(process.cwd(), 'temp', `${jobId}.json`);
  
  // Ensure temp directory exists
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    console.log(`Creating temp directory: ${tempDir}`);
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Write data to a temporary file
  console.log(`Writing data to temporary file: ${dataPath}`);
  fs.writeFileSync(dataPath, JSON.stringify({ sources, destinations }));
  
  const startTime = Date.now();
  
  // Check if job already exists - prevent duplicates
  try {
    const existingJob = await OptimizationResult.findOne({ jobId });
    if (existingJob) {
      console.log(`Found existing job with ID ${jobId}, generating new ID`);
      // Generate a new job ID by adding a timestamp suffix
      const newJobId = `${jobId}-${Date.now()}`;
      console.log(`Using new job ID: ${newJobId}`);
      // Update the job ID for this run
      jobId = newJobId;
    }
  } catch (err) {
    console.warn(`Error checking for existing job: ${err.message}`);
    // Continue with the generated job ID
  }
  
  return new Promise((resolve, reject) => {
    const options = {
    mode: 'text',
    pythonPath: 'python', // Use system Python on Render
    scriptPath: path.join(process.cwd(), 'python_scripts'),
    args: ['optimize', dataPath]
  };

    console.log(`Starting Python optimization script with options: ${JSON.stringify(options)}`);
    
    // Create PythonShell with stderr capturing
    let pyshell = new PythonShell('./app.py', options);
    let stderrOutput = [];
    
    // Capture stderr
    pyshell.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.log(`Python stderr: ${dataStr}`);
      stderrOutput.push(dataStr);
      
      // Look for the final JSON result in real-time
      try {
        // Check if this chunk contains a complete JSON object
        if (dataStr.trim().startsWith('{') && dataStr.trim().endsWith('}')) {
          const jsonObj = JSON.parse(dataStr.trim());
          if (jsonObj.allocations) {
            console.log('Found complete JSON result in stderr');
            
            // Process customer data only if not already processed
            jsonObj.allocations = mergeCustomerDataWithAllocations(
              jsonObj.allocations, 
              sources,
              destinations
            );
            
            // Extract customer data from enhanced allocations
            const customerData = extractCustomerData(jsonObj.allocations);
            
            // Update the database record with the results - using upsert to handle potential duplicates
            updateDatabaseRecord(
              {...jsonObj, destination_customer: customerData}, 
              jobId, 
              startTime, 
              fleetManagerId, 
              destinations
            )
            .then(() => resolve(jsonObj))
            .catch(err => {
              console.error(`Error updating database: ${err.message}`);
              resolve(jsonObj);
            });
          }
        }
      } catch (e) {
        // Not a complete JSON object, continue collecting output
      }
    });

    // Handle completion
    pyshell.end((err) => {
      if (err) {
        console.error(`Optimization script error: ${err.message}`);
        
        // Update the database record with failure status
        updateDatabaseRecord(
          { error: err.message }, 
          jobId, 
          startTime, 
          fleetManagerId, 
          destinations, 
          'failed'
        ).catch(dbErr => console.error(`Error updating database with failure: ${dbErr.message}`));
        
        reject(err);
        return;
      }
      
      // If we didn't find a complete JSON object during streaming,
      // try to find the final result in the complete stderr output
      const stderrText = stderrOutput.join('');
      
      try {
        // First try to find the complete JSON object at the end
        const jsonLines = stderrText.split('\n')
          .filter(line => line.trim().startsWith('{') && line.trim().endsWith('}'));
        
        if (jsonLines.length > 0) {
          // Take the last JSON object (most likely the final result)
          const lastJsonLine = jsonLines[jsonLines.length - 1];
          const jsonObj = JSON.parse(lastJsonLine);
          if (jsonObj.allocations) {
            console.log('Found JSON result at the end of stderr');
            
            // Process customer data only if not already processed
            jsonObj.allocations = mergeCustomerDataWithAllocations(
              jsonObj.allocations, 
              sources,
              destinations
            );
            
            // Extract customer data from enhanced allocations
            const customerData = extractCustomerData(jsonObj.allocations);
            
            // Update the database record with the results
            updateDatabaseRecord(
              {...jsonObj, destination_customer: customerData}, 
              jobId, 
              startTime, 
              fleetManagerId, 
              destinations
            )
            .then(() => resolve(jsonObj))
            .catch(err => {
              console.error(`Error updating database: ${err.message}`);
              resolve(jsonObj);
            });
            
            return;
          }
        }
        
        console.error('Could not find valid JSON result in stderr');
        
        // Update the database record with failure status
        updateDatabaseRecord(
          { error: 'No valid JSON found' }, 
          jobId, 
          startTime, 
          fleetManagerId, 
          destinations, 
          'failed'
        ).catch(dbErr => console.error(`Error updating database with failure: ${dbErr.message}`));
        
        reject(new Error('No valid JSON found in Python stderr output'));
      } catch (error) {
        console.error(`Error processing Python stderr: ${error.message}`);
        
        // Update the database record with failure status
        updateDatabaseRecord(
          { error: error.message }, 
          jobId, 
          startTime, 
          fleetManagerId, 
          destinations, 
          'failed'
        ).catch(dbErr => console.error(`Error updating database with failure: ${dbErr.message}`));
        
        reject(error);
      }
    });
  });
};
// Modify updateDatabaseRecord to rely on destination_customer from enhanced allocations
async function updateDatabaseRecord(resultData, jobId, startTime, fleetManagerId, destinations = [], status = 'completed') {
  // Validate input
  if (!jobId || !fleetManagerId) {
    console.error('Missing required parameters for database update');
    throw new Error('Invalid parameters for database record update');
  }
  
  const executionTimeMs = Date.now() - startTime;
  
  try {
    // Ensure we have allocations data
    const allocations = resultData?.allocations || [];
    if (allocations.length === 0) {
      console.warn('No allocations data found for database update');
    }
    
    // Extract customer data from enhanced allocations
    const customerData = extractAndFormatCustomerData(allocations);
    
    // Prepare the update operations with proper upsert handling
    const updateOperation = {
      $set: {
        status: status,
        executionTimeMs: executionTimeMs,
        allocations: allocations,
        destination_customer: customerData,
        lastUpdated: new Date()
      }
    };
    
    // Only initialize these fields during creation, not update
    const setOnInsert = {
      $setOnInsert: {
        jobId,
        fleetManager: fleetManagerId,
        sourceCount: resultData.sources?.length || 0,
        destinationCount: resultData.destinations?.length || 0,
        createdAt: new Date()
      }
    };
    
    // Add rawData if available
    if (resultData.sources || resultData.destinations) {
      updateOperation.$set.rawData = {
        sources: resultData.sources || [],
        destinations: resultData.destinations || []
      };
    }
    
    // Add error if failed
    if (status === 'failed' && resultData.error) {
      updateOperation.$set.error = resultData.error;
    }
    
    console.log(`Updating record for job ${jobId}:`);
    console.log(`- Status: ${status}`);
    console.log(`- Allocations: ${allocations.length}`);
    console.log(`- Customer data: ${customerData.length}`);
    
    // Combine the operations
    const finalOperation = {
      ...updateOperation,
      ...setOnInsert
    };
    
    // Use findOneAndUpdate with upsert: true to handle potential duplicate issues
    const updatedRecord = await OptimizationResult.findOneAndUpdate(
      { jobId },
      finalOperation,
      { 
        new: true,
        runValidators: true,
        upsert: true
      }
    );
    
    if (!updatedRecord) {
      console.error(`Failed to update record for job ${jobId}. Record might have been deleted.`);
      return null;
    }
    
    console.log(`Successfully updated record for job ${jobId}`);
    return updatedRecord;
  } catch (error) {
    // Handle duplicate key errors specifically
    if (error.code === 11000 && error.message.includes('jobId')) {
      console.warn(`Duplicate jobId detected: ${jobId}`);
      
      // Generate a new job ID by adding a timestamp suffix
      const newJobId = `${jobId}-${Date.now()}`;
      console.log(`Retrying with new job ID: ${newJobId}`);
      
      // Recursive call with new jobId
      return updateDatabaseRecord(
        resultData, 
        newJobId, 
        startTime, 
        fleetManagerId, 
        destinations, 
        status
      );
    }
    
    console.error(`Database update error for job ${jobId}:`, error);
    throw error;
  }
}

// POST route for file upload and processing
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  // Clear customer cache at the start of each new upload
  customerCache = new Map();
  
  // Initialize routeResults at the beginning of the function
  const routeResults = [];
  
  console.log('Received upload request for optimization');
  console.log(`Request body: ${JSON.stringify(req.body)}`);
  console.log(`Request file: ${req.file ? JSON.stringify({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  }) : 'none'}`);
  
  try {
    if (!req.file) {
      console.error('No file part in the request');
      return res.status(400).json({ error: "No file part" });
    }
    
    const filepath = req.file.path;
    console.log(`File uploaded to: ${filepath}`);

    // Check for customer data processing flag
    const processCustomerData = req.body.process_customer_data === 'true';
    const customerColumnName = req.body.customer_column_name;
    
    if (processCustomerData && customerColumnName) {
      console.log(`Will process customer data from column: "${customerColumnName}"`);
    }

    try {
      // Read the Excel file using XLSX
      console.log(`Reading Excel file from: ${filepath}`);
      const df = parseExcelFile(filepath);
      
      // Validate required columns (case-insensitive)
      const requiredColumns = ["Source", "Destination", "Capacity", "Demand"];
      const availableColumns = Object.keys(df[0]);
      console.log(`Available columns: ${availableColumns.join(', ')}`);
      
      const normalizedAvailableColumns = availableColumns.map(col => col.trim().toLowerCase());
      console.log(`Normalized columns: ${normalizedAvailableColumns.join(', ')}`);

      const missingColumns = requiredColumns.filter(reqCol => 
        !normalizedAvailableColumns.includes(reqCol.toLowerCase())
      );
      
      console.log(`Missing columns (first check): ${missingColumns.join(', ')}`);
      
      // Alternative check if columns still missing
      if (missingColumns.length > 0) {
        console.log('Standard column names not found, trying alternative check');
        // Try a second approach - strip all non-alphabetic characters
        const alphaOnlyAvailable = availableColumns.map(col => 
          col.replace(/[^a-zA-Z]/g, '').toLowerCase()
        );
        
        console.log(`Alpha-only columns: ${alphaOnlyAvailable.join(', ')}`);
        
        const alphaOnlyMissing = requiredColumns.filter(reqCol => 
          !alphaOnlyAvailable.includes(reqCol.replace(/[^a-zA-Z]/g, '').toLowerCase())
        );
        
        console.log(`Missing columns (second check): ${alphaOnlyMissing.join(', ')}`);
        
        if (alphaOnlyMissing.length > 0) {
          console.error(`Required columns still missing after both checks: ${missingColumns.join(', ')}`);
          return res.status(400).json({ 
            error: `Missing required columns: ${missingColumns.join(', ')}` 
          });
        }
      }
      
      // If customer data processing wasn't explicitly requested, check for customer column
      if (!processCustomerData || !customerColumnName) {
        const detectedCustomerColumn = findCustomerColumnName(availableColumns);
        if (detectedCustomerColumn) {
          console.log(`Detected customer column: "${detectedCustomerColumn}"`);
          // Override with detected column
          req.body.process_customer_data = 'true';
          req.body.customer_column_name = detectedCustomerColumn;
        }
      }
      
      // Build lists of sources and destinations for optimization
      const sources = [];
      const destinations = [];
      
      for (const row of df) {
        const sourceKey = findColumnKey(row, 'source');
        const destKey = findColumnKey(row, 'destination');
        const capacityKey = findColumnKey(row, 'capacity');
        const demandKey = findColumnKey(row, 'demand');
        
        // Look for customer data if requested
        let customerData = null;
        if (req.body.process_customer_data === 'true' && req.body.customer_column_name) {
          const customerKey = findColumnKey(row, req.body.customer_column_name);
          if (customerKey && row[customerKey]) {
            customerData = String(row[customerKey]).trim();
          }
        }
        
        if (sourceKey && capacityKey) {
          const sourceEntry = {
            source_street: String(row[sourceKey]).trim(),
            capacity: parseFloat(row[capacityKey])
          };
          sources.push(sourceEntry);
        }
        
        if (destKey && demandKey) {
          const destEntry = {
            dest_street: String(row[destKey]).trim(),
            demand: parseFloat(row[demandKey])
          };
          
          // Add customer data if available
          if (customerData) {
            destEntry.customer = customerData;
          }
          
          destinations.push(destEntry);
        }
      }
      
      if (sources.length === 0 || destinations.length === 0) {
        return res.status(400).json({ 
          error: "Both sources and destinations are required for optimization." 
        });
      }
      
      // Run the logistics optimizer using Python
      console.log("\nRunning logistics optimization...");
      try {
        // We'll preserve customer info for destinations to ensure it's available for the merging step
        const optimizationResult = await optimizeRoutesWithPython(req, sources, destinations);
        
        // Extract route results from the optimization result
        const routeResults = optimizationResult.routes || [];
        
        // If there are no route results but there are allocations, generate basic route data
        if (routeResults.length === 0 && optimizationResult.allocations && optimizationResult.allocations.length > 0) {
          // Create route results from allocation data
          const generatedRoutes = optimizationResult.allocations.map(allocation => ({
            id: uuidv4(),
            source: allocation.source,
            destination: allocation.destination,
            quantity: allocation.quantity,
            destination_customer: allocation.destination_customer
          }));
          
          // Store these generated routes in the database - without duplicating customer data processing
          try {
            await OptimizationResult.findOneAndUpdate(
              { jobId: optimizationResult.jobId || uuidv4() },
              {
                $set: {
                  routes: generatedRoutes,
                  status: 'completed'
                }
              },
              { new: true }
            );
            console.log(`Updated ${generatedRoutes.length} generated routes in optimization result`);
            
            // Use these routes for the response
            optimizationResult.routes = generatedRoutes;
          } catch (dbError) {
            console.error("Error saving generated routes to database:", dbError);
          }
        }
        
        // Return JSON with both route results and optimization results
        return res.status(200).json({
          routes: optimizationResult.routes || [],
          allocations: optimizationResult.allocations || []
        });
        
      } catch (error) {
        console.error("Optimization error:", error);
        return res.status(500).json({
          routes: [],
          error: `Optimization error: ${error.message}`,
          allocations: []
        });
      }
    } catch (error) {
      return res.status(500).json({ 
        error: `Error processing file: ${error.message}` 
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      error: `Error processing request: ${error.message}` 
    });
  }
});


// Route to get optimization history for the authenticated user
router.get('/optimization-history', auth, async (req, res) => {
  try {
    const fleetManagerId = req.user.id;
    
    // Fetch optimization history for this fleet manager
    const history = await OptimizationResult.find({ fleetManager: fleetManagerId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(history);
  } catch (error) {
    console.error('Get optimization history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route to get a specific optimization result
router.get('/optimization/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const fleetManagerId = req.user.id;
    
    const result = await OptimizationResult.findOne({ 
      jobId, 
      fleetManager: fleetManagerId 
    });
    
    if (!result) {
      return res.status(404).json({ message: 'Optimization result not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Get optimization result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


const findRouteWithPython = async (req, rawData, allocationJobId = null, isGrouped = false) => {
  // Extract user ID from the session token
  const userId = req.user.id;
  
  if (!userId) {
    throw new Error('Unable to identify user. Please log in again.');
  }
  if (allocationJobId) {
    console.log(`Processing with optimization job reference: ${allocationJobId}`);
  }
  
  // Generate a unique ID for this job
  const jobId = uuidv4();
  console.log(`Starting route finding job: ${jobId} for user: ${userId}`);
  
  // Handle grouped routes (when isGrouped is true)
  if (isGrouped) {
    console.log(`Processing grouped routes with ${rawData.length} source groups`);
    
    // Count total destinations
    const destinationCount = rawData.reduce((total, group) => {
      return total + (group.destinations ? group.destinations.length : 0);
    }, 0);
    
    console.log(`Found ${rawData.length} sources with ${destinationCount} total destinations`);
    
    // Create a new record in the database to track the job
    const routeRecord = new RouteResult({
      jobId,
      user: userId,
      groupedData: rawData,
      sourceCount: rawData.length,
      destinationCount,
      status: 'processing',
      isGrouped: true,
      allocationJobId
    });
    
    // Save the initial record
    await routeRecord.save();
    console.log(`Created initial database record with jobId: ${jobId} for user: ${userId}`);
    
    const startTime = Date.now();
    
    // Process each source group
    let routes = [];
    let errors = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const sourceGroup = rawData[i];
      const source = sourceGroup.source;
      const destinations = sourceGroup.destinations || [];
      
      console.log(`Processing source group ${i+1}/${rawData.length}: ${source} with ${destinations.length} destinations`);
      
      // Create customer map for this source group
      const customerMap = {};
      if (sourceGroup.customers && sourceGroup.customers.length > 0) {
        sourceGroup.customers.forEach(customerInfo => {
          customerMap[customerInfo.destination] = customerInfo.customer;
        });
      }
      
      try {
        // Process all destinations for this source in one call
        const result = await processRoutePair(source, destinations, true);
        
        // Add customer info if available to each destination
        if (result && result.destinations) {
          result.destinations.forEach(destResult => {
            const customer = customerMap[destResult.destination] || null;
            if (customer) {
              destResult.customer = customer;
            }
          });
        }
        
        routes.push(result);
      } catch (error) {
        console.error(`Error processing routes from ${source}: ${error.message}`);
        errors.push({
          source,
          error: error.message
        });
      }
    }
    
    // Create the final result object
    const finalResult = {
      jobId,
      routes,
      errors,
      sourceCount: rawData.length,
      destinationCount,
      successCount: routes.reduce((count, group) => 
        count + (group.destinations ? group.destinations.length : 0), 0),
      errorCount: errors.length
    };
    
    // Update the database record with results
    await updateRouteRecord(finalResult, jobId, startTime, userId, 'completed', allocationJobId, true);
    
    return {
      jobId,
      sourceCount: rawData.length,
      destinationCount
    };
  } 
  // Original non-grouped processing
  else {
    // Check if customer data processing is requested
    let processCustomerData = req.body.process_customer_data === 'true';
    let customerColumnName = req.body.customer_column_name;
    
    if (!processCustomerData || !customerColumnName) {
      // Check if any route has a customer field
      const hasCustomerData = rawData.some(route => 
        route.customer || 
        route.client || 
        route.name || 
        route.customerName
      );
      
      if (hasCustomerData) {
        processCustomerData = true;
        customerColumnName = rawData.some(route => route.customer) 
          ? 'customer' 
          : (rawData.some(route => route.client) 
            ? 'client' 
            : (rawData.some(route => route.name) 
              ? 'name' 
              : 'customerName'));
        
        console.log(`Auto-detected customer data processing. Using column: "${customerColumnName}"`);
      }
    }
    
    // Extract valid source-destination pairs and customer data if available
    const { sources, destinations, customers, pairCount, skippedPairs } = RouteResult.extractValidPairs(rawData, customerColumnName);
    
    // Validate that we have at least one valid pair
    if (pairCount === 0) {
      throw new Error('No valid source-destination pairs found in the data.');
    }
    
    console.log(`Found ${pairCount} valid source-destination pairs. Skipped ${skippedPairs} incomplete entries.`);
    if (customers && customers.length > 0) {
      console.log(`Extracted ${customers.length} customer names for record-keeping`);
    }
    
    // Create a new record in the database to track the job
    const routeRecord = new RouteResult({
      jobId,
      user: userId,
      sources,
      destinations,
      customers,
      pairCount,
      skippedPairs,
      status: 'processing',
      isGrouped: false,
      allocationJobId
    });
    
    // Save the initial record
    await routeRecord.save();
    console.log(`Created initial database record with jobId: ${jobId} for user: ${userId}`);
    
    const startTime = Date.now();
    
    // Process routes one by one
    let routes = [];
    let errors = [];

    // Process each route pair sequentially
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const destination = destinations[i];
      const customer = customers && customers[i] ? customers[i] : null;
      
      console.log(`Processing route ${i+1}/${sources.length}: ${source} to ${destination}${customer ? ` (Customer: ${customer})` : ''}`);
      
      try {
        // Execute Python script for a single route
        const result = await processRoutePair(source, destination, false);

        // Preserve the original source, destination, and add customer info
        const fullRouteResult = {
          start: source,
          end: destination,
          ...result
        };
        
        if (customer) {
          fullRouteResult.customer = customer;
        }
        
        routes.push(fullRouteResult);
      } catch (error) {
        console.error(`Error processing route from ${source} to ${destination}: ${error.message}`);
        errors.push({
          start: source,
          end: destination,
          customer: customer || null,
          error: error.message
        });
      }
    }
    
    // Create the final result object
    const finalResult = {
      jobId,
      routes,
      errors,
      totalProcessed: routes.length + errors.length,
      successCount: routes.length,
      errorCount: errors.length
    };
    
    // Update the database record with results
    await updateRouteRecord(finalResult, jobId, startTime, userId, 'completed', allocationJobId, false);
    
    return {
      jobId,
      pairCount
    };
  }
};

RouteResult.extractValidPairs = (rawData, customerColumnName = null) => {
  const sources = [];
  const destinations = [];
  const customers = [];
  let pairCount = 0;
  let skippedPairs = 0;

  rawData.forEach(entry => {
    // Extract source and destination, allowing flexibility in naming
    const source = entry.source || entry.start || entry.from;
    const destination = entry.destination || entry.end || entry.to;

    // Check if source and destination are valid
    if (source && destination) {
      sources.push(String(source).trim());
      destinations.push(String(destination).trim());
      
      // Extract customer data with flexible naming
      let customer = null;
      if (customerColumnName) {
        customer = entry[customerColumnName];
      } else {
        // Try common customer column names if no specific column is provided
        const customerCandidates = ['customer', 'client', 'retailer', 'customerName'];
        for (let candidate of customerCandidates) {
          if (entry[candidate]) {
            customer = entry[candidate];
            break;
          }
        }
      }
      
      customers.push(customer ? String(customer).trim() : null);
      pairCount++;
    } else {
      skippedPairs++;
    }
  });

  return { sources, destinations, customers, pairCount, skippedPairs };
};

// Modify processRoutePair to handle both single routes and multiple destinations
const processRoutePair = (source, destination, isMultiDestination = false) => {
  return new Promise((resolve, reject) => {
    // Create a temporary file for this pair or group
    const tempId = uuidv4();
    const dataPath = path.join(process.cwd(), 'temp', `${tempId}.json`);
    
    let dataToWrite;
    
    if (isMultiDestination && Array.isArray(destination)) {
      // For grouped routes with multiple destinations
      dataToWrite = { 
        source, 
        destinations: destination,
        isMultiDestination: true
      };
    } else {
      // For single destination route
      dataToWrite = { 
        source, 
        destination,
        isMultiDestination: false
      };
    }
    
    // Write data to file
    fs.writeFileSync(dataPath, JSON.stringify(dataToWrite));
    
    const options = {
    mode: 'text',
    pythonPath: 'python', // Use system Python on Render
    scriptPath: path.join(process.cwd(), 'python_scripts'),
    args: ['optimize', dataPath]
  };
    
    let pyshell = new PythonShell('./app.py', options);
    let resultFound = false;
    let stderrBuffer = ''; // Buffer to accumulate stderr output
    
    pyshell.stderr.on('data', (data) => {
      if (resultFound) return;
      const dataStr = data.toString();
      console.log(`Python stderr: ${dataStr}`);
      
      // Accumulate stderr data
      stderrBuffer += dataStr;
      
      // Specifically look for "Route Result:" marker followed by JSON
      if (dataStr.includes('Route Result:')) {
        // Try to extract the JSON after "Route Result:"
        const routeResultIndex = stderrBuffer.lastIndexOf('Route Result:');
        if (routeResultIndex !== -1) {
          const jsonStartIndex = routeResultIndex + 'Route Result:'.length;
          const jsonString = stderrBuffer.substring(jsonStartIndex).trim();
          
          // Try to parse the JSON
          try {
            console.log('Found Route Result, attempting to parse JSON');
            const jsonObj = JSON.parse(jsonString);
            
            // Mark that we found a result to avoid further processing
            resultFound = true;
            
            // Clean up the temp file
            try { fs.unlinkSync(dataPath); } catch (e) { /* ignore */ }
            
            resolve(jsonObj);
            return;
          } catch (e) {
            console.log('JSON parsing error for Route Result:', e.message);
            // Not valid JSON yet, continue accumulating
          }
        }
      }
    });
    
    pyshell.end((err) => {
      // Clean up temp file if not already done
      try { fs.unlinkSync(dataPath); } catch (e) { /* ignore */ }
      
      // If we already found and processed a result, don't do anything else
      if (resultFound) return;
      
      if (err) {
        reject(err);
        return;
      }
      
      // Try one more time with the complete buffer
      try {
        // Look for Route Result: followed by JSON
        const routeResultRegex = /Route Result:\s*(\{[\s\S]*\})/;
        const resultMatch = stderrBuffer.match(routeResultRegex);
        
        if (resultMatch && resultMatch[1]) {
          const jsonStr = resultMatch[1];
          console.log('Attempting to parse final Route Result JSON');
          const jsonObj = JSON.parse(jsonStr);
          resolve(jsonObj);
          return;
        }
      } catch (e) {
        console.log('Final JSON parsing error:', e.message);
      }
      
      // If we got here and haven't found a result yet, that's an error
      reject(new Error('No valid route data found in Python output'));
    });
  });
};

const updateRouteRecord = async (result, jobId, startTime, userId, status = 'completed', allocationJobId = null) => {
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  try {
    const routeRecord = await RouteResult.findOne({ jobId });
    
    if (!routeRecord) {
      console.error(`Route record not found for jobId: ${jobId}`);
      return;
    }
    
    // Update the record with results
    routeRecord.results = result;  // Store the entire result object in the results field
    routeRecord.status = status;
    routeRecord.executionTime = executionTime;
    routeRecord.completedAt = new Date();
    if (allocationJobId) {
      routeRecord.allocationJobId = allocationJobId;
      console.log(`Linked route job ${jobId} to allocation job ${allocationJobId}`);
    }
    
    await routeRecord.save();
    console.log(`Updated route record for jobId: ${jobId}`);
  } catch (error) {
    console.error(`Error updating route record: ${error.message}`);
    throw error;
  }
};

// POST route for finding a route
router.post('/find_route', auth, upload.single('file'), async (req, res) => {
  console.log('Received find_route request');
  console.log(`Request body: ${JSON.stringify(req.body)}`);
  console.log(`Request content-type: ${req.headers['content-type']}`);
  console.log(`Request file: ${req.file ? JSON.stringify({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  }) : 'none'}`);
  
  try {
    // Check if this is a file upload or direct input
    const optimizationJobId = req.body.optimizationJobId;
    if (optimizationJobId) {
      console.log(`Received optimization job ID: ${optimizationJobId}`);
    }

    // Check for customer data processing flag
    const processCustomerData = req.body.process_customer_data === 'true';
    const customerColumnName = req.body.customer_column_name;
    
    console.log(`Customer Data Processing:
      - Explicitly Requested: ${processCustomerData}
      - Specified Column: ${customerColumnName || 'Not specified'}
    `);

    let routeData = [];

    if (req.file) {
      console.log('Processing file upload request');
      // Handle Excel file upload
      const filepath = req.file.path;
      
      try {
        // Read the Excel file
        console.log(`Reading Excel file from: ${filepath}`);
        const df = parseExcelFile(filepath);
        
        // Case-insensitive column validation
        const availableColumns = Object.keys(df[0] || {});
        console.log(`Available columns: ${availableColumns.join(', ')}`);
        
        if (!df.length) {
          console.error('Excel file is empty');
          return res.status(400).json({ 
            error: "Excel file is empty" 
          });
        }
        
        const normalizedAvailableColumns = availableColumns.map(col => col.trim().toLowerCase());
        console.log(`Normalized columns: ${normalizedAvailableColumns.join(', ')}`);
        
        if (!normalizedAvailableColumns.includes('source'.toLowerCase()) || 
            !normalizedAvailableColumns.includes('destination'.toLowerCase())) {
          
          console.log('Standard column names not found, trying alternative check');
          // Try alternative check - strip all non-alphabetic characters
          const alphaOnlyAvailable = availableColumns.map(col => 
            col.replace(/[^a-zA-Z]/g, '').toLowerCase()
          );
          
          console.log(`Alpha-only columns: ${alphaOnlyAvailable.join(', ')}`);
          
          if (!alphaOnlyAvailable.includes('source'.replace(/[^a-zA-Z]/g, '').toLowerCase()) ||
              !alphaOnlyAvailable.includes('destination'.replace(/[^a-zA-Z]/g, '').toLowerCase())) {
            console.error('Required columns not found after both checks');
            return res.status(400).json({ 
              error: "Excel file must contain 'Source' and 'Destination' columns" 
            });
          }
        }
        
        // If customer data processing wasn't explicitly requested, check for customer column
        if (!processCustomerData || !customerColumnName) {
          const detectedCustomerColumn = findCustomerColumnName(availableColumns);
          if (detectedCustomerColumn) {
            console.log(`Detected customer column: "${detectedCustomerColumn}"`);
            // Override with detected column
            req.body.process_customer_data = 'true';
            req.body.customer_column_name = detectedCustomerColumn;
          }
        }
        
        // Transform Excel data to array of objects with source, destination and customer (if present)
        routeData = df.map(row => {
          // Find the column that matches 'Source' and 'Destination' (case-insensitive)
          const sourceKey = findColumnKey(row, 'source');
          const destKey = findColumnKey(row, 'destination');
          
          if (!sourceKey || !destKey) {
            console.log('Could not identify source or destination columns in row');
            return null;
          }
          
          const source = String(row[sourceKey]).trim();
          const destination = String(row[destKey]).trim();
          
          if (!source || !destination) {
            console.log('Missing source or destination street in row');
            return null;
          }
          
          const result = { source, destination };
          
          // Add customer data if a customer column was specified
          if (req.body.process_customer_data === 'true' && req.body.customer_column_name) {
            const customerKey = findColumnKey(row, req.body.customer_column_name);
            if (customerKey && row[customerKey]) {
              result.customer = String(row[customerKey]).trim();
            }
          }
          
          return result;
        }).filter(Boolean); // Remove null entries
        
        console.log(`Prepared ${routeData.length} valid routes from Excel file`);
      } catch (error) {
        console.error(`Error processing Excel file: ${error.message}`);
        return res.status(500).json({ 
          error: `Error processing Excel file: ${error.message}` 
        });
      }
    } else {
      console.log('Processing direct input request');
      // Handle direct input fields
      const data = req.is('application/json') ? req.body : req.body;
      
      // Check if we have a single route or multiple routes
      if (data.start && data.end) {
        // Single route case
        const start = String(data.start).trim();
        const end = String(data.end).trim();
        const customer = data.customer ? String(data.customer).trim() : null;
        
        console.log(`Direct input - single route: "${start}" to "${end}"${customer ? ` (Customer: ${customer})` : ''}`);
        
        if (!start || !end) {
          console.error('Missing start or end street in direct input');
          return res.status(400).json({ 
            error: "Both start and end streets are required." 
          });
        }
        
        // Create a single-element array for the route
        routeData = [{ 
          source: start, 
          destination: end, 
          customer: customer 
        }];
      } else if (Array.isArray(data.routes)) {
        // Multiple routes case
        console.log(`Direct input - multiple routes: ${data.routes.length} routes`);
        routeData = data.routes;
      } else {
        console.error('Invalid request format');
        return res.status(400).json({ 
          error: "Invalid request format. Provide either start/end parameters or routes array." 
        });
      }
    }
    
    // Group routes by source if optimizationJobId is provided
    if (optimizationJobId && routeData.length > 0) {
      console.log(`Grouping routes by source for optimization job: ${optimizationJobId}`);
      
      // Create a map of sources to destinations
      const groupedRoutes = {};
      
      routeData.forEach(route => {
        if (!groupedRoutes[route.source]) {
          groupedRoutes[route.source] = {
            source: route.source,
            destinations: [],
            customers: []
          };
        }
        
        groupedRoutes[route.source].destinations.push(route.destination);
        
        // Add customer if available
        if (route.customer) {
          groupedRoutes[route.source].customers.push({
            destination: route.destination,
            customer: route.customer
          });
        }
      });
      
      // Convert the map to an array
      const groupedRouteData = Object.values(groupedRoutes);
      
      console.log(`Grouped ${routeData.length} routes into ${groupedRouteData.length} source groups`);
      
      try {
        // Process the grouped routes
        const result = await findRouteWithPython(req, groupedRouteData, optimizationJobId, true);
        
        console.log(`Route finding job completed: ${result.jobId}`);
        return res.status(200).json({ 
          jobId: result.jobId,
          status: 'processing',
          message: `Processing ${result.sourceCount} sources with ${result.destinationCount} total destinations. Check status with /route_status/${result.jobId}`
        });
      } catch (error) {
        console.error(`Error in grouped route processing: ${error.message}`);
        return res.status(500).json({ 
          error: `Error in grouped route processing: ${error.message}` 
        });
      }
    } else {
      // Original workflow for non-grouped routes
      try {
        const result = await findRouteWithPython(req, routeData, optimizationJobId);
        
        console.log(`Route finding job submitted: ${result.jobId}`);
        return res.status(200).json({ 
          jobId: result.jobId,
          status: 'processing',
          message: `Processing ${result.pairCount} routes. Check status with /route_status/${result.jobId}`
        });
      } catch (error) {
        console.error(`Error in route processing: ${error.message}`);
        return res.status(500).json({ 
          error: `Error in route processing: ${error.message}` 
        });
      }
    }
  } catch (error) {
    console.error(`Error in route finding: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({ 
      error: `Unexpected error: ${error.message}` 
    });
  }
});



// Route status endpoint
router.get('/route_status/:jobId', auth, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const record = await RouteResult.findOne({ jobId });
    
    if (!record) {
      return res.status(404).json({ error: "Route job not found" });
    }
    
    // Check if the job belongs to the current user
    if (record.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "You don't have permission to access this job" });
    }
    
    // Return the results in the expected format
    return res.json({
      jobId: record.jobId,
      status: record.status,
      routes: record.results?.routes || [],
      errors: record.results?.errors || [],
      totalProcessed: record.results?.totalProcessed || 0,
      successCount: record.results?.successCount || 0,
      errorCount: record.results?.errorCount || 0,
      executionTime: record.executionTime || 0,
      createdAt: record.createdAt,
      completedAt: record.completedAt
    });
  } catch (error) {
    console.error(`Error retrieving route status: ${error.message}`);
    return res.status(500).json({ error: "Server error" });
  }
});

  
// Route to get route finding history for the authenticated user
router.get('/route_history', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch route history for this user
    const history = await RouteResult.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Format the results for client consumption
    const formattedHistory = history.map(result => result.formatForClient());
    
    res.json(formattedHistory);
  } catch (error) {
    console.error('Get route history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

