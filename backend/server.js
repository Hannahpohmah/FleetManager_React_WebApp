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
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',  // Allow any header
  exposedHeaders: '*',  // Expose all headers
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
