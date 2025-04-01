import React from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import LoginCard from './components/LoginCard';
import Footer from './components/Footer';

const FleetManagerLanding = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col text-xl">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute right-0 top-0 w-1/3 h-1/3 bg-blue-100 rounded-bl-full opacity-50"></div>
          <div className="absolute left-0 bottom-0 w-1/4 h-1/4 bg-blue-50 rounded-tr-full"></div>
          <div className="absolute right-1/4 bottom-1/4 w-16 h-16 bg-blue-200 rounded-full opacity-20"></div>
          <div className="absolute left-1/3 top-1/4 w-24 h-24 bg-blue-200 rounded-full opacity-20"></div>
        </div>
        
        <div className="max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
          <HeroSection />
          <LoginCard />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default FleetManagerLanding;


