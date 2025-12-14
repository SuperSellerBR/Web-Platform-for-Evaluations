import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Section } from '../types';
import { SectionManagementDialog } from './SectionManagementDialog';

interface SectionNavigationProps {
  sections: Section[];
  currentSectionId: string;
  onChangeSection: (sectionId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (sections: Section[]) => void;
}

export function SectionNavigation({
  sections,
  currentSectionId,
  onChangeSection,
  onAddSection,
  onRenameSection,
  onDuplicateSection,
  onDeleteSection,
  onReorderSections,
}: SectionNavigationProps) {
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const currentIndex = sections.findIndex(s => s.id === currentSectionId);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < sections.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onChangeSection(sections[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onChangeSection(sections[currentIndex + 1].id);
    }
  };

  return (
    <>
      <SectionManagementDialog
        open={showManagementDialog}
        onOpenChange={setShowManagementDialog}
        sections={sections}
        onRenameSection={onRenameSection}
        onDuplicateSection={onDuplicateSection}
        onDeleteSection={onDeleteSection}
        onReorderSections={onReorderSections}
      />

      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 md:px-8 md:py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Mobile: Top row with Controls and Management */}
          <div className="flex items-center justify-between w-full md:w-auto gap-2 order-2 md:order-1">
             <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              className="h-9 px-2 md:px-4"
            >
              <ChevronLeft className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Anterior</span>
            </Button>

            {/* Desktop: Page Buttons in center */}
            <div className="hidden md:flex items-center gap-2 px-4 overflow-x-auto max-w-[400px] no-scrollbar">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => onChangeSection(section.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all whitespace-nowrap ${
                    section.id === currentSectionId
                      ? 'bg-[#2C5F66] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {section.name}
                </button>
              ))}
            </div>

            {/* Mobile: Current Page Indicator (Simple) */}
             <div className="md:hidden flex items-center justify-center font-medium text-sm text-gray-900">
               {sections[currentIndex].name}
             </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!canGoNext}
              className="h-9 px-2 md:px-4"
            >
              <span className="hidden md:inline">Próxima</span>
              <ChevronRight className="w-4 h-4 md:ml-1" />
            </Button>
          </div>

          {/* Right Side: Management Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end order-1 md:order-2 border-b md:border-b-0 pb-2 md:pb-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManagementDialog(true)}
              className="h-9 flex-1 md:flex-none justify-center"
            >
              <Settings className="w-4 h-4 mr-1" />
              <span className="md:hidden lg:inline">Gerenciar</span>
              <span className="hidden md:inline lg:hidden">Gerenciar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddSection}
              className="h-9 flex-1 md:flex-none justify-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="md:hidden lg:inline">Nova Página</span>
               <span className="hidden md:inline lg:hidden">Nova</span>
            </Button>
          </div>
        </div>

        {/* Mobile: Page Dots/Indicator below if needed, currently using text in center */}
        
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {currentIndex + 1} de {sections.length}
          </span>
          <span>
            {sections.find(s => s.id === currentSectionId)?.questionIds.length || 0} {' '}
            {sections.find(s => s.id === currentSectionId)?.questionIds.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
      </div>
    </>
  );
}
