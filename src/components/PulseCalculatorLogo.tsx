import React from 'react';

interface PulseCalculatorLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PulseCalculatorLogo({ size = 'md', className = '' }: PulseCalculatorLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} relative flex items-center justify-center`}>
      {/* Calculator Base */}
      <svg
        viewBox="0 0 48 48"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Calculator Body */}
        <rect
          x="10"
          y="18"
          width="28"
          height="24"
          rx="3"
          fill="currentColor"
          className="text-green-800"
          opacity="0.9"
        />
        
        {/* Calculator Screen */}
        <rect
          x="13"
          y="21"
          width="22"
          height="5"
          rx="1"
          fill="currentColor"
          className="text-green-100"
        />
        
        {/* Calculator Buttons Grid */}
        <g className="text-green-100" opacity="0.8">
          <circle cx="17" cy="30" r="1.2" fill="currentColor" />
          <circle cx="24" cy="30" r="1.2" fill="currentColor" />
          <circle cx="31" cy="30" r="1.2" fill="currentColor" />
          <circle cx="17" cy="35" r="1.2" fill="currentColor" />
          <circle cx="24" cy="35" r="1.2" fill="currentColor" />
          <circle cx="31" cy="35" r="1.2" fill="currentColor" />
        </g>
        
        {/* Pulse/Heartbeat Line - Main Feature */}
        <g className="pulse-line">
          <path
            d="M2 12 L8 12 L12 8 L16 16 L20 4 L24 14 L28 10 L32 12 L36 8 L40 12 L46 12"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-400"
            style={{
              filter: 'drop-shadow(0 0 3px currentColor)',
            }}
          />
          
          {/* Animated pulse dots */}
          <circle 
            cx="12" 
            cy="8" 
            r="1.5" 
            fill="currentColor" 
            className="text-green-300 animate-pulse" 
          />
          <circle 
            cx="20" 
            cy="4" 
            r="1.5" 
            fill="currentColor" 
            className="text-green-300 animate-pulse" 
            style={{ animationDelay: '0.3s' }} 
          />
          <circle 
            cx="36" 
            cy="8" 
            r="1.5" 
            fill="currentColor" 
            className="text-green-300 animate-pulse" 
            style={{ animationDelay: '0.6s' }} 
          />
        </g>
        
        {/* Subtle gradient overlay for depth */}
        <defs>
          <linearGradient id="calculatorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <rect
          x="10"
          y="18"
          width="28"
          height="24"
          rx="3"
          fill="url(#calculatorGradient)"
          className="text-white"
        />
      </svg>
      
      {/* CSS for enhanced animations */}
      <style jsx>{`
        .pulse-line {
          animation: pulse-glow 2.5s ease-in-out infinite;
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            transform: scaleY(1);
          }
          50% {
            opacity: 0.8;
            transform: scaleY(1.05);
          }
        }
        
        .pulse-line path {
          animation: pulse-flow 3s ease-in-out infinite;
        }
        
        @keyframes pulse-flow {
          0%, 100% {
            stroke-dasharray: 0, 100;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 20, 10;
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </div>
  );
}