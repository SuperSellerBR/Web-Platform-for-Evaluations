import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddQuestionButtonProps {
  onAdd: () => void;
}

export function AddQuestionButton({ onAdd }: AddQuestionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group my-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Divider line */}
      <div className="absolute inset-0 flex items-center">
        <div
          className={`w-full border-t-2 transition-colors duration-200 ${
            isHovered ? 'border-[#4CAF50]' : 'border-transparent'
          }`}
        />
      </div>

      {/* Add button */}
      <div className="relative flex justify-center">
        <button
          onClick={onAdd}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full
            bg-white border-2 shadow-sm
            transition-all duration-200
            ${
              isHovered
                ? 'border-[#4CAF50] text-[#4CAF50] scale-105 shadow-md'
                : 'border-gray-300 text-gray-400 scale-90 opacity-0 group-hover:opacity-100'
            }
          `}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Adicionar Pergunta</span>
        </button>
      </div>
    </div>
  );
}
