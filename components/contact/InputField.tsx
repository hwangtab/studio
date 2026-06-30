import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  label: string;
  id: string;
  error?: string;
}

const InputField = ({ icon: Icon, label, id, error, ...props }: InputFieldProps) => (
  <div className="relative mb-4">
    <label htmlFor={id} className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      </div>
      <input
        id={id}
        aria-required={props.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full pl-10 pr-3 py-2 border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent`}
        {...props}
      />
    </div>
    {error && <span id={`${id}-error`} role="alert" className="text-xs text-red-600 mt-1 pl-10 block">{error}</span>}
  </div>
);

export default InputField;
