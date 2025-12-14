import React from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';

interface ShortcutItem {
  keys: string[];
  description: string;
}

export function ShortcutsHelp() {
  const shortcuts: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'N'],
      description: 'Adicionar nova pergunta',
    },
    {
      keys: ['Ctrl', 'D'],
      description: 'Duplicar pergunta selecionada',
    },
    {
      keys: ['Delete'],
      description: 'Excluir pergunta selecionada',
    },
    {
      keys: ['Backspace'],
      description: 'Excluir pergunta selecionada',
    },
  ];

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
          <Keyboard className="w-4 h-4" />
          <span className="hidden md:inline">Atalhos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de Teclado</DialogTitle>
          <DialogDescription>
            Use atalhos de teclado para trabalhar mais rapidamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
            >
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <React.Fragment key={keyIndex}>
                    {keyIndex > 0 && (
                      <span className="text-gray-400 mx-1">+</span>
                    )}
                    <kbd className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded shadow-sm">
                      {key === 'Ctrl' && isMac ? '⌘' : key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <p>
            <strong>Dica:</strong> {isMac ? '⌘' : 'Ctrl'} = {isMac ? 'Command' : 'Control'} no seu teclado
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
