import React from 'react';
import { GripVertical, Copy, Trash2, ChevronUp, ChevronDown, Circle, Square, FileText, PartyPopper, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { Question } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface QuestionCardProps {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function QuestionCard({
  question,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
}: QuestionCardProps) {
  const questionTypeLabels: Record<Question['type'], string> = {
    'multiple-choice': 'Múltipla Escolha',
    'checkbox': 'Caixas de Seleção',
    'dropdown': 'Lista Suspensa',
    'text': 'Texto Livre',
    'rating': 'Avaliação',
    'rating-multi': 'Avaliação (multi-itens)',
    'slider': 'Barra deslizante',
    'likert': 'Escala Likert',
    'matrix': 'Matriz / Escala',
    'nps': 'NPS',
    'intro-page': 'Introdução',
    'thank-you-page': 'Agradecimento',
  };

  const handleOptionChange = (optionIndex: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[optionIndex] = value;
    onUpdate({ options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions = [...(question.options || []), `Opção ${(question.options?.length || 0) + 1}`];
    onUpdate({ options: newOptions });
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (question.options && question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      onUpdate({ options: newOptions });
    }
  };

  return (
    <motion.div
      data-question-id={question.id}
      onClick={onSelect}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
        isSelected ? 'border-[#2C5F66]' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 gap-3 sm:gap-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <GripVertical className="w-5 h-5 text-gray-400 cursor-move hidden sm:block" />
          <span className="text-sm text-gray-600 whitespace-nowrap">Pergunta {index + 1}</span>
          <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 whitespace-nowrap">
            {questionTypeLabels[question.type]}
          </span>
          {question.required && (
            <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs whitespace-nowrap">
              Obrigatória
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMove('up');
            }}
            disabled={!canMoveUp}
            className="h-8 w-8 p-0"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMove('down');
            }}
            disabled={!canMoveDown}
            className="h-8 w-8 p-0"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="h-8 w-8 p-0"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 md:p-6 space-y-4">
        {/* Question Title */}
        <div>
          <Input
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Digite sua pergunta aqui"
            className="text-base"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Question Description */}
        <div>
          <Input
            value={question.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Descrição opcional"
            className="text-sm text-gray-600"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Question Type Specific Content */}
        {(question.type === 'multiple-choice' || 
          question.type === 'checkbox' || 
          question.type === 'dropdown') && (
          <div className="space-y-2 mt-4">
            <label className="text-sm text-gray-600">Opções:</label>
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                {question.type === 'checkbox' ? (
                    <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                    <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Opção ${index + 1}`}
                  className="text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                {question.options && question.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveOption(index);
                    }}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAddOption();
              }}
              className="text-sm"
            >
              + Adicionar Opção
            </Button>
          </div>
        )}

        {question.type === 'text' && (
          <div className="mt-4">
            <Textarea
              placeholder="Resposta em texto livre..."
              disabled
              className="bg-gray-50"
              rows={3}
            />
            {question.charLimit && (
              <p className="text-xs text-gray-500 mt-2">
                Limite: {question.charLimit} caracteres
              </p>
            )}
            {question.validation?.type && question.validation.type !== 'text' && (
              <p className="text-xs text-[#2C5F66] mt-1">
                 Validação: {question.validation.type}
              </p>
            )}
          </div>
        )}

        {(question.type === 'rating' || question.type === 'likert') && question.scale && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {question.scale.minLabel || `Mínimo (${question.scale.min})`}
              </span>
              <span className="text-sm text-gray-600">
                {question.scale.maxLabel || `Máximo (${question.scale.max})`}
              </span>
            </div>
            <div className="flex gap-1 justify-center flex-wrap">
              {Array.from({ length: question.scale.max - question.scale.min + 1 }, (_, i) => {
                const val = question.scale!.min + i;
                return (
                  <Star
                    key={val}
                    className="w-6 h-6 text-yellow-400"
                    fill={val <= (question.scale!.min + 3) ? '#FACC15' : 'none'}
                  />
                );
              })}
            </div>
          </div>
        )}

        {question.type === 'nps' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Pouco provável</span>
              <span className="text-sm text-gray-600">Muito provável</span>
            </div>
            <div className="flex gap-1.5 md:justify-between overflow-x-auto pb-2 no-scrollbar md:overflow-visible">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <div
                  key={n}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center text-sm text-gray-700 bg-gray-50 hover:border-[#2C5F66] transition-colors shrink-0"
                >
                  {n}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <span>Detratores (0-6)</span>
              <span>Neutros (7-8)</span>
              <span>Promotores (9-10)</span>
            </div>
          </div>
        )}

        {question.type === 'slider' && question.scale && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{question.scale.minLabel || question.scale.min}</span>
              <span>{question.scale.maxLabel || question.scale.max}</span>
            </div>
            <input
              type="range"
              min={question.scale.min}
              max={question.scale.max}
              step={question.scale.step ?? 1}
              defaultValue={(question.scale.min + question.scale.max) / 2}
              className="w-full accent-[#2C5F66]"
            />
          </div>
        )}

        {question.type === 'rating-multi' && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-gray-700">Itens avaliados</div>
            <div className="space-y-2">
              {(question.items || ['Item 1', 'Item 2']).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border rounded-md p-2">
                  <span className="text-sm text-gray-800">{item}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: question.maxRating || 5 }, (_, starIdx) => (
                      <Star
                        key={starIdx}
                        className="w-4 h-4 text-yellow-400"
                        fill={starIdx < (question.maxRating || 5) / 2 ? '#FACC15' : 'none'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {question.type === 'matrix' && (
          <div className="mt-4 border rounded-lg p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-gray-600">Item</th>
                  {(question.matrixCols || ['Ruim', 'Regular', 'Bom', 'Ótimo']).map((col, idx) => (
                    <th key={idx} className="p-2 text-center text-gray-600">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(question.matrixRows || ['Atendimento', 'Produto']).map((row, rIdx) => (
                  <tr key={rIdx} className="border-t">
                    <td className="p-2 font-medium text-gray-800">{row}</td>
                    {(question.matrixCols || ['Ruim', 'Regular', 'Bom', 'Ótimo']).map((_, cIdx) => (
                      <td key={cIdx} className="p-2 text-center">
                        <Circle className="w-4 h-4 text-gray-400 inline-block" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(question.type === 'intro-page' || question.type === 'thank-you-page') && (
          <div className="mt-4 p-4 md:p-6 bg-gradient-to-br from-[#E8F4F5] to-white rounded-lg border-2 border-[#2C5F66]/20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#2C5F66] text-white mb-4">
              {question.type === 'intro-page' ? (
                <FileText className="w-6 h-6 md:w-8 md:h-8" />
              ) : (
                <PartyPopper className="w-6 h-6 md:w-8 md:h-8" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {question.type === 'intro-page' 
                ? 'Esta é uma página de introdução. Os participantes verão esta mensagem antes de responderem às perguntas.'
                : 'Esta é uma página de agradecimento. Os participantes verão esta mensagem ao final do questionário.'
              }
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
