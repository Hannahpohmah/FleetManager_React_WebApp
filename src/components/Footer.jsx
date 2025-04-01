// components/Footer.jsx
import React from 'react';
import { Truck } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 py-6">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center space-x-1 mb-4 md:mb-0">
          <div className="bg-purple-600 text-white p-1 rounded">
            <Truck size={16} />
          </div>
          <span className="text-sm font-semibold text-white">FleetControl</span>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()}</span>
        </div>
        
        <div className="flex space-x-6 text-sm">
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Cookies</a>
          <a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
