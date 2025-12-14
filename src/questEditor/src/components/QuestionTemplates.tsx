import React from 'react';
import { Sparkles, Users, Star, ThumbsUp, MessageSquare, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Question } from '../types';

interface QuestionTemplatesProps {
  onSelectTemplate: (questions: Question[]) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  questions: Omit<Question, 'id'>[];
  category: 'satisfaction' | 'feedback' | 'research';
}

export function QuestionTemplates({ onSelectTemplate }: QuestionTemplatesProps) {
  const templates: Template[] = [
    {
      id: 'nps',
      name: 'Net Promoter Score (NPS)',
      description: 'Mede a probabilidade de recomendação',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'satisfaction',
      questions: [
        {
          type: 'rating',
          title: 'Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossa empresa/produto para um amigo ou colega?',
          description: '0 = Muito improvável, 10 = Muito provável',
          required: true,
          randomize: false,
          scale: { min: 0, max: 10, minLabel: 'Muito improvável', maxLabel: 'Muito provável' },
        },
        {
          type: 'text',
          title: 'Qual é o principal motivo da sua nota?',
          description: 'Por favor, compartilhe seus comentários',
          required: false,
          randomize: false,
          charLimit: 500,
        },
      ],
    },
    {
      id: 'csat',
      name: 'Satisfação do Cliente (CSAT)',
      description: 'Avalia a satisfação geral',
      icon: <Star className="w-5 h-5" />,
      category: 'satisfaction',
      questions: [
        {
          type: 'multiple-choice',
          title: 'Como você avalia sua satisfação geral com nosso produto/serviço?',
          description: 'Selecione a opção que melhor representa sua experiência',
          required: true,
          randomize: false,
          options: ['Muito satisfeito', 'Satisfeito', 'Neutro', 'Insatisfeito', 'Muito insatisfeito'],
        },
        {
          type: 'checkbox',
          title: 'Quais aspectos você mais valoriza?',
          description: 'Selecione todas as opções que se aplicam',
          required: false,
          randomize: true,
          options: ['Qualidade do produto', 'Atendimento', 'Preço', 'Facilidade de uso', 'Entrega rápida', 'Outro'],
        },
      ],
    },
    {
      id: 'product-feedback',
      name: 'Feedback de Produto',
      description: 'Coleta opiniões sobre produtos',
      icon: <MessageSquare className="w-5 h-5" />,
      category: 'feedback',
      questions: [
        {
          type: 'multiple-choice',
          title: 'Com que frequência você usa nosso produto?',
          description: '',
          required: true,
          randomize: false,
          options: ['Diariamente', 'Semanalmente', 'Mensalmente', 'Raramente', 'Primeira vez'],
        },
        {
          type: 'likert',
          title: 'Nosso produto atende às suas necessidades',
          description: '',
          required: true,
          randomize: false,
          scale: { min: 1, max: 5, minLabel: 'Discordo totalmente', maxLabel: 'Concordo totalmente' },
        },
        {
          type: 'text',
          title: 'Que melhorias você sugere?',
          description: 'Suas sugestões são muito importantes para nós',
          required: false,
          randomize: false,
          charLimit: 500,
        },
      ],
    },
    {
      id: 'event-feedback',
      name: 'Avaliação de Evento',
      description: 'Feedback sobre eventos e experiências',
      icon: <Users className="w-5 h-5" />,
      category: 'feedback',
      questions: [
        {
          type: 'rating',
          title: 'Como você avalia o evento de forma geral?',
          description: '',
          required: true,
          randomize: false,
          scale: { min: 1, max: 5, minLabel: 'Muito ruim', maxLabel: 'Excelente' },
        },
        {
          type: 'checkbox',
          title: 'Quais aspectos do evento você mais gostou?',
          description: 'Selecione todas as opções que se aplicam',
          required: false,
          randomize: true,
          options: ['Conteúdo apresentado', 'Palestrantes', 'Organização', 'Local/Infraestrutura', 'Networking', 'Alimentação'],
        },
        {
          type: 'multiple-choice',
          title: 'Você participaria de outro evento nosso?',
          description: '',
          required: true,
          randomize: false,
          options: ['Definitivamente sim', 'Provavelmente sim', 'Talvez', 'Provavelmente não', 'Definitivamente não'],
        },
      ],
    },
    {
      id: 'demographic',
      name: 'Perfil Demográfico',
      description: 'Informações básicas sobre o respondente',
      icon: <Users className="w-5 h-5" />,
      category: 'research',
      questions: [
        {
          type: 'dropdown',
          title: 'Qual é a sua faixa etária?',
          description: '',
          required: false,
          randomize: false,
          options: ['18-24 anos', '25-34 anos', '35-44 anos', '45-54 anos', '55-64 anos', '65+ anos', 'Prefiro não informar'],
        },
        {
          type: 'dropdown',
          title: 'Qual é o seu nível de escolaridade?',
          description: '',
          required: false,
          randomize: false,
          options: ['Ensino Fundamental', 'Ensino Médio', 'Ensino Superior', 'Pós-graduação', 'Mestrado', 'Doutorado', 'Prefiro não informar'],
        },
        {
          type: 'multiple-choice',
          title: 'Como você se identifica?',
          description: '',
          required: false,
          randomize: false,
          options: ['Masculino', 'Feminino', 'Não-binário', 'Prefiro não informar', 'Outro'],
        },
      ],
    },
    {
      id: 'quick-poll',
      name: 'Enquete Rápida',
      description: 'Pergunta única e direta',
      icon: <ThumbsUp className="w-5 h-5" />,
      category: 'research',
      questions: [
        {
          type: 'multiple-choice',
          title: 'Qual é a sua opinião sobre este tópico?',
          description: 'Escolha a opção que melhor representa seu ponto de vista',
          required: true,
          randomize: true,
          options: ['Concordo totalmente', 'Concordo parcialmente', 'Neutro', 'Discordo parcialmente', 'Discordo totalmente'],
        },
      ],
    },
  ];

  const [open, setOpen] = React.useState(false);

  const handleSelectTemplate = (template: Template) => {
    const questions: Question[] = template.questions.map((q, index) => ({
      ...q,
      id: `template-${Date.now()}-${index}`,
    }));
    
    onSelectTemplate(questions);
    setOpen(false);
  };

  const categories = [
    { id: 'satisfaction', label: 'Satisfação e NPS' },
    { id: 'feedback', label: 'Feedback e Avaliação' },
    { id: 'research', label: 'Pesquisa e Perfil' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-[15px]">
          <Sparkles className="w-4 h-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates de Questionários</DialogTitle>
          <DialogDescription>
            Use um template pronto para começar rapidamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categories.map((category) => {
            const categoryTemplates = templates.filter((t) => t.category === category.id);
            
            return (
              <div key={category.id} className="space-y-3">
                <h3 className="text-sm text-gray-700">{category.label}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="group p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-[#2C5F66] hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-[#E8F4F5] text-[#2C5F66] group-hover:bg-[#2C5F66] group-hover:text-white transition-colors">
                          {template.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm text-gray-900 mb-1">
                            {template.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {template.questions.length} {template.questions.length === 1 ? 'pergunta' : 'perguntas'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
