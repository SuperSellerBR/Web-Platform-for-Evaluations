import React from 'react';
import { Question, Section } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { ArrowRight, Split, Map, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface LogicEditorProps {
  questions: Question[];
  sections: Section[];
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
}

export function LogicEditor({ questions, sections, onUpdateQuestion }: LogicEditorProps) {
  // Helper to get destination name
  const getDestinationName = (sectionId: string) => {
    if (sectionId === 'end') return 'Fim do Questionário';
    const section = sections.find(s => s.id === sectionId);
    return section ? section.name : 'Desconhecido';
  };

  const handleLogicChange = (questionId: string, option: string, destinationId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    const currentLogic = question.logic || [];
    const otherRules = currentLogic.filter(r => r.triggerOption !== option);
    
    // If destination is "default" (next page), we remove the rule to save space
    // Assuming empty or 'next' means default flow
    if (destinationId === 'next') {
        onUpdateQuestion(questionId, { logic: otherRules });
        return;
    }

    const newLogic = [...otherRules, { triggerOption: option, destinationSectionId: destinationId }];
    onUpdateQuestion(questionId, { logic: newLogic });
  };

  // Only some question types support branching logic
  const supportsLogic = (type: string) => {
    return ['multiple-choice', 'dropdown', 'nps', 'rating'].includes(type);
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 pb-32">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Split className="w-6 h-6 text-[#2C5F66]" />
          Lógica de Ramificação
        </h2>
        <p className="text-gray-500 mt-2">
          Defina para onde os respondentes devem ir com base em suas respostas.
        </p>
      </div>

      <div className="space-y-12">
        {sections.map((section, sectionIndex) => {
          const sectionQuestions = questions.filter(q => q.sectionId === section.id);
          
          return (
            <div key={section.id} className="relative">
              {/* Section Header */}
              <div className="flex items-center gap-4 mb-6 sticky top-0 bg-gray-50 py-4 z-10">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-300 font-bold text-gray-500 text-sm">
                  {sectionIndex + 1}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-6 pl-12">
                {sectionQuestions.length === 0 && (
                  <div className="text-sm text-gray-400 italic">Esta página não possui perguntas.</div>
                )}

                {sectionQuestions.map((question) => {
                  if (!supportsLogic(question.type)) return null;

                  return (
                    <Card key={question.id} className="border-l-4 border-l-[#2C5F66] shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Map className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">{question.title}</span>
                          </div>
                          <Badge variant="outline" className="bg-gray-50">
                            {question.type === 'nps' ? 'NPS' : 
                             question.type === 'rating' ? 'Avaliação' : 
                             'Seleção'}
                          </Badge>
                        </div>

                        <div className="grid gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                          {/* Generate options based on type */}
                          {(() => {
                            let options: string[] = [];
                            
                            if (question.options) {
                              options = question.options;
                            } else if (question.type === 'nps') {
                              options = ['Detratores (0-6)', 'Neutros (7-8)', 'Promotores (9-10)'];
                            } else if (question.type === 'rating') {
                              // Simplify rating logic to Low/High or specific numbers? 
                              // For simplicity, let's just show Min and Max for now, or maybe all numbers if range is small
                              const max = question.scale?.max || 5;
                              options = Array.from({ length: max }, (_, i) => (i + 1).toString());
                            }

                            return options.map((option) => {
                              const currentRule = question.logic?.find(r => r.triggerOption === option);
                              const currentDest = currentRule?.destinationSectionId || 'next';

                              return (
                                <div key={option} className="flex items-center gap-4">
                                  <div className="w-1/3 flex items-center gap-2 text-sm text-gray-700">
                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                    <span className="truncate" title={option}>
                                      {question.type === 'nps' ? option : `Se responder "${option}"`}
                                    </span>
                                  </div>
                                  
                                  <ArrowRight className="w-4 h-4 text-gray-300" />

                                  <div className="flex-1">
                                    <Select
                                      value={currentDest}
                                      onValueChange={(val) => handleLogicChange(question.id, option, val)}
                                    >
                                      <SelectTrigger className={`h-9 ${currentDest !== 'next' ? 'border-[#2C5F66] bg-[#E8F4F5] text-[#2C5F66]' : ''}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="next">
                                          <span className="text-gray-500">Ir para a próxima página (Padrão)</span>
                                        </SelectItem>
                                        <SelectItem value="end" className="text-red-600 font-medium">
                                          Encerrar Questionário
                                        </SelectItem>
                                        
                                        {sections.map((s, idx) => {
                                          // Don't allow jumping to current or previous sections (basic loop prevention)
                                          // Logic: You can only jump forward
                                          if (idx <= sectionIndex) return null;
                                          
                                          return (
                                            <SelectItem key={s.id} value={s.id}>
                                              Pular para: {s.name}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
