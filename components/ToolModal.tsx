
import React from 'react';
import type { Tool } from '../types';

interface ToolModalProps {
  tool: Tool;
  onClose: () => void;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const ToolModal: React.FC<ToolModalProps> = ({ tool, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#2B2D42] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-[#3A3D5B]">
          <h2 className="text-2xl font-bold text-[#FFD700]">{tool.title}</h2>
          <button 
            onClick={onClose} 
            className="text-[#EAEAEA] hover:text-[#FFD700] transition-colors"
            aria-label="Close tool modal"
          >
            <CloseIcon className="w-8 h-8"/>
          </button>
        </header>
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 w-full flex justify-center">
            <iframe
                src="https://www.effectivegatecpm.com/iyh7ephs?key=085d46adce73ee8eb48c00e936c2f0e5"
                width="728"
                height="90"
                scrolling="no"
                frameBorder="0"
                className="max-w-full"
                style={{ border: 'none', overflow: 'hidden' }}
                aria-label="Advertisement"
            ></iframe>
          </div>
          <tool.component />
        </div>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ToolModal;