import React, { useState, useRef, useEffect } from 'react';
import { Save, Send, HelpCircle, Edit2, Menu, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';
import { ShortcutsHelp } from './ShortcutsHelp';
import { Input } from './ui/input';

interface HeaderProps {
  surveyTitle: string;
  onTitleChange: (title: string) => void;
  onMenuClick: () => void;
  onBack?: () => void;
}

export function Header({ surveyTitle, onTitleChange, onMenuClick, onBack }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (!surveyTitle.trim()) {
      onTitleChange('Sem Título');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-sm">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
            <Menu className="w-5 h-5 text-gray-600" />
          </Button>

          {onBack && (
            <Button variant="ghost" size="icon" className="shrink-0 text-gray-500 hover:text-gray-900" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          
          {isEditing ? (
            <Input
              ref={inputRef}
              value={surveyTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="max-w-md text-lg font-semibold h-9 min-w-0"
            />
          ) : (
            <div 
              className="flex items-center gap-2 group cursor-pointer min-w-0" 
              onClick={() => setIsEditing(true)}
            >
              <h1 className="text-gray-900 text-lg md:text-xl font-semibold truncate" title={surveyTitle}>
                {surveyTitle}
              </h1>
              <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <ShortcutsHelp />
          
          <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
            <Save className="w-4 h-4" />
            Salvar
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden text-gray-600">
            <Save className="w-5 h-5" />
          </Button>

          <Button size="sm" className="gap-2 bg-[#2C5F66] hover:bg-[#1A4A4F] hidden sm:flex">
            <Send className="w-4 h-4" />
            Publicar
          </Button>
          <Button size="sm" className="bg-[#2C5F66] hover:bg-[#1A4A4F] sm:hidden p-2 h-9 w-9">
            <Send className="w-4 h-4" />
          </Button>

          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors hidden md:flex">
            <HelpCircle className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#2C5F66] flex items-center justify-center text-white shrink-0">
            <span className="text-xs md:text-sm">JD</span>
          </div>
        </div>
      </div>
    </header>
  );
}
