import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, UserCheck } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface Evaluator {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  birthDate: string;
  gender: string;
  address: string;
  socioeconomicData?: any;
  score: number;
  totalEvaluations: number;
}

interface EvaluatorsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function EvaluatorsPage({ user, accessToken, onNavigate, onLogout }: EvaluatorsPageProps) {
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvaluator, setEditingEvaluator] = useState<Evaluator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Evaluator>>({
    name: '',
    whatsapp: '',
    email: '',
    birthDate: '',
    gender: 'feminino',
    address: '',
    socioeconomicData: {},
  });

  useEffect(() => {
    loadEvaluators();
  }, []);

  const loadEvaluators = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      const data = await response.json();
      if (data.evaluators) {
        setEvaluators(data.evaluators);
      }
    } catch (error) {
      console.error('Error loading evaluators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingEvaluator
        ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators/${editingEvaluator.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators`;

      const response = await fetch(url, {
        method: editingEvaluator ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadEvaluators();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving evaluator:', error);
      alert('Erro ao salvar avaliador');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este avaliador?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        await loadEvaluators();
      }
    } catch (error) {
      console.error('Error deleting evaluator:', error);
    }
  };

  const openModal = (evaluator?: Evaluator) => {
    if (evaluator) {
      setEditingEvaluator(evaluator);
      setFormData(evaluator);
    } else {
      setEditingEvaluator(null);
      setFormData({
        name: '',
        whatsapp: '',
        email: '',
        birthDate: '',
        gender: 'feminino',
        address: '',
        socioeconomicData: {},
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEvaluator(null);
    setFormData({});
  };

  const filteredEvaluators = evaluators.filter(evaluator =>
    evaluator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    evaluator.whatsapp.includes(searchTerm)
  );

  return (
    <Layout user={user} currentPage="evaluators" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-gray-900 mb-2">Avaliadores</h2>
            <p className="text-gray-600">Gerencie os avaliadores cadastrados</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Novo Avaliador
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou whatsapp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEvaluators.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <UserCheck className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhum avaliador cadastrado</h3>
            <p className="text-gray-600 mb-6">Comece cadastrando seu primeiro avaliador</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Avaliador
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredEvaluators.map((evaluator) => (
              <div key={evaluator.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-purple-100 rounded-lg p-3">
                    <UserCheck className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(evaluator)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(evaluator.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-gray-900 mb-2">{evaluator.name}</h3>
                <div className="space-y-1 text-sm mb-3">
                  <p className="text-gray-600">WhatsApp: {evaluator.whatsapp}</p>
                  {evaluator.email && (
                    <p className="text-gray-600">Email: {evaluator.email}</p>
                  )}
                  <p className="text-gray-600">Gênero: {evaluator.gender}</p>
                  <p className="text-gray-600">
                    Nascimento: {new Date(evaluator.birthDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="text-sm">
                    <p className="text-gray-600">Pontuação</p>
                    <p className="text-gray-900">{evaluator.score || 0}</p>
                  </div>
                  <div className="text-sm text-right">
                    <p className="text-gray-600">Avaliações</p>
                    <p className="text-gray-900">{evaluator.totalEvaluations || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              <h3 className="text-gray-900">
                {editingEvaluator ? 'Editar Avaliador' : 'Novo Avaliador'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Email (opcional)</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.birthDate || ''}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Gênero</label>
                  <select
                    value={formData.gender || 'feminino'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Endereço</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingEvaluator ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
