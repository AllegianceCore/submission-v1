import React from 'react';

export function BoltBadge() {
  const handleClick = () => {
    window.open('https://bolt.new', '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Made with Bolt.New – Click to learn more"
      className="fixed top-4 right-4 z-50 group"
    >
      <div className="relative w-28 h-28 bg-black rounded-full flex items-center justify-center hover:scale-110 transition-all duration-300 hover:shadow-xl hover:shadow-black/25">
        {/* Circular text around the badge */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin-slow"
          style={{ animation: 'spin 20s linear infinite' }}
        >
          <defs>
            <path
              id="circle-path"
              d="M 56, 56 m -45, 0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0"
            />
          </defs>
          <text className="fill-white text-[10px] font-bold tracking-wider">
            <textPath href="#circle-path" startOffset="0%">
              MADE IN BOLT.NEW • POWERED BY BOLT.NEW • 
            </textPath>
          </text>
        </svg>
        
        {/* Center "b" letter */}
        <div className="relative z-10 bg-white rounded-full w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <span className="text-black font-bold text-2xl leading-none">b</span>
        </div>
        
        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm scale-110"></div>
      </div>
      
      {/* Tooltip */}
      <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-black text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
        Made with Bolt.New
        <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-black"></div>
      </div>
    </button>
  );
}