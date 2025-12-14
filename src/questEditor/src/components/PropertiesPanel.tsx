import React from 'react';
import { X } from 'lucide-react';
import { Question } from '../types';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';

interface PropertiesPanelProps {
  question: Question;
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void;
  onClose: () => void;
}

export function PropertiesPanel({ question, onUpdateQuestion, onClose }: PropertiesPanelProps) {
  const questionTypes = [
    { value: 'multiple-choice', label: 'Múltipla Escolha' },
    { value: 'checkbox', label: 'Caixas de Seleção' },
    { value: 'dropdown', label: 'Lista Suspensa' },
    { value: 'text', label: 'Texto Livre' },
    { value: 'rating', label: 'Avaliação (estrelas)' },
    { value: 'rating-multi', label: 'Avaliação (multi-itens)' },
    { value: 'slider', label: 'Barra deslizante' },
    { value: 'likert', label: 'Escala Likert' },
    { value: 'matrix', label: 'Matriz / Escala' },
    { value: 'nps', label: 'NPS (Net Promoter Score)' },
    { value: 'intro-page', label: 'Página de Introdução' },
    { value: 'thank-you-page', label: 'Página de Agradecimento' },
  ];

  const textValidationTypes = [
    { value: 'text', label: 'Texto (Qualquer)' },
    { value: 'email', label: 'Endereço de Email' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Data' },
    { value: 'url', label: 'URL / Link' },
    { value: 'tel', label: 'Telefone' },
  ];

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-[360px] sm:w-[380px] lg:w-[420px] bg-white border-l border-gray-200 overflow-y-auto z-40 shadow-xl transition-transform duration-300">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-gray-900 font-semibold">Propriedades</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
             <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Question Type */}
          <div className="space-y-2">
            <Label htmlFor="question-type">Tipo de Pergunta</Label>
            <Select
              value={question.type}
              onValueChange={(value) =>
                onUpdateQuestion(question.id, { type: value as Question['type'] })
              }
            >
              <SelectTrigger id="question-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Required Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="required">Resposta Obrigatória</Label>
              <p className="text-xs text-gray-500">
                O usuário deve responder esta pergunta
              </p>
            </div>
            <Switch
              id="required"
              checked={question.required}
              onCheckedChange={(checked) =>
                onUpdateQuestion(question.id, { required: checked })
              }
            />
          </div>

          {/* Randomize Options */}
          {(question.type === 'multiple-choice' ||
            question.type === 'checkbox' ||
            question.type === 'dropdown') && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="randomize">Randomizar Opções</Label>
                  <p className="text-xs text-gray-500">
                    Apresentar opções em ordem aleatória
                  </p>
                </div>
                <Switch
                  id="randomize"
                  checked={question.randomize || false}
                  onCheckedChange={(checked) =>
                    onUpdateQuestion(question.id, { randomize: checked })
                  }
                />
              </div>
            </>
          )}

          {/* Character Limit for Text Questions */}
          {question.type === 'text' && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="char-limit">Limite de Caracteres</Label>
                <Input
                  id="char-limit"
                  type="number"
                  value={question.charLimit || ''}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, {
                      charLimit: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Ex: 500"
                  min="1"
                />
                <p className="text-xs text-gray-500">
                  Deixe em branco para sem limite
                </p>
              </div>
            </>
          )}

          {/* Scale Configuration for Rating/Likert */}
          {(question.type === 'rating' || question.type === 'likert' || question.type === 'slider') && question.scale && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm text-gray-900">Configuração da Escala</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="scale-min">Valor Mínimo</Label>
                    <Input
                      id="scale-min"
                      type="number"
                      value={question.scale.min}
                      onChange={(e) =>
                        onUpdateQuestion(question.id, {
                          scale: { ...question.scale!, min: parseInt(e.target.value) || 1 },
                        })
                      }
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scale-max">Valor Máximo</Label>
                    <Input
                      id="scale-max"
                      type="number"
                      value={question.scale.max}
                      onChange={(e) =>
                        onUpdateQuestion(question.id, {
                          scale: { ...question.scale!, max: parseInt(e.target.value) || 5 },
                        })
                      }
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-label">Rótulo Mínimo</Label>
                  <Input
                    id="min-label"
                    value={question.scale.minLabel}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, {
                        scale: { ...question.scale!, minLabel: e.target.value },
                      })
                    }
                    placeholder="Ex: Ruim"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-label">Rótulo Máximo</Label>
                  <Input
                    id="max-label"
                    value={question.scale.maxLabel}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, {
                        scale: { ...question.scale!, maxLabel: e.target.value },
                      })
                    }
                    placeholder="Ex: Excelente"
                  />
                </div>

                {question.type === 'slider' && (
                  <div className="space-y-2">
                    <Label htmlFor="step">Incremento (passo)</Label>
                    <Input
                      id="step"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={question.scale.step ?? 1}
                      onChange={(e) =>
                        onUpdateQuestion(question.id, {
                          scale: { ...question.scale!, step: parseFloat(e.target.value) || 1 },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Rating multi-itens */}
          {question.type === 'rating-multi' && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Itens avaliados (um por linha)</Label>
                <Textarea
                  value={(question.items || ['Item 1', 'Item 2']).join('\n')}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, {
                      items: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  rows={4}
                  placeholder="Rapidez&#10;Cortesia&#10;Qualidade"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onUpdateQuestion(question.id, {
                      items: [...(question.items || []), `Item ${(question.items?.length || 0) + 1}`],
                    })
                  }
                >
                  Adicionar item
                </Button>
                <div className="space-y-2">
                  <Label>Máximo de estrelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={question.maxRating || 5}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, {
                        maxRating: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Matriz */}
          {question.type === 'matrix' && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>Linhas (itens) – um por linha</Label>
                <Textarea
                  value={(question.matrixRows || ['Item 1', 'Item 2']).join('\n')}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, {
                      matrixRows: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  rows={4}
                  placeholder="Atendimento&#10;Produto"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onUpdateQuestion(question.id, {
                      matrixRows: [...(question.matrixRows || []), `Item ${(question.matrixRows?.length || 0) + 1}`],
                    })
                  }
                >
                  Adicionar linha
                </Button>
                <Label>Colunas (opções) – um por linha</Label>
                <Textarea
                  value={(question.matrixCols || ['Ruim', 'Regular', 'Bom', 'Ótimo']).join('\n')}
                  onChange={(e) =>
                    onUpdateQuestion(question.id, {
                      matrixCols: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  rows={4}
                  placeholder="Ruim&#10;Regular&#10;Bom&#10;Ótimo"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onUpdateQuestion(question.id, {
                      matrixCols: [...(question.matrixCols || []), `Coluna ${(question.matrixCols?.length || 0) + 1}`],
                    })
                  }
                >
                  Adicionar coluna
                </Button>
              </div>
            </>
          )}

          <Separator />

          {/* Validation Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm text-gray-900 font-medium">Regras de Validação</h4>
            </div>
            
            {question.type === 'text' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="validation-type">Formato Esperado</Label>
                  <Select
                    value={question.validation?.type || 'text'}
                    onValueChange={(val) =>
                      onUpdateQuestion(question.id, {
                        validation: { ...question.validation, type: val as any }
                      })
                    }
                  >
                    <SelectTrigger id="validation-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {textValidationTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {question.type === 'checkbox' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="min-select">Mínimo Seleção</Label>
                  <Input
                    id="min-select"
                    type="number"
                    min="0"
                    value={question.validation?.minSelect || ''}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, {
                        validation: { 
                          ...question.validation, 
                          minSelect: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-select">Máximo Seleção</Label>
                  <Input
                    id="max-select"
                    type="number"
                    min="0"
                    value={question.validation?.maxSelect || ''}
                    onChange={(e) =>
                      onUpdateQuestion(question.id, {
                        validation: { 
                          ...question.validation, 
                          maxSelect: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      })
                    }
                    placeholder="Sem limite"
                  />
                </div>
              </div>
            )}

            {question.type !== 'text' && question.type !== 'checkbox' && (
              <p className="text-xs text-gray-400 italic">
                Nenhuma regra de validação adicional disponível para este tipo de pergunta.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
