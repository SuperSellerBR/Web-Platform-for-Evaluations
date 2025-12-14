import React from 'react';
import { FileQuestion, GitBranch, Palette, Inbox, Settings, X } from 'lucide-react';
import { ActivePage } from '../types';
import { Button } from './ui/button';

interface SidebarProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ activePage, setActivePage, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'questions' as ActivePage, label: 'Perguntas', icon: FileQuestion },
    { id: 'logic' as ActivePage, label: 'Lógica', icon: GitBranch },
    { id: 'appearance' as ActivePage, label: 'Aparência', icon: Palette },
    { id: 'collect' as ActivePage, label: 'Coleta de Respostas', icon: Inbox },
    { id: 'settings' as ActivePage, label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 md:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActivePage(item.id);
                      onClose(); // Close sidebar on selection (mobile)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-[#E8F4F5] text-[#2C5F66]'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
