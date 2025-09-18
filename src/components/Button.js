import React from 'react';

const Button = ({ children, onClick, className = '' }) => {
  return (
    <button
      className={`bg-blue-500 hover:bg-blue-700 text-white text-body-1 font-medium py-2 px-4 rounded ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
