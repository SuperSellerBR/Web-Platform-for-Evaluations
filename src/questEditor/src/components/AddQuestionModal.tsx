import React, { useState } from 'react';
import {
  ListChecks,
  CheckSquare,
  ChevronDown,
  Type,
  Star,
  BarChart3,
  TrendingUp,
  FileText,
  PartyPopper,
  Grid3x3,
  Sliders,
  MessageSquare,
  AlignLeft,
  FileType,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Upload,
  FlaskConical,
  ArrowRight,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Question } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface QuestionType {
  value: Question['type'];
  label: string;
  icon: React.ReactNode;
  category: 'selection' | 'rating' | 'text' | 'forms' | 'other' | 'pages';
  badge?: string;
  description?: string;
}

interface AddQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: Question['type']) => void;
}

export function AddQuestionModal({ open, onOpenChange, onSelectType }: AddQuestionModalProps) {
  const [hoveredType, setHoveredType] = useState<Question['type'] | null>(null);

  const questionTypes: QuestionType[] = [
    // Seleção
    {
      value: 'multiple-choice',
      label: 'Múltipla escolha',
      icon: <ListChecks className="w-5 h-5" />,
      category: 'selection',
      description: 'Permite que os respondentes selecionem uma única opção de uma lista.'
    },
    {
      value: 'checkbox',
      label: 'Caixas de seleção',
      icon: <CheckSquare className="w-5 h-5" />,
      category: 'selection',
      description: 'Permite que os respondentes selecionem várias opções de uma lista.'
    },
    {
      value: 'dropdown',
      label: 'Lista suspensa',
      icon: <ChevronDown className="w-5 h-5" />,
      category: 'selection',
      description: 'Uma lista compacta de opções onde apenas uma pode ser selecionada.'
    },

    // Avaliação
    {
      value: 'rating',
      label: 'Avaliação com estrelas',
      icon: <Star className="w-5 h-5" />,
      category: 'rating',
      description: 'Uma escala visual de estrelas para avaliações rápidas.'
    },
    {
      value: 'rating-multi',
      label: 'Avaliação com estrelas (vários itens)',
      icon: <Star className="w-5 h-5" />,
      category: 'rating',
      description: 'Avalie múltiplos itens/atributos com estrelas.'
    },
    {
      value: 'slider',
      label: 'Barra deslizante',
      icon: <Sliders className="w-5 h-5" />,
      category: 'rating',
      description: 'Selecione um valor em uma escala contínua.'
    },
    {
      value: 'likert',
      label: 'Escala Likert',
      icon: <Sliders className="w-5 h-5" />,
      category: 'rating',
      description: 'Mede o grau de concordância ou satisfação em uma escala linear.'
    },
    {
      value: 'matrix',
      label: 'Matriz / Escala de avaliação',
      icon: <Grid3x3 className="w-5 h-5" />,
      category: 'rating',
      description: 'Linhas x colunas para avaliar múltiplos itens em várias categorias.'
    },

    // Caixa de texto
    {
      value: 'text',
      label: 'Caixa de comentário',
      icon: <MessageSquare className="w-5 h-5" />,
      category: 'text',
      description: 'Campo de texto aberto para respostas longas ou comentários.'
    },

    // Outro
    {
      value: 'nps',
      label: 'Net Promoter Score®',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'other',
      badge: 'Recomendado',
      description: 'Métrica padrão da indústria para medir fidelidade do cliente.'
    },

    // Páginas Especiais
    {
      value: 'intro-page',
      label: 'Página de Introdução',
      icon: <FileText className="w-5 h-5" />,
      category: 'pages',
      description: 'Página inicial para apresentar sua pesquisa aos respondentes.'
    },
    {
      value: 'thank-you-page',
      label: 'Página de Agradecimento',
      icon: <PartyPopper className="w-5 h-5" />,
      category: 'pages',
      description: 'Página final para agradecer a participação.'
    },
  ];

  const handleSelectType = (type: Question['type']) => {
    onSelectType(type);
    onOpenChange(false);
  };

  const categories = [
    { id: 'selection', title: 'Seleção' },
    { id: 'rating', title: 'Avaliação' },
    { id: 'text', title: 'Caixa de texto' },
    { id: 'other', title: 'Outro' },
    { id: 'pages', title: 'Páginas Especiais' },
  ];

  const getTypesForCategory = (categoryId: string) => {
    return questionTypes.filter(type => type.category === categoryId);
  };

  const renderPreview = (type: Question['type']) => {
    switch (type) {
      case 'multiple-choice':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Qual é a sua cor favorita?</p>
            <RadioGroup defaultValue="option1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option1" id="r1" />
                <Label htmlFor="r1">Azul</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option2" id="r2" />
                <Label htmlFor="r2">Verde</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="option3" id="r3" />
                <Label htmlFor="r3">Vermelho</Label>
              </div>
            </RadioGroup>
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Quais frutas você gosta?</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="c1" />
                <Label htmlFor="c1">Maçã</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="c2" />
                <Label htmlFor="c2">Banana</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="c3" />
                <Label htmlFor="c3">Laranja</Label>
              </div>
            </div>
          </div>
        );
      case 'dropdown':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Selecione seu departamento:</p>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="sales">Vendas</SelectItem>
                <SelectItem value="engineering">Engenharia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'rating':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Como você avalia nosso atendimento?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-8 h-8 ${star <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
              ))}
            </div>
          </div>
        );
      case 'likert':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">O produto atendeu às suas expectativas.</p>
            <div className="flex justify-between items-center pt-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full border border-gray-400" />
                <span className="text-[10px] text-gray-500">Discordo</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 rounded-full border border-gray-400" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full border border-gray-400 bg-gray-100" />
                <span className="text-[10px] text-gray-500">Neutro</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 rounded-full border border-gray-400" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full border border-gray-400" />
                <span className="text-[10px] text-gray-500">Concordo</span>
              </div>
            </div>
          </div>
        );
      case 'text':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Deixe seu comentário adicional:</p>
            <div className="h-20 w-full border rounded-md bg-gray-50 p-2 text-sm text-gray-400">
              Digite sua resposta aqui...
            </div>
          </div>
        );
      case 'nps':
        return (
          <div className="space-y-3">
             <p className="text-sm font-medium text-gray-900 leading-snug">
              Qual é a probabilidade de você recomendar essa empresa a amigos ou colegas?
            </p>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Nem um pouco provável</span>
                <span>Extremamente provável</span>
              </div>
              <div className="flex gap-0.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <div
                    key={n}
                    className={`flex-1 h-7 border flex items-center justify-center text-[10px] font-medium ${
                      n <= 6
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : n <= 8
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                        : 'border-green-200 bg-green-50 text-green-700'
                    } ${n === 0 ? 'rounded-l' : ''} ${n === 10 ? 'rounded-r' : ''}`}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-2">
              Net Promoter Score® é uma marca registrada da Bain & Company, Fred Reichheld e Satmetrix Systems, Inc.
            </p>
          </div>
        );
      case 'intro-page':
        return (
          <div className="space-y-4 text-center border p-4 rounded bg-gray-50">
            <h3 className="font-bold text-lg text-primary">Bem-vindo</h3>
            <p className="text-sm text-gray-600">Esta pesquisa levará apenas 2 minutos.</p>
            <Button size="sm" className="w-full">Iniciar Pesquisa</Button>
          </div>
        );
      case 'thank-you-page':
        return (
          <div className="space-y-4 text-center border p-4 rounded bg-gray-50">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg">Obrigado!</h3>
            <p className="text-sm text-gray-600">Sua resposta foi registrada com sucesso.</p>
          </div>
        );
      case 'matrix':
        return (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">Avalie cada item em cada categoria:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left text-gray-500">Itens</th>
                    <th className="p-2 text-center text-gray-500">Ruim</th>
                    <th className="p-2 text-center text-gray-500">Regular</th>
                    <th className="p-2 text-center text-gray-500">Bom</th>
                    <th className="p-2 text-center text-gray-500">Ótimo</th>
                  </tr>
                </thead>
                <tbody>
                  {['Atendimento', 'Produto'].map((row) => (
                    <tr key={row} className="border-t">
                      <td className="p-2 font-medium text-gray-800">{row}</td>
                      {[1, 2, 3, 4].map((col) => (
                        <td key={col} className="p-2 text-center">
                          <div className="w-4 h-4 rounded-full border border-gray-400 mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'rating-multi':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Avalie os itens abaixo:</p>
            <div className="space-y-3">
              {['Rapidez', 'Simpatia'].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{item}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${star <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'slider':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">Selecione um valor na escala</p>
            <div className="px-2">
              <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-[#2C5F66]" />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-gray-500">Pré-visualização não disponível.</p>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[75vw] h-[75vh] max-w-[75vw] sm:max-w-[75vw] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border shadow-xl">
        {/* Header */}
        <DialogHeader className="px-8 py-6 border-b border-gray-200 bg-white shrink-0">
          <DialogTitle className="text-xl font-semibold text-gray-900">Escolha um tipo de pergunta</DialogTitle>
          <DialogDescription className="text-gray-500">
            Selecione o formato ideal para coletar os dados que você precisa.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex relative bg-gray-50">
          {/* Question Types Grid */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-8">
                {categories.map((category) => {
                  const types = getTypesForCategory(category.id);
                  if (types.length === 0) return null;

                  return (
                    <div key={category.id} className="col-span-1 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <h3 className="col-span-1 sm:col-span-2 lg:col-span-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        {category.title}
                        <div className="h-px flex-1 bg-gray-200"></div>
                      </h3>
                      {types.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => handleSelectType(type.value)}
                          onMouseEnter={() => setHoveredType(type.value)}
                          onMouseLeave={() => setHoveredType(null)}
                          className="flex flex-col items-start p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-[#2C5F66]/50 transition-all text-left group h-full relative overflow-hidden"
                        >
                          <div className={`p-2 rounded-lg mb-3 transition-colors ${
                            hoveredType === type.value ? 'bg-[#2C5F66]/10 text-[#2C5F66]' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {type.icon}
                          </div>
                          <span className="font-semibold text-gray-900 mb-1 group-hover:text-[#2C5F66] transition-colors">
                            {type.label}
                          </span>
                          {type.badge && (
                            <span className="absolute top-3 right-3 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                              {type.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview Panel - Fixed on the right side */}
          <div className="w-[400px] border-l border-gray-200 bg-white p-8 hidden xl:block overflow-y-auto shrink-0">
            <div className="sticky top-0">
              <div className="flex items-center gap-2 text-gray-400 text-sm uppercase tracking-wide font-semibold mb-6">
                <FileType className="w-4 h-4" />
                Pré-visualização
              </div>
              
              {hoveredType ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-white rounded-xl border-2 border-[#2C5F66]/10 shadow-lg p-6 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2C5F66] to-emerald-500" />
                     
                     <div className="mb-6">
                       <div className="flex items-center gap-3 mb-2">
                         <div className="p-2 bg-[#2C5F66]/10 rounded-lg text-[#2C5F66]">
                           {questionTypes.find(t => t.value === hoveredType)?.icon}
                         </div>
                         <h3 className="text-lg font-bold text-gray-900">
                           {questionTypes.find(t => t.value === hoveredType)?.label}
                         </h3>
                       </div>
                       <p className="text-sm text-gray-500 leading-relaxed">
                         {questionTypes.find(t => t.value === hoveredType)?.description}
                       </p>
                     </div>

                     <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
                       {renderPreview(hoveredType)}
                     </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <ArrowRight className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-sm text-center px-8">
                    Passe o mouse sobre uma opção para ver como ela aparecerá na sua pesquisa.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
