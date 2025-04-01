import jwt from 'jsonwebtoken';

export default function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    // Use environment variable directly
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Optional: Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ message: 'Token has expired' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    // More specific error handling
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Log unexpected errors
    console.error('Token verification error:', err);
    res.status(500).json({ message: 'Server error during token verification' });
  }
}