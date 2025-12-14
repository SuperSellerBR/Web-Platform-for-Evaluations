import React from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Theme } from '../types';

interface AppearanceEditorProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function AppearanceEditor({ theme, onChange }: AppearanceEditorProps) {
  const fonts = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Roboto, sans-serif', label: 'Roboto' },
    { value: 'Open Sans, sans-serif', label: 'Open Sans' },
    { value: 'Lato, sans-serif', label: 'Lato' },
    { value: 'Times New Roman, serif', label: 'Serif' },
  ];

  const borderRadii = [
    { value: '0px', label: 'Quadrado (0px)' },
    { value: '0.25rem', label: 'Pequeno (4px)' },
    { value: '0.5rem', label: 'Médio (8px)' },
    { value: '1rem', label: 'Grande (16px)' },
    { value: '1.5rem', label: 'Arredondado (24px)' },
  ];

  const handleChange = (key: keyof Theme, value: string) => {
    onChange({ ...theme, [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Personalizar Aparência</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-12 h-12 p-1 cursor-pointer"
                />
                <div className="text-sm text-gray-500 uppercase">{theme.primaryColor}</div>
              </div>
              <p className="text-xs text-gray-500">Usada em botões, links e destaques.</p>
            </div>

            <div className="space-y-2">
              <Label>Cor de Fundo</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                  className="w-12 h-12 p-1 cursor-pointer"
                />
                <div className="text-sm text-gray-500 uppercase">{theme.backgroundColor}</div>
              </div>
              <p className="text-xs text-gray-500">Cor de fundo da página do questionário.</p>
            </div>
            
            <div className="space-y-2">
               <Label>Cor do Texto</Label>
               <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={theme.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  className="w-12 h-12 p-1 cursor-pointer"
                />
                <div className="text-sm text-gray-500 uppercase">{theme.textColor}</div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Select
                value={theme.fontFamily}
                onValueChange={(val) => handleChange('fontFamily', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fonte" />
                </SelectTrigger>
                <SelectContent>
                  {fonts.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arredondamento dos Cantos</Label>
              <Select
                value={theme.borderRadius}
                onValueChange={(val) => handleChange('borderRadius', val)}
              >
                 <SelectTrigger>
                  <SelectValue placeholder="Selecione o arredondamento" />
                </SelectTrigger>
                <SelectContent>
                  {borderRadii.map((radius) => (
                    <SelectItem key={radius.value} value={radius.value}>
                      {radius.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Pré-visualização de Estilo</h3>
              
              <div 
                className="p-6 border border-gray-200 shadow-sm"
                style={{ 
                  backgroundColor: theme.backgroundColor,
                  borderRadius: theme.borderRadius,
                  fontFamily: theme.fontFamily,
                }}
              >
                <h4 
                  className="text-lg font-semibold mb-2"
                  style={{ color: theme.textColor }}
                >
                  Título da Pergunta
                </h4>
                <p 
                  className="text-sm mb-4 opacity-80"
                  style={{ color: theme.textColor }}
                >
                  Descrição da pergunta aparece aqui.
                </p>
                <button
                  className="px-4 py-2 text-white text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ 
                    backgroundColor: theme.primaryColor,
                    borderRadius: theme.borderRadius,
                  }}
                >
                  Botão de Exemplo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
