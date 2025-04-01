// components/FeatureItem.jsx
import React from 'react';

const FeatureItem = ({
  icon: Icon,
  title,
  description,
  iconBg = "bg-purple-100",
  iconColor = "text-purple-600",
  titleColor = "text-white",
  descriptionColor = "text-white"
}) => {
  return (
    <div className="flex items-start space-x-3">
      <div className={`${iconBg} p-2 rounded-lg`}>
        <Icon className={`${iconColor}`} size={20} />
      </div>
      <div>
        <h3 className={`font-medium ${titleColor}`}>{title}</h3>
        <p className={`text-sm ${descriptionColor}`}>{description}</p>
      </div>
    </div>
  );
};

export default FeatureItem;
