import React from "react";

export const Card = ({ children }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200">
      {children}
    </div>
  );
}; 

export const CardContent = ({ children }) => {
  return <div className="p-4">{children}</div>;
};

export const CardHeader = ({ children }) => {
  return <div className="border-b p-2 text-xl font-bold">{children}</div>;
};

export const CardTitle = ({ children }) => {
  return <h2 className="text-xl font-semibold">{children}</h2>;
};

// Add the missing CardDescription component
export const CardDescription = ({ children }) => {
  return <p className="text-sm text-gray-500 mt-1">{children}</p>;
};

// Add the missing CardFooter component
export const CardFooter = ({ children }) => {
  return <div className="pt-4 border-t mt-4">{children}</div>;
};