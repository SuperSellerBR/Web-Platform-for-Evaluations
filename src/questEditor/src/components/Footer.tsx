import React from 'react';
import { Play } from 'lucide-react';
import { Button } from './ui/button';

interface FooterProps {
  totalQuestions: number;
  onTestClick: () => void;
}

export function Footer({ totalQuestions, onTestClick }: FooterProps) {
  const progress = totalQuestions > 0 ? 100 : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40 shadow-sm md:pl-64 lg:pr-80 transition-all duration-300">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              Progresso do questionário:
            </span>
             <span className="text-sm text-gray-600 sm:hidden">
              Progresso:
            </span>
            <div className="w-24 sm:w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4CAF50] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-900 whitespace-nowrap">
              {totalQuestions} {totalQuestions === 1 ? 'item' : 'itens'}
            </span>
          </div>
        </div>

        <div>
          <Button variant="outline" size="sm" className="gap-2" onClick={onTestClick}>
            <Play className="w-4 h-4" />
            <span className="hidden sm:inline">Testar Questionário</span>
            <span className="sm:hidden">Testar</span>
          </Button>
        </div>
      </div>
    </footer>
  );
}
