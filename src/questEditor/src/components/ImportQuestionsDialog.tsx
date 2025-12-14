import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Code } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Question } from '../types';

interface ImportQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: Question[]) => void;
}

export function ImportQuestionsDialog({
  open,
  onOpenChange,
  onImport,
}: ImportQuestionsDialogProps) {
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('text');

  const parseSurveyMonkeyJSON = (json: any): Question[] => {
    const questions: Question[] = [];
    
    // Handle direct array of questions or SurveyMonkey 'details' response structure
    const pages = json.pages || (Array.isArray(json) ? [{ questions: json }] : []);
    
    if (!pages.length && json.questions) {
       pages.push({ questions: json.questions });
    }

    let qIndex = 0;

    pages.forEach((page: any) => {
      if (page.questions) {
        page.questions.forEach((smQ: any) => {
          const qId = `imported-sm-${Date.now()}-${qIndex++}`;
          let type: Question['type'] = 'text';
          let options: string[] = [];
          let scale;

          // Map SurveyMonkey families to our types
          switch (smQ.family) {
            case 'single_choice':
              type = 'multiple-choice';
              if (smQ.answers?.choices) {
                options = smQ.answers.choices.map((c: any) => c.text || c.label);
              }
              break;
            case 'multiple_choice':
              type = 'checkbox';
               if (smQ.answers?.choices) {
                options = smQ.answers.choices.map((c: any) => c.text || c.label);
              }
              break;
            case 'matrix': 
              // Simplified matrix to Likert or Rating if possible, otherwise defaulting to text for safety
              if (smQ.subtype === 'rating') {
                  type = 'rating';
                  scale = { min: 1, max: 5, minLabel: 'Min', maxLabel: 'Max' };
              } else {
                  type = 'likert';
                  // Likert usually needs specific structure, falling back to simple extraction
                  scale = { min: 1, max: 5, minLabel: 'Discordo', maxLabel: 'Concordo' };
              }
              break;
            case 'open_ended':
              type = 'text';
              break;
            case 'datetime':
               type = 'text'; // We don't have date yet
               break;
            default:
              // Try to guess based on structure if family is missing
              if (smQ.answers?.choices) {
                type = 'multiple-choice';
                options = smQ.answers.choices.map((c: any) => c.text);
              }
              break;
          }

          const question: Question = {
            id: qId,
            type,
            title: smQ.heading || smQ.title || 'Pergunta Importada',
            description: '', // SurveyMonkey often doesn't have desc in the same place
            required: smQ.required?.amount > 0 || smQ.required === true,
            randomize: smQ.sorting?.type === 'random',
            options: options.length > 0 ? options : undefined,
            scale: scale,
            charLimit: type === 'text' ? 1000 : undefined,
          };

          questions.push(question);
        });
      }
    });

    return questions;
  };

  const handleImport = () => {
    setError('');
    
    if (!importText.trim()) {
      setError('Por favor, insira o conteúdo para importar');
      return;
    }

    try {
      let newQuestions: Question[] = [];

      if (activeTab === 'json' || importText.trim().startsWith('{') || importText.trim().startsWith('[')) {
        // Try JSON Import
        try {
          const json = JSON.parse(importText);
          newQuestions = parseSurveyMonkeyJSON(json);
          
          if (newQuestions.length === 0) {
             setError('JSON válido, mas nenhuma pergunta reconhecida. Verifique a estrutura.');
             return;
          }
        } catch (e) {
          setError('Erro ao ler JSON. Verifique a sintaxe.');
          return;
        }
      } else {
        // Text Import
        const lines = importText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        if (lines.length === 0) {
          setError('Nenhuma pergunta válida encontrada');
          return;
        }

        newQuestions = lines.map((line, index) => {
          const parts = line.split('|').map(p => p.trim());
          const title = parts[0];
          const hasOptions = parts.length > 1;

          const question: Question = {
            id: `imported-${Date.now()}-${index}`,
            type: hasOptions ? 'multiple-choice' : 'text',
            title: title,
            description: '',
            required: false,
            randomize: false,
          };

          if (hasOptions) {
            question.options = parts.slice(1);
          } else {
            question.charLimit = 500;
          }

          return question;
        });
      }

      onImport(newQuestions);
      setImportText('');
      onOpenChange(false);
    } catch (err) {
      setError('Erro ao processar as perguntas. Verifique o formato.');
    }
  };

  const exampleText = `Qual é o seu cargo atual?
Como você conheceu nossa empresa? | Redes Sociais | Indicação | Busca Online | Outro
Qual é seu nível de satisfação? | Muito Satisfeito | Satisfeito | Neutro | Insatisfeito
O que podemos melhorar?`;

  const exampleJSON = `{
  "pages": [
    {
      "questions": [
        {
          "heading": "Qual a sua cor favorita?",
          "family": "single_choice",
          "answers": {
            "choices": [
              { "text": "Azul" },
              { "text": "Vermelho" }
            ]
          }
        }
      ]
    }
  ]
}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Perguntas</DialogTitle>
          <DialogDescription>
            Importe perguntas de texto simples ou JSON do SurveyMonkey.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Texto Simples</TabsTrigger>
            <TabsTrigger value="json">JSON / SurveyMonkey</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="import-text">Cole suas perguntas (uma por linha)</Label>
              <Textarea
                id="import-text"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setError('');
                }}
                placeholder={exampleText}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="mb-2">
                  <strong>Formato Texto:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Pergunta simples (cria texto livre)</li>
                  <li>Pergunta? | Opção 1 | Opção 2 (cria múltipla escolha)</li>
                </ul>
              </div>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="json" className="space-y-4 mt-4">
             <div className="space-y-2">
              <Label htmlFor="import-json">Cole o JSON (Estrutura SurveyMonkey)</Label>
              <Textarea
                id="import-json"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setError('');
                }}
                placeholder={exampleJSON}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Code className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-900">
                <p className="mb-2">
                  <strong>Suporte JSON:</strong>
                </p>
                <p className="text-gray-700 mb-2">
                  Aceita estrutura de exportação de "details" do SurveyMonkey ou JSON genérico com array de perguntas.
                </p>
                <div className="text-xs text-gray-500 bg-white p-2 rounded border">
                  {`{"pages": [{"questions": [{"heading": "...", "family": "single_choice", ...}]}]}`}
                </div>
              </div>
            </div>
          </div>
          </TabsContent>
        </Tabs>

        {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} className="gap-2 bg-[#2C5F66] hover:bg-[#1A4A4F]">
            <Upload className="w-4 h-4" />
            Importar {activeTab === 'json' ? 'JSON' : 'Texto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
