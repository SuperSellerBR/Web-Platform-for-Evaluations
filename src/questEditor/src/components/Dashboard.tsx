import React, { useState } from 'react';
import { 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  Search, 
  MoreVertical, 
  FileText, 
  Calendar, 
  BarChart2,
  Clock,
  Edit3,
  Trash2,
  Copy
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Survey } from '../types';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';

interface DashboardProps {
  surveys: Survey[];
  onCreateSurvey: () => void;
  onEditSurvey: (survey: Survey) => void;
  onDeleteSurvey: (id: string) => void;
  onDuplicateSurvey: (survey: Survey) => void;
}

export function Dashboard({ 
  surveys, 
  onCreateSurvey, 
  onEditSurvey, 
  onDeleteSurvey,
  onDuplicateSurvey 
}: DashboardProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurveys = surveys.filter(survey => 
    survey.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Questionários</h1>
            <p className="text-gray-500 mt-1">Gerencie e crie novos questionários</p>
          </div>
          <Button onClick={onCreateSurvey} className="bg-[#2C5F66] hover:bg-[#1A3C40] gap-2">
            <Plus className="w-4 h-4" />
            Novo Questionário
          </Button>
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Buscar questionários..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid' ? 'bg-white shadow-sm text-[#2C5F66]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white shadow-sm text-[#2C5F66]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {filteredSurveys.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum questionário encontrado</h3>
            <p className="text-gray-500 mb-6">Comece criando seu primeiro questionário</p>
            <Button onClick={onCreateSurvey} variant="outline">
              Criar Agora
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSurveys.map((survey) => (
              <div 
                key={survey.id}
                className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
                onClick={() => onEditSurvey(survey)}
              >
                {/* Thumbnail placeholder */}
                <div className="h-40 bg-gray-100 relative flex items-center justify-center border-b border-gray-100">
                   <div 
                     className="absolute inset-0 opacity-10"
                     style={{ backgroundColor: survey.theme.primaryColor }}
                   />
                   <FileText className="w-12 h-12 text-gray-300 group-hover:scale-110 transition-transform duration-300" />
                   
                   <div className="absolute top-3 right-3">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 backdrop-blur-sm hover:bg-white">
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditSurvey(survey); }}>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateSurvey(survey); }}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); onDeleteSurvey(survey.id); }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                   </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-[#2C5F66] transition-colors">
                      {survey.title}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      survey.status === 'published' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {survey.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
                     <div className="flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4" />
                        <span>{survey.responseCount} respostas</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(survey.updatedAt)}</span>
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-gray-500 text-sm">Nome</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-500 text-sm">Status</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-500 text-sm">Respostas</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-500 text-sm">Última atualização</th>
                  <th className="text-right py-4 px-6 font-medium text-gray-500 text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSurveys.map((survey) => (
                  <tr 
                    key={survey.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onEditSurvey(survey)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-gray-900">{survey.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                        survey.status === 'published' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {survey.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <BarChart2 className="w-4 h-4" />
                        {survey.responseCount}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDate(survey.updatedAt)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditSurvey(survey)}>
                              <Edit3 className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicateSurvey(survey)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDeleteSurvey(survey.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
