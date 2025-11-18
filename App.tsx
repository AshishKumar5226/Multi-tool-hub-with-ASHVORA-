import React, { useState, useEffect } from 'react';
import { TOOLS } from './constants';
import type { Tool } from './types';
import ToolCard from './components/ToolCard';
import ToolModal from './components/ToolModal';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('opacity-0', 'translate-y-5');
            entry.target.classList.add('opacity-100', 'translate-y-0');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1, // Start animation when 10% of the card is visible
      }
    );

    // Query for all cards after the component mounts
    const targets = document.querySelectorAll('.tool-card');
    targets.forEach((target) => observer.observe(target));

    // Cleanup observer on component unmount
    return () => {
      targets.forEach((target) => observer.unobserve(target));
    };
  }, []);


  const openTool = (tool: Tool) => {
    setActiveTool(tool);
  };

  const closeTool = () => {
    setActiveTool(null);
  };

  const filteredTools = TOOLS.filter(tool =>
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#1E1E2F] text-[#EAEAEA] font-sans">
      <header className="bg-[#2B2D42] py-6 shadow-lg">
        <h1 className="text-4xl md:text-5xl font-bold text-center text-[#FFD700]">
          Multi Tool Hub
        </h1>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-10 max-w-xl mx-auto">
           <input
            type="text"
            placeholder="Search for a tool (e.g., 'image', 'password', 'calculator')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-lg p-4 text-center focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-all duration-300"
            aria-label="Search for a tool"
          />
        </div>
        
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onClick={() => openTool(tool)} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-8">
            <h2 className="text-2xl font-bold">No Tools Found</h2>
            <p>Your search for "{searchQuery}" did not match any tools.</p>
          </div>
        )}
      </main>

      {activeTool && <ToolModal tool={activeTool} onClose={closeTool} />}
    </div>
  );
};

export default App;