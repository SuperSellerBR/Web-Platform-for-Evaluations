import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { EditorCanvas } from './EditorCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { Footer } from './Footer';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner@2.0.3';
import { SurveyPreviewModal } from './SurveyPreviewModal';
import { LogicEditor } from './LogicEditor';
import { AppearanceEditor } from './AppearanceEditor';
import { Question, Section, ActivePage, Survey, Theme } from '../types';

interface SurveyEditorProps {
  survey: Survey;
  onBack: () => void;
  onUpdate: (survey: Survey) => void;
}

export function SurveyEditor({ survey, onBack, onUpdate }: SurveyEditorProps) {
  const [activePage, setActivePage] = useState<ActivePage>('questions');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  // Initialize state from survey prop
  const [questions, setQuestions] = useState<Question[]>(survey.questions);
  const [sections, setSections] = useState<Section[]>(survey.sections);
  const [theme, setTheme] = useState<Theme>(survey.theme);
  const [surveyTitle, setSurveyTitle] = useState(survey.title);
  
  const [currentSectionId, setCurrentSectionId] = useState<string>(survey.sections[0]?.id || 'section-1');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync updates back to parent
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    const updatedSurvey: Survey = {
      ...survey,
      title: surveyTitle,
      questions,
      sections,
      theme,
      updatedAt: new Date().toISOString()
    };
    
    // Use a debounce or just update? 
    // For now, direct update. Parent should handle performance if needed.
    onUpdate(updatedSurvey);
  }, [questions, sections, theme, surveyTitle]);

  const addQuestion = (type: Question['type']) => {
    const questionDefaults: Record<Question['type'], Partial<Question>> = {
      'multiple-choice': {
        title: 'Qual opção melhor descreve sua resposta?',
        description: 'Selecione apenas uma opção',
        options: ['Opção 1', 'Opção 2', 'Opção 3', 'Outra'],
      },
      'checkbox': {
        title: 'Selecione todas as opções que se aplicam',
        description: 'Você pode escolher mais de uma opção',
        options: ['Opção 1', 'Opção 2', 'Opção 3', 'Nenhuma das anteriores'],
      },
      'dropdown': {
        title: 'Selecione uma opção',
        description: '',
        options: ['Opção 1', 'Opção 2', 'Opção 3'],
      },
      'text': {
        title: 'Descreva sua resposta',
        description: 'Por favor, seja o mais específico possível',
        charLimit: 500,
      },
      'rating': {
        title: 'Como você avalia este item?',
        description: 'Selecione uma classificação de 1 a 5',
        scale: { min: 1, max: 5, minLabel: 'Muito ruim', maxLabel: 'Excelente' },
      },
      'slider': {
        title: 'Selecione um valor na escala',
        description: '',
        scale: { min: 0, max: 10, minLabel: 'Mínimo', maxLabel: 'Máximo', step: 1 },
      },
      'rating-multi': {
        title: 'Avalie os atributos abaixo',
        description: '',
        items: ['Rapidez', 'Cortesia'],
        maxRating: 5,
      },
      'likert': {
        title: 'Indique seu nível de concordância',
        description: '',
        scale: { min: 1, max: 5, minLabel: 'Discordo totalmente', maxLabel: 'Concordo totalmente' },
      },
      'matrix': {
        title: 'Avalie cada item em cada categoria',
        description: '',
        matrixRows: ['Atendimento', 'Produto'],
        matrixCols: ['Ruim', 'Regular', 'Bom', 'Ótimo'],
      },
      'nps': {
        title: 'Qual a probabilidade de você recomendar nosso produto/serviço para um amigo ou colega?',
        description: 'Escolha uma nota de 0 a 10',
      },
      'intro-page': {
        title: 'Bem-vindo ao nosso questionário!',
        description: 'Agradecemos sua participação. Este questionário levará aproximadamente 5 minutos para ser concluído.',
        required: false,
      },
      'thank-you-page': {
        title: 'Obrigado por participar!',
        description: 'Sua opinião é muito importante para nós. Agradecemos seu tempo e suas respostas.',
        required: false,
      },
    };

    if (type === 'intro-page') {
      const newSectionId = `section-${Date.now()}`;
      const newQuestion: Question = {
        id: Date.now().toString(),
        type,
        required: false,
        randomize: false,
        sectionId: newSectionId,
        ...questionDefaults[type],
      } as Question;

      const newSection: Section = {
        id: newSectionId,
        name: 'Introdução',
        questionIds: [newQuestion.id],
      };

      setQuestions([...questions, newQuestion]);
      setSections([newSection, ...sections]);
      setCurrentSectionId(newSectionId);
      setSelectedQuestionId(newQuestion.id);
      toast.success('Página de introdução adicionada!');
      return;
    }

    if (type === 'thank-you-page') {
      const newSectionId = `section-${Date.now()}`;
      const newQuestion: Question = {
        id: Date.now().toString(),
        type,
        required: false,
        randomize: false,
        sectionId: newSectionId,
        ...questionDefaults[type],
      } as Question;

      const newSection: Section = {
        id: newSectionId,
        name: 'Agradecimento',
        questionIds: [newQuestion.id],
      };

      setQuestions([...questions, newQuestion]);
      setSections([...sections, newSection]);
      setCurrentSectionId(newSectionId);
      setSelectedQuestionId(newQuestion.id);
      toast.success('Página de agradecimento adicionada!');
      
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
      return;
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
      type,
      required: false,
      randomize: false,
      sectionId: currentSectionId,
      ...questionDefaults[type],
    } as Question;

    setQuestions([...questions, newQuestion]);
    setSelectedQuestionId(newQuestion.id);

    setSections(sections.map(s =>
      s.id === currentSectionId
        ? { ...s, questionIds: [...s.questionIds, newQuestion.id] }
        : s
    ));

    toast.success('Pergunta adicionada com sucesso!');

    setTimeout(() => {
      const questionElement = document.querySelector(`[data-question-id="${newQuestion.id}"]`);
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const importQuestions = (importedQuestions: Question[]) => {
    const questionsWithSection = importedQuestions.map(q => ({
      ...q,
      sectionId: currentSectionId,
    }));

    setQuestions([...questions, ...questionsWithSection]);
    
    setSections(sections.map(s => 
      s.id === currentSectionId
        ? { ...s, questionIds: [...s.questionIds, ...questionsWithSection.map(q => q.id)] }
        : s
    ));

    toast.success(`${importedQuestions.length} ${importedQuestions.length === 1 ? 'pergunta importada' : 'perguntas importadas'} com sucesso!`);
    
    if (questionsWithSection.length > 0) {
      setSelectedQuestionId(questionsWithSection[0].id);
      setTimeout(() => {
        const questionElement = document.querySelector(`[data-question-id="${questionsWithSection[0].id}"]`);
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    if (selectedQuestionId === id) {
      setSelectedQuestionId(null);
    }
    toast.success('Pergunta excluída');
  };

  const duplicateQuestion = (id: string) => {
    const question = questions.find(q => q.id === id);
    if (question) {
      const newQuestion = { ...question, id: Date.now().toString(), title: question.title + ' (cópia)' };
      const index = questions.findIndex(q => q.id === id);
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, newQuestion);
      setQuestions(newQuestions);
      setSelectedQuestionId(newQuestion.id);
      toast.success('Pergunta duplicada com sucesso!');
      
      setTimeout(() => {
        const questionElement = document.querySelector(`[data-question-id="${newQuestion.id}"]`);
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === id);
    if (direction === 'up' && index > 0) {
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
      setQuestions(newQuestions);
    } else if (direction === 'down' && index < questions.length - 1) {
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
      setQuestions(newQuestions);
    }
  };

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const handleKeyboardAddQuestion = () => {
    setShowAddQuestionModal(true);
  };

  const handleKeyboardDeleteQuestion = () => {
    if (selectedQuestionId) {
      deleteQuestion(selectedQuestionId);
    }
  };

  const handleKeyboardDuplicateQuestion = () => {
    if (selectedQuestionId) {
      duplicateQuestion(selectedQuestionId);
    }
  };

  const renameSection = (sectionId: string, newName: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, name: newName } : s
    ));
    toast.success('Página renomeada!');
  };

  const duplicateSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const newSectionId = `section-${Date.now()}`;
    const questionsToDuplicate = questions.filter(q => q.sectionId === sectionId);
    
    const duplicatedQuestions: Question[] = questionsToDuplicate.map(q => ({
      ...q,
      id: `${q.id}-copy-${Date.now()}-${Math.random()}`,
      sectionId: newSectionId,
    }));

    const newSection: Section = {
      id: newSectionId,
      name: `${section.name} (cópia)`,
      questionIds: duplicatedQuestions.map(q => q.id),
    };

    setSections([...sections, newSection]);
    setQuestions([...questions, ...duplicatedQuestions]);
    setCurrentSectionId(newSectionId);
    toast.success('Página duplicada com sucesso!');
  };

  const deleteSection = (sectionId: string) => {
    if (sections.length === 1) {
      toast.error('Não é possível excluir a última página');
      return;
    }

    setQuestions(questions.filter(q => q.sectionId !== sectionId));
    
    const newSections = sections.filter(s => s.id !== sectionId);
    setSections(newSections);
    
    if (currentSectionId === sectionId) {
      setCurrentSectionId(newSections[0].id);
    }
    
    toast.success('Página excluída!');
  };

  const reorderSections = (newSections: Section[]) => {
    setSections(newSections);
  };

  const handleTestClick = () => {
    setShowPreviewModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <KeyboardShortcuts
        onAddQuestion={handleKeyboardAddQuestion}
        onDeleteQuestion={handleKeyboardDeleteQuestion}
        onDuplicateQuestion={handleKeyboardDuplicateQuestion}
        selectedQuestionId={selectedQuestionId}
      />
      
      <Header 
        surveyTitle={surveyTitle} 
        onTitleChange={setSurveyTitle} 
        onMenuClick={() => setSidebarOpen(true)}
        onBack={onBack}
      />
      
      <div className="flex flex-1 pt-16 pb-16">
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        <div
          className={`flex-1 md:ml-64 lg:mr-80 overflow-auto transition-all duration-300 ${
            selectedQuestion ? 'lg:pr-[440px]' : ''
          }`}
        >
          {activePage === 'questions' && (
            <EditorCanvas
              questions={questions}
              sections={sections}
              currentSectionId={currentSectionId}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={setSelectedQuestionId}
              onAddQuestion={addQuestion}
              onImportQuestions={importQuestions}
              onUpdateQuestion={updateQuestion}
              onDeleteQuestion={deleteQuestion}
              onDuplicateQuestion={duplicateQuestion}
              onMoveQuestion={moveQuestion}
              onChangeSection={setCurrentSectionId}
              onAddSection={() => {
                const newSection = {
                  id: `section-${Date.now()}`,
                  name: `Página ${sections.length + 1}`,
                  questionIds: [],
                };
                setSections([...sections, newSection]);
                setCurrentSectionId(newSection.id);
                toast.success('Nova página criada!');
              }}
              onRenameSection={renameSection}
              onDuplicateSection={duplicateSection}
              onDeleteSection={deleteSection}
              onReorderSections={reorderSections}
            />
          )}
          {activePage === 'logic' && (
            <LogicEditor 
              questions={questions}
              sections={sections}
              onUpdateQuestion={updateQuestion}
            />
          )}
          {activePage === 'appearance' && (
            <AppearanceEditor 
              theme={theme} 
              onChange={setTheme} 
            />
          )}
          {activePage !== 'questions' && activePage !== 'logic' && activePage !== 'appearance' && (
            <div className="max-w-4xl mx-auto px-8 py-12">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <h2 className="text-gray-900 mb-2">
                  {activePage === 'collect' && 'Métodos de Coleta'}
                  {activePage === 'settings' && 'Configurações do Questionário'}
                </h2>
                <p className="text-gray-500">
                  Esta funcionalidade estará disponível em breve.
                </p>
              </div>
            </div>
          )}
        </div>

        {activePage === 'questions' && selectedQuestion && (
          <PropertiesPanel
            question={selectedQuestion}
            onUpdateQuestion={updateQuestion}
            onClose={() => setSelectedQuestionId(null)}
          />
        )}
      </div>

      <Footer totalQuestions={questions.length} onTestClick={handleTestClick} />
      
      <SurveyPreviewModal 
        open={showPreviewModal} 
        onOpenChange={setShowPreviewModal}
        questions={questions}
        sections={sections}
        theme={theme}
      />
      
      <Toaster position="bottom-right" />
    </div>
  );
}
