
import React from 'react';
import type { Tool } from '../types';

interface ToolCardProps {
  tool: Tool;
  onClick: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => {
  return (
    <div className="tool-card group bg-[#3A3D5B] rounded-lg p-6 shadow-lg transition-all duration-500 ease-out hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] hover:bg-[#FFD700] hover:text-[#1E1E2F] cursor-pointer transform hover:-translate-y-2 hover:scale-105 opacity-0 translate-y-5">
      <h2 className="text-2xl font-bold mb-2">{tool.title}</h2>
      <p className="text-gray-300 group-hover:text-[#2B2D42] mb-4">{tool.description}</p>
      <button
        onClick={onClick}
        className="w-full bg-[#2B2D42] text-[#FFD700] font-bold py-2 px-4 rounded transition-colors duration-300 group-hover:bg-[#E6C200] group-hover:text-[#1E1E2F]"
      >
        Open Tool
      </button>
    </div>
  );
};

export default ToolCard;
