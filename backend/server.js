// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import driverRoutes from './routes/drivers.js';
import { router as authRoutes } from './routes/auth.js';
import logisticsRoutes from './routes/model.js'; // Import the new routes
import assignmentRoutes from './routes/assignment.js';
import notificationRoutes from './routes/notification.js';
import NotificationService from './Services/NotificationService.js';
// Initialize dotenv
dotenv.config();
// Initialize dotenv
dotenv.config();

// Initialize express app
const app = express();
// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
// Update your CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://hannahpohmah.github.io'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-auth-token'],
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://hannahpohmah:hrGqdG2gKhSfJK6r@cluster0.l6lyk.mongodb.net/Driver_Db?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/drivers', driverRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', logisticsRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/notifications', notificationRoutes);
// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
