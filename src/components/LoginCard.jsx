import React, { useState } from 'react';
import ReactCardFlip from 'react-card-flip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Key, AlertCircle, CheckCircle, Mail } from 'lucide-react';
const API_BASE_URL = 'https://fleetmanager-react-webapp.onrender.com';

const LoginCard = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email,
          pwd: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        
        // Store authentication data
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.manager.email);
        localStorage.setItem('username', data.manager.username);

        // Redirect to App page after showing success message
        setTimeout(() => {
          window.location.href = '/app';
        }, 2000);
      } else {
        // Handle login failure
        setError(data.message || 'Authentication failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
      setLoading(false);
    }
  };

  const handleAccessRequest = async (e) => {
    e.preventDefault();

    if (!requestName || !requestEmail) {
      setError('Please provide both name and email');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: requestName,
          email: requestEmail
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setError('');
        setTimeout(() => {
          setSuccess(false);
          setIsFlipped(false);
        }, 3000);
      } else {
        setError(data.message || 'Request failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Access request error:', err);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    // Reset any existing errors when flipping
    setError('');
    setSuccess(false);
  };

  return (
    <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
      <ReactCardFlip isFlipped={isFlipped} flipDirection="horizontal">
        {/* Front Side: Login Form */}
        <div key="front">
          <Card className="shadow-xl border-0 bg-gray-100">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                Sign in to dashboard
              </CardTitle>
              <CardDescription className="text-center">
                Access your fleet management portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>Login successful! Redirecting to dashboard...</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                    placeholder="Enter your email"
                    disabled={success}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Key size={16} className="text-gray-400" />
                      Password
                    </label>
                    <a href="#" className="text-xs text-purple-600 hover:text-purple-800">
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full"
                    placeholder="••••••••"
                    disabled={success}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={success}
                  />
                  <label htmlFor="remember" className="text-sm text-gray-500">
                    Keep me signed in
                  </label>
                </div>
                <Button
                  type="submit"
                  className={`w-full py-2 text-white font-medium rounded-md ${
                    success ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                  disabled={loading || success}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : success ? (
                    <span className="flex items-center justify-center">
                      <CheckCircle size={16} className="mr-2" />
                      Success!
                    </span>
                  ) : 'Sign in to dashboard'}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="#" className="text-purple-600 hover:underline font-medium" onClick={handleFlip}>
                  Request access
                </a>
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Back Side: Request Access Form */}
        <div key="back">
          <Card className="shadow-xl border-0 bg-gray-100">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                Request Access
              </CardTitle>
              <CardDescription className="text-center">
                Fill in your details to request access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccessRequest} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>Access request submitted successfully!</span>
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="Your full name" 
                    className="w-full"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email-request" className="text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <Input
                    id="email-request"
                    type="email"
                    placeholder="name@company.com"
                    className="w-full"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 py-2 text-white font-medium rounded-md"
                >
                  Request Access
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <a href="#" className="text-purple-600 hover:underline font-medium" onClick={handleFlip}>
                  Sign in
                </a>
              </p>
            </CardFooter>
          </Card>
        </div>
      </ReactCardFlip>
    </div>
  );
};

export default LoginCard;