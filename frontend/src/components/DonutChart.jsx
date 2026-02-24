import React from 'react';

export function DonutChart({ percentage, isDarkMode }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-[100px] h-[100px]">
        <svg width="100" height="100" viewBox="0 0 100 100" className="transform -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke={isDarkMode ? "#1a1a1a" : "#f3f4f6"} strokeWidth="10" />
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke={percentage > 70 ? "#10b981" : (percentage > 40 ? "#f59e0b" : "#ef4444")} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center font-black text-xl ${isDarkMode ? 'text-white' : 'text-black'}`}>{percentage}%</div>
      </div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Uso Material</p>
    </div>
  );
}
