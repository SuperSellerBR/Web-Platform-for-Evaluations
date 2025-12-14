import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { SurveyEditor } from './components/SurveyEditor';
import { Survey, Question, Section, Theme } from './types';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

// Default Data for New Surveys
const defaultTheme: Theme = {
  primaryColor: '#2C5F66',
  backgroundColor: '#F3F3F5',
  textColor: '#111827',
  fontFamily: 'Inter, sans-serif',
  borderRadius: '0.5rem',
};

const defaultQuestions: Question[] = [
  {
    id: '1',
    type: 'multiple-choice',
    title: 'Qual é o seu nível de satisfação com nosso produto?',
    description: 'Selecione a opção que melhor representa sua experiência',
    required: true,
    options: ['Muito satisfeito', 'Satisfeito', 'Neutro', 'Insatisfeito', 'Muito insatisfeito'],
    randomize: false,
    sectionId: 'section-1',
  },
  {
    id: '2',
    type: 'text',
    title: 'O que podemos melhorar?',
    description: 'Compartilhe suas sugestões conosco',
    required: false,
    charLimit: 500,
    sectionId: 'section-1',
  },
  {
    id: '3',
    type: 'rating',
    title: 'Como você avalia nosso atendimento?',
    description: '',
    required: true,
    scale: { min: 1, max: 5, minLabel: 'Ruim', maxLabel: 'Excelente' },
    sectionId: 'section-2',
  },
];

const defaultSections: Section[] = [
  { id: 'section-1', name: 'Página 1', questionIds: ['1', '2'] },
  { id: 'section-2', name: 'Página 2', questionIds: ['3'] },
];

export default function App() {
  const [surveys, setSurveys] = useState<Survey[]>([
    {
      id: '1',
      title: 'Pesquisa de Satisfação do Cliente',
      status: 'published',
      createdAt: new Date('2023-11-15').toISOString(),
      updatedAt: new Date('2023-11-20').toISOString(),
      responseCount: 124,
      questions: defaultQuestions,
      sections: defaultSections,
      theme: defaultTheme,
    },
    {
      id: '2',
      title: 'Feedback do Evento Anual',
      status: 'draft',
      createdAt: new Date('2023-11-25').toISOString(),
      updatedAt: new Date('2023-11-25').toISOString(),
      responseCount: 0,
      questions: [],
      sections: [{ id: 's1', name: 'Início', questionIds: [] }],
      theme: defaultTheme,
    }
  ]);
  
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);

  const handleCreateSurvey = () => {
    const newSurvey: Survey = {
      id: Date.now().toString(),
      title: 'Novo Questionário',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: 0,
      questions: defaultQuestions.map(q => ({ ...q, id: `q-${Date.now()}-${q.id}` })), // Clone defaults with new IDs
      sections: defaultSections.map(s => ({ ...s, questionIds: s.questionIds.map(qid => `q-${Date.now()}-${qid}`) })), // Fix IDs logic simplified
      theme: { ...defaultTheme },
    };
    
    // Fix the ID mapping properly (simple clone often breaks references)
    // For simplicity, let's just use the exact default objects but with new IDs for questions
    // A better way is just creating a truly blank one or a template function.
    // Let's create a blank one to avoid ID collision logic complexity here.
    
    const blankSurvey: Survey = {
      id: Date.now().toString(),
      title: 'Novo Questionário',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: 0,
      questions: [
        {
          id: `q-${Date.now()}`,
          type: 'multiple-choice',
          title: 'Pergunta sem título',
          description: '',
          required: false,
          options: ['Opção 1'],
          sectionId: `s-${Date.now()}`
        }
      ],
      sections: [{ id: `s-${Date.now()}`, name: 'Página 1', questionIds: [`q-${Date.now()}`] }],
      theme: { ...defaultTheme },
    };

    setSurveys([blankSurvey, ...surveys]);
    setEditingSurveyId(blankSurvey.id);
    toast.success('Questionário criado!');
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurveyId(survey.id);
  };

  const handleDeleteSurvey = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este questionário?')) {
      setSurveys(surveys.filter(s => s.id !== id));
      toast.success('Questionário excluído');
    }
  };

  const handleDuplicateSurvey = (survey: Survey) => {
    const newSurvey: Survey = {
      ...survey,
      id: Date.now().toString(),
      title: `${survey.title} (Cópia)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responseCount: 0,
    };
    setSurveys([newSurvey, ...surveys]);
    toast.success('Questionário duplicado!');
  };

  const handleUpdateSurvey = (updatedSurvey: Survey) => {
    setSurveys(surveys.map(s => s.id === updatedSurvey.id ? updatedSurvey : s));
  };

  const currentSurvey = surveys.find(s => s.id === editingSurveyId);

  if (editingSurveyId && currentSurvey) {
    return (
      <SurveyEditor 
        key={currentSurvey.id} // Important to reset state when switching surveys
        survey={currentSurvey}
        onBack={() => setEditingSurveyId(null)}
        onUpdate={handleUpdateSurvey}
      />
    );
  }

  return (
    <>
      <Dashboard 
        surveys={surveys}
        onCreateSurvey={handleCreateSurvey}
        onEditSurvey={handleEditSurvey}
        onDeleteSurvey={handleDeleteSurvey}
        onDuplicateSurvey={handleDuplicateSurvey}
      />
      <Toaster position="bottom-right" />
    </>
  );
}
