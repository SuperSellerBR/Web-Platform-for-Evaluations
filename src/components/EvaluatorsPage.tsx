import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, UserCheck, LayoutGrid, List, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { LoadingDots } from './LoadingDots';
import { formatFullName } from '../utils/name';
import { useTheme } from '../utils/theme';

interface Evaluator {
  id: string;
  name: string;
  lastName?: string;
  whatsapp: string;
  email?: string;
  birthDate: string;
  gender: string;
  address: string;
  socioeconomicData?: any;
  score: number;
  totalEvaluations: number;
  avatarUrl?: string;
  avatarPath?: string;
}

interface EvaluatorsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const getDefaultViewMode = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'card');

export function EvaluatorsPage({ user, accessToken, onNavigate, onLogout }: EvaluatorsPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvaluator, setEditingEvaluator] = useState<Evaluator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => getDefaultViewMode());
  const [cardPage, setCardPage] = useState(1);

  const [formData, setFormData] = useState<Partial<Evaluator>>({
    name: '',
    lastName: '',
    whatsapp: '',
    email: '',
    birthDate: '',
    gender: 'feminino',
    address: '',
    socioeconomicData: {},
    avatarUrl: '',
    avatarPath: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvaluators();
  }, []);

  useEffect(() => {
    setCardPage(1);
  }, [searchTerm, viewMode]);

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

    setSaving(true);
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
    } finally {
      setSaving(false);
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
        lastName: '',
        whatsapp: '',
        email: '',
        birthDate: '',
        gender: 'feminino',
        address: '',
        socioeconomicData: {},
        avatarUrl: '',
        avatarPath: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEvaluator(null);
    setFormData({});
    setAvatarUploading(false);
    setSaving(false);
  };

  const filteredEvaluators = evaluators
    .filter((evaluator) =>
      formatFullName(evaluator.name, evaluator.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
      evaluator.whatsapp.includes(searchTerm)
    )
    .sort((a, b) =>
      formatFullName(a.name, a.lastName).localeCompare(formatFullName(b.name, b.lastName), "pt-BR")
    );

  const evaluatorsPerPage = 15;
  const totalEvaluatorPages = Math.max(1, Math.ceil(filteredEvaluators.length / evaluatorsPerPage));
  const currentEvaluatorPage = Math.min(cardPage, totalEvaluatorPages);
  const paginatedEvaluators = viewMode === 'card'
    ? filteredEvaluators.slice((currentEvaluatorPage - 1) * evaluatorsPerPage, currentEvaluatorPage * evaluatorsPerPage)
    : filteredEvaluators;
  const cardStart = (currentEvaluatorPage - 1) * evaluatorsPerPage + 1;
  const cardEnd = Math.min(currentEvaluatorPage * evaluatorsPerPage, filteredEvaluators.length);

  const createCircularAvatarFile = async (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.includes(file.type)) throw new Error('Formato inválido. Envie PNG, JPG ou WEBP.');
    if (file.size > maxBytes) throw new Error('Imagem muito grande. Envie até 5MB.');

    const target = 512;
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = src;
      if ('decode' in img) {
        // @ts-expect-error decode existe em navegadores modernos
        await img.decode();
      } else {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        });
      }

      const w = (img as any).naturalWidth || img.width;
      const h = (img as any).naturalHeight || img.height;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;
      const sy = (h - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');

      ctx.clearRect(0, 0, target, target);
      ctx.save();
      ctx.beginPath();
      ctx.arc(target / 2, target / 2, target / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
      ctx.restore();

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem processada'))),
          'image/png'
        );
      });

      return new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(src);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAvatarUploading(true);
    try {
      const processed = await createCircularAvatarFile(file);
      const formDataUpload = new FormData();
      formDataUpload.append('file', processed);
      formDataUpload.append('folder', 'profile-photos');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formDataUpload,
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao fazer upload da foto');

      setFormData((prev) => ({
        ...prev,
        avatarPath: data.path,
        avatarUrl: data.url,
      }));
      if (editingEvaluator) {
        setEvaluators((prev) =>
          prev.map((ev) => (ev.id === editingEvaluator.id ? { ...ev, avatarUrl: data.url, avatarPath: data.path } : ev))
        );
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(error?.message || 'Erro ao enviar foto de perfil');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <Layout user={user} currentPage="evaluators" onNavigate={onNavigate} onLogout={onLogout}>
      <div className={`max-w-7xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-foreground mb-2">Avaliadores</h2>
            <p className="text-muted-foreground">Gerencie os avaliadores cadastrados</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Novo Avaliador
          </button>
        </div>

        {/* Search + View toggle */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome ou whatsapp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                viewMode === 'card'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
              aria-pressed={viewMode === 'card'}
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredEvaluators.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-sm">
            <UserCheck className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Nenhum avaliador cadastrado</h3>
            <p className="text-muted-foreground mb-6">Comece cadastrando seu primeiro avaliador</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Avaliador
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'card' ? (
              <>
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span>
                    Exibindo {cardStart}-{cardEnd} de {filteredEvaluators.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCardPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentEvaluatorPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="text-foreground">
                      Página {currentEvaluatorPage} de {totalEvaluatorPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCardPage((prev) => Math.min(totalEvaluatorPages, prev + 1))}
                      disabled={currentEvaluatorPage >= totalEvaluatorPages}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedEvaluators.map((evaluator) => (
                    <div key={evaluator.id} className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {evaluator.avatarUrl ? (
                            <img
                              src={evaluator.avatarUrl}
                              alt={formatFullName(evaluator.name, evaluator.lastName)}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <UserCheck className="w-6 h-6 text-blue-600" />
                          )}
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
                      <h3 className="text-foreground mb-2">{formatFullName(evaluator.name, evaluator.lastName)}</h3>
                      <div className="space-y-1 text-sm mb-3 text-muted-foreground">
                        <p>WhatsApp: {evaluator.whatsapp}</p>
                        {evaluator.email && (
                          <p>Email: {evaluator.email}</p>
                        )}
                        <p>Gênero: {evaluator.gender}</p>
                        <p>
                          Nascimento: {new Date(evaluator.birthDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="text-sm">
                          <p className="text-muted-foreground">Pontuação</p>
                          <p className="text-foreground">{evaluator.score || 0}</p>
                        </div>
                        <div className="text-sm text-right">
                          <p className="text-muted-foreground">Avaliações</p>
                          <p className="text-foreground">{evaluator.totalEvaluations || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {filteredEvaluators.map((evaluator) => (
                  <div
                    key={evaluator.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openModal(evaluator)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(evaluator);
                      }
                    }}
                    className="w-full text-left px-4 py-3 sm:px-6 sm:py-4 hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {evaluator.avatarUrl ? (
                            <img
                              src={evaluator.avatarUrl}
                              alt={formatFullName(evaluator.name, evaluator.lastName)}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <UserCheck className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <span className="text-foreground font-medium">
                          {formatFullName(evaluator.name, evaluator.lastName)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(evaluator);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(evaluator.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-foreground text-lg font-semibold leading-tight">
                    {editingEvaluator ? 'Editar Avaliador' : 'Novo Avaliador'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {editingEvaluator
                      ? 'Atualize os dados do avaliador.'
                      : 'Cadastre um novo avaliador para receber avaliações.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-foreground mb-2">Nome</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-foreground mb-2">Sobrenome</label>
                <input
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  placeholder="Opcional"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground mb-2">WhatsApp</label>
                  <input
                    type="text"
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-2">Email (opcional)</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground mb-2">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.birthDate || ''}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-2">Gênero</label>
                  <select
                    value={formData.gender || 'feminino'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-foreground mb-2">Endereço</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-foreground mb-2">Foto de perfil</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {formData.avatarUrl ? (
                      <img
                        src={String(formData.avatarUrl)}
                        alt="Prévia da foto"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <UserCheck className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleAvatarUpload}
                        className="flex-1"
                      />
                      {avatarUploading && (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      )}
                      {formData.avatarPath && !avatarUploading && (
                        <span className="text-green-500 text-sm">✓ Enviada</span>
                      )}
                    </div>
                    {formData.avatarPath && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, avatarPath: '', avatarUrl: '' }))}
                        className="mt-2 text-sm text-destructive hover:underline"
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || avatarUploading}
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <LoadingDots label={editingEvaluator ? 'Salvando' : 'Cadastrando'} />
                  ) : editingEvaluator ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
