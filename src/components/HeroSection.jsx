// components/HeroSection.jsx
import React from 'react';
import { MapPin, Shield, BarChart, Clock } from 'lucide-react';
import FeatureItem from './FeatureItem';

const HeroSection = () => {
  const features = [
    {
      icon: MapPin,
      title: "Smart Routing",
      description: "Optimize delivery paths automatically",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      icon: Shield,
      title: "Enhanced Security",
      description: "Full vehicle monitoring & alerts",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      icon: BarChart,
      title: "Inventory Allocation",
      description: "Dynamic inventory allocation",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      icon: Clock,
      title: "Real-time Updates",
      description: "Live tracking & status reports",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    }
  ];

  return (
    <div className="flex flex-col max-w-lg">
      <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
        Intelligent Fleet Management for the Modern Enterprise
      </h1>
      
      <p className="text-lg text-white mb-8">
        Take control of your delivery operations with AI-powered route optimization, 
        real-time tracking, and smart inventory allocation. Reduce costs by up to 30% while 
        improving customer satisfaction.
      </p>
      
      {/* Feature Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {features.map((feature, index) => (
          <FeatureItem 
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            iconBg={feature.iconBg}
            iconColor={feature.iconColor}
          />
        ))}
      </div>
      
      {/* Trust Indicators */}
      <div className="mt-2">
        <p className="text-sm text-white mb-3">Trusted by industry leaders</p>
        <div className="flex space-x-6">
          <div className="w-24 h-6 bg-gray-700 rounded animate-pulse"></div>
          <div className="w-24 h-6 bg-gray-700 rounded animate-pulse"></div>
          <div className="w-24 h-6 bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

