import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Section } from '../types';
import { GripVertical, Pencil, Copy, Trash2 } from 'lucide-react';

interface SectionManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Section[];
  onRenameSection: (sectionId: string, newName: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (sections: Section[]) => void;
}

export function SectionManagementDialog({
  open,
  onOpenChange,
  sections,
  onRenameSection,
  onDuplicateSection,
  onDeleteSection,
  onReorderSections,
}: SectionManagementDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [localSections, setLocalSections] = useState<Section[]>(sections);

  React.useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditingName(section.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameSection(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...localSections];
    if (direction === 'up' && index > 0) {
      [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    }
    setLocalSections(newSections);
    onReorderSections(newSections);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Páginas</DialogTitle>
          <DialogDescription>
            Renomeie, reorganize, duplique ou exclua páginas do questionário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {localSections.map((section, index) => (
            <div
              key={section.id}
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="h-6 w-6 p-0"
                >
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </Button>
              </div>

              <div className="flex-1">
                {editingId === section.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="h-8"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveEdit}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-900">{section.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({section.questionIds.length} {section.questionIds.length === 1 ? 'item' : 'itens'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {editingId !== section.id && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(section)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicateSection(section.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSection(section.id)}
                    disabled={localSections.length === 1}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
