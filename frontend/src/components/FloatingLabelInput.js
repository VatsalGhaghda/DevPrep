import { useState } from 'react';
import { motion } from 'framer-motion';

const FloatingLabelInput = ({ 
  id, 
  type = 'text', 
  label, 
  value, 
  onChange, 
  error,
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value && value.length > 0;

  return (
    <div className="relative mb-6" data-testid={`input-wrapper-${id}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`
          w-full px-4 py-3.5 bg-white/5 border rounded-lg
          text-white placeholder-transparent
          focus:outline-none focus:ring-0
          transition-all duration-300
          ${error 
            ? 'border-red-500 focus:border-red-400' 
            : isFocused 
              ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
              : 'border-white/10 hover:border-white/20'
          }
        `}
        placeholder={label}
        data-testid={`input-${id}`}
        {...props}
      />
      
      <motion.label
        htmlFor={id}
        className={`
          absolute left-4 pointer-events-none
          transition-all duration-300
          ${isFocused || hasValue 
            ? '-top-2.5 text-xs bg-[#030712] px-2' 
            : 'top-3.5 text-base'
          }
          ${error 
            ? 'text-red-400' 
            : isFocused 
              ? 'text-cyan-400' 
              : 'text-slate-400'
          }
        `}
        initial={false}
        animate={{
          y: isFocused || hasValue ? 0 : 0,
          scale: isFocused || hasValue ? 0.85 : 1
        }}
      >
        {label}
      </motion.label>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-xs mt-1.5 ml-1"
          data-testid={`error-${id}`}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
};

export default FloatingLabelInput;
