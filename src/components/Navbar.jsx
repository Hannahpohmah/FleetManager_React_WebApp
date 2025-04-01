// components/Navbar.jsx
// components/Navbar.jsx
import React from 'react';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  return (
    <nav className="bg-gray-800 shadow-sm py-4 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Truck size={22} />
          </div>
          <span className="text-xl font-bold text-white">
            FleetControl
          </span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#" className="text-gray-300 hover:text-blue-400 transition">Solutions</a>
          <a href="#" className="text-gray-300 hover:text-blue-400 transition">Features</a>
          <a href="#" className="text-gray-300 hover:text-blue-400 transition">Pricing</a>
          <a href="#" className="text-gray-300 hover:text-blue-400 transition">Support</a>
        </div>
        
        <div className="hidden md:block">
          <Button 
            variant="outline" 
            className="mr-2 border-gray-500 text-gray-300 hover:border-blue-400 hover:text-blue-400"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
