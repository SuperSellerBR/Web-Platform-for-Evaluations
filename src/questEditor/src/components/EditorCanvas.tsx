import React, { useState } from 'react';
import { Plus, Upload, Copy, Trash2, FileQuestion } from 'lucide-react';
import { Button } from './ui/button';
import { QuestionCard } from './QuestionCard';
import { AddQuestionModal } from './AddQuestionModal';
import { ImportQuestionsDialog } from './ImportQuestionsDialog';
import { AddQuestionButton } from './AddQuestionButton';
import { QuestionTemplates } from './QuestionTemplates';
import { SectionNavigation } from './SectionNavigation';
import { Question } from '../types';

interface EditorCanvasProps {
  questions: Question[];
  sections: { id: string; name: string; questionIds: string[] }[];
  currentSectionId: string;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string | null) => void;
  onAddQuestion: (type: Question['type']) => void;
  onImportQuestions: (questions: Question[]) => void;
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => void;
  onDuplicateQuestion: (id: string) => void;
  onMoveQuestion: (id: string, direction: 'up' | 'down') => void;
  onChangeSection: (sectionId: string) => void;
  onAddSection: () => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (sections: { id: string; name: string; questionIds: string[] }[]) => void;
}

export function EditorCanvas({
  questions,
  sections,
  currentSectionId,
  selectedQuestionId,
  onSelectQuestion,
  onAddQuestion,
  onImportQuestions,
  onUpdateQuestion,
  onDeleteQuestion,
  onDuplicateQuestion,
  onMoveQuestion,
  onChangeSection,
  onAddSection,
  onRenameSection,
  onDuplicateSection,
  onDeleteSection,
  onReorderSections,
}: EditorCanvasProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Filter questions for current section
  const currentSectionQuestions = questions.filter(
    q => q.sectionId === currentSectionId
  );

  const handleAddQuestion = (type: Question['type']) => {
    onAddQuestion(type);
  };

  const handleImportQuestions = (importedQuestions: Question[]) => {
    onImportQuestions(importedQuestions);
  };

  return (
    <div className="relative">
      <SectionNavigation
        sections={sections}
        currentSectionId={currentSectionId}
        onChangeSection={onChangeSection}
        onAddSection={onAddSection}
        onRenameSection={onRenameSection}
        onDuplicateSection={onDuplicateSection}
        onDeleteSection={onDeleteSection}
        onReorderSections={onReorderSections}
      />

      <div className="max-w-4xl mx-auto px-4 py-4 md:px-8 md:py-8">
        <AddQuestionModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          onSelectType={handleAddQuestion}
        />
        
        <ImportQuestionsDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportQuestions}
        />

        {/* Editor Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="default"
            className="gap-2 bg-[#4CAF50] hover:bg-[#45a049] w-full sm:w-auto"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            Adicionar Pergunta
          </Button>

          <QuestionTemplates onSelectTemplate={handleImportQuestions} />

          <Button
            variant="outline"
            size="sm"
            className="gap-2 flex-1 sm:flex-none"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="w-4 h-4" />
            Importar
          </Button>

          {selectedQuestionId && (
            <>
              <div className="hidden sm:block w-px h-6 bg-gray-300" />
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1 sm:flex-none"
                  onClick={() => onDuplicateQuestion(selectedQuestionId)}
                >
                  <Copy className="w-4 h-4" />
                  Duplicar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
                  onClick={() => onDeleteQuestion(selectedQuestionId)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div>
        {currentSectionQuestions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-12 text-center">
            <FileQuestion className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhum item nesta página</h3>
            <p className="text-gray-500 mb-6">
              Comece adicionando uma pergunta ou página especial
            </p>
            <Button
              className="gap-2 bg-[#4CAF50] hover:bg-[#45a049]"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>
        ) : (
          <>
            {currentSectionQuestions.map((question, index) => (
              <React.Fragment key={question.id}>
                <div className="mb-4">
                  <QuestionCard
                    question={question}
                    index={index}
                    isSelected={selectedQuestionId === question.id}
                    onSelect={() => onSelectQuestion(question.id)}
                    onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
                    onDelete={() => onDeleteQuestion(question.id)}
                    onDuplicate={() => onDuplicateQuestion(question.id)}
                    onMove={(direction) => onMoveQuestion(question.id, direction)}
                    canMoveUp={index > 0}
                    canMoveDown={index < currentSectionQuestions.length - 1}
                  />
                </div>
                {index < currentSectionQuestions.length - 1 && (
                  <AddQuestionButton onAdd={() => setShowAddModal(true)} />
                )}
              </React.Fragment>
            ))}
            
            {/* Add button at the end */}
            <div className="mt-6">
              <AddQuestionButton onAdd={() => setShowAddModal(true)} />
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
