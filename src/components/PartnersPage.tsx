import { useEffect, useRef, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, Users, SlidersHorizontal, LayoutGrid, List, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { LoadingDots } from './LoadingDots';
import { formatFullName } from '../utils/name';
import { useTheme } from '../utils/theme';
import { ImageCropperModal } from './ImageCropperModal';

interface Partner {
  id: string;
  name: string;
  lastName?: string;
  whatsapp: string;
  email: string;
  cpf: string;
  role: string;
  companyId?: string | null;
  companies?: string[]; // legado
  avatarUrl?: string;
  avatarPath?: string;
}

interface PartnersPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const getDefaultViewMode = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'card');

export function PartnersPage({ user, accessToken, onNavigate, onLogout }: PartnersPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [partners, setPartners] = useState<Partner[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('');

  const currentRole = (user?.role || '').toString().trim().toLowerCase();
  const isSeller = currentRole === 'vendedor' || currentRole === 'seller';
  const isManager = currentRole === 'gerente' || currentRole === 'manager';
  const isCompany = currentRole === 'empresa' || currentRole === 'company';

  const canAssignRole = (role?: string) => {
    const normalized = (role || '').toString().toLowerCase();
    if (isSeller) return false;
    if (isManager) return normalized === 'vendedor' || normalized === 'seller';
    if (isCompany) return ['gerente', 'manager', 'vendedor', 'seller'].includes(normalized);
    return true;
  };

  const canEditPartner = (partner: Partner) => canAssignRole(partner.role);

  const roleOptions = (() => {
    if (isManager) return [{ value: 'vendedor', label: 'Vendedor' }];
    if (isCompany) {
      return [
        { value: 'gerente', label: 'Gerente' },
        { value: 'vendedor', label: 'Vendedor' },
      ];
    }
    return [
      { value: 'empresa', label: 'Empresa' },
      { value: 'gerente', label: 'Gerente' },
      { value: 'vendedor', label: 'Vendedor' },
    ];
  })();

  const [formData, setFormData] = useState<Partial<Partner>>({
    name: '',
    lastName: '',
    whatsapp: '',
    email: '',
    cpf: '',
    role: 'vendedor',
    companyId: '',
    avatarUrl: '',
    avatarPath: '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => getDefaultViewMode());
  const [groupPage, setGroupPage] = useState(1);
  const [avatarCropperFile, setAvatarCropperFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadPartners();
    loadCompanies();
  }, []);

  useEffect(() => {
    setGroupPage(1);
  }, [searchTerm, companyFilter, viewMode]);

  const loadPartners = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      const data = await response.json();
      if (data.partners) {
        setPartners(data.partners);
      }
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      const data = await response.json();
      if (data.companies) {
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSeller) {
      alert('Você não tem permissão para cadastrar/editar membros da equipe.');
      return;
    }

    if (!canAssignRole(formData.role)) {
      alert('Você não tem permissão para cadastrar/editar este perfil.');
      return;
    }

    setSaving(true);
    try {
      const url = editingPartner
        ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners/${editingPartner.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`;

      const payload: any = { ...formData };
      if ((isCompany || isManager) && user?.companyId) {
        payload.companyId = user.companyId;
      }

      const response = await fetch(url, {
        method: editingPartner ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadPartners();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving partner:', error);
      alert('Erro ao salvar membro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este membro?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        await loadPartners();
      }
    } catch (error) {
      console.error('Error deleting partner:', error);
    }
  };

  const openModal = (partner?: Partner) => {
    if (isSeller) {
      alert('Você não tem permissão para cadastrar/editar membros da equipe.');
      return;
    }
    if (partner) {
      if (!canEditPartner(partner)) {
        alert('Você não tem permissão para editar este membro.');
        return;
      }
      setEditingPartner(partner);
      setFormData({
        ...partner,
        role: normalizeRoleValue(partner.role),
        companyId: partner.companyId || '',
        avatarUrl: partner.avatarUrl || '',
        avatarPath: partner.avatarPath || '',
        lastName: partner.lastName || '',
      });
    } else {
      setEditingPartner(null);
      const defaultRole =
        roleOptions.find((opt) => opt.value === 'vendedor')?.value || roleOptions[0]?.value || 'vendedor';
      setFormData({
        name: '',
        lastName: '',
        whatsapp: '',
        email: '',
        cpf: '',
        role: defaultRole,
        companyId: (isCompany || isManager) ? (user?.companyId || '') : '',
        avatarUrl: '',
        avatarPath: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPartner(null);
    setFormData({});
    setAvatarUploading(false);
    setSaving(false);
  };

  const filteredPartners = partners
    .filter((partner) => (isSeller ? false : canEditPartner(partner)))
    .filter(partner => {
      const fullName = formatFullName(partner.name, partner.lastName).toLowerCase();
      return fullName.includes(searchTerm.toLowerCase()) ||
        partner.email.toLowerCase().includes(searchTerm.toLowerCase());
    });

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'gerente':
      case 'manager':
        return 'bg-purple-100 text-purple-800';
      case 'vendedor':
      case 'seller':
        return 'bg-green-100 text-green-800';
      case 'empresa':
      case 'company':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const normalizeRoleValue = (role: string | undefined) => {
    const normalized = (role || '').toString().toLowerCase();
    if (normalized === 'seller') return 'vendedor';
    if (normalized === 'manager') return 'gerente';
    if (normalized === 'company') return 'empresa';
    return normalized;
  };

  const getCompanyName = (companyId?: string | null) => {
    if (!companyId) return 'N/A';
    const company = companies.find((c) => c.id === companyId);
    return company?.name || companyId;
  };

  const sortedPartners = filteredPartners
    .filter((partner) => !companyFilter || partner.companyId === companyFilter)
    .slice()
    .sort((a, b) => {
      const nameA = getCompanyName(a.companyId);
      const nameB = getCompanyName(b.companyId);
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'pt-BR');
      const roleOrder = (role: string | undefined) => {
        const r = (role || '').toLowerCase();
        if (r === 'empresa' || r === 'company') return 0;
        if (r === 'gerente' || r === 'manager') return 1;
        if (r === 'vendedor' || r === 'seller') return 2;
        return 3;
      };
      const ro = roleOrder(a.role) - roleOrder(b.role);
      if (ro !== 0) return ro;
      return formatFullName(a.name, a.lastName).localeCompare(formatFullName(b.name, b.lastName), 'pt-BR');
    });

  const groupedEntries = sortedPartners.reduce<{ companyName: string; members: Partner[] }[]>((acc, partner) => {
    const key = getCompanyName(partner.companyId);
    const existing = acc.find((entry) => entry.companyName === key);
    if (existing) {
      existing.members.push(partner);
    } else {
      acc.push({ companyName: key, members: [partner] });
    }
    return acc;
  }, []);

  const groupsPerPage = 3;
  const totalGroupPages = Math.max(1, Math.ceil(groupedEntries.length / groupsPerPage));
  const currentGroupPage = Math.min(groupPage, totalGroupPages);
  const paginatedGroups = viewMode === 'card'
    ? groupedEntries.slice((currentGroupPage - 1) * groupsPerPage, currentGroupPage * groupsPerPage)
    : groupedEntries;
  const groupStart = (currentGroupPage - 1) * groupsPerPage + 1;
  const groupEnd = Math.min(currentGroupPage * groupsPerPage, groupedEntries.length);

  const uploadPartnerAvatarFile = async (file: File) => {
    setAvatarUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
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
      if (editingPartner) {
        setPartners((prev) =>
          prev.map((p) => (p.id === editingPartner.id ? { ...p, avatarUrl: data.url, avatarPath: data.path } : p))
        );
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(error?.message || 'Erro ao enviar foto de perfil');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePartnerAvatarFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarCropperFile(file);
  };

  const roleRequiresCompany = (role: string | undefined) => {
    const r = (role || '').toLowerCase();
    return ['empresa', 'company', 'gerente', 'manager', 'vendedor', 'seller'].includes(r);
  };

  return (
	    <Layout user={user} currentPage="partners" onNavigate={onNavigate} onLogout={onLogout}>
	      {isSeller ? (
	        <div className={`max-w-3xl mx-auto bg-card border border-border rounded-lg shadow-sm p-6 ${isDark ? 'evaluation-dark' : ''}`}>
	          <h2 className="text-foreground mb-2">Acesso restrito</h2>
	          <p className="text-muted-foreground">Seu perfil não possui permissão para acessar o cadastro da equipe.</p>
	        </div>
	      ) : (
	        <>
	          <div className={`max-w-7xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
	            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
	              <div>
	                <h2 className="text-foreground mb-2">Equipe</h2>
	                <p className="text-muted-foreground">Gerencie gerentes e vendedores</p>
	              </div>
	              <button
	                onClick={() => openModal()}
	                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
	              >
	                <Plus className="w-5 h-5" />
	                Cadastrar Membro
	              </button>
	            </div>

        {/* Search + View toggle */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:max-w-2xl">
            <button
              type="button"
              onClick={() => setFilterModal(true)}
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
              aria-label="Filtrar por empresa"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
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

        {filterModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setFilterModal(false)}
          >
            <div
              className="bg-card border border-border rounded-lg max-w-md w-full overflow-hidden shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-foreground text-lg font-semibold leading-tight">Filtrar por empresa</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Escolha uma empresa para filtrar os membros exibidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterModal(false)}
                    className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Fechar modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas as empresas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompanyFilter('')}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setFilterModal(false)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
      )}

      {avatarCropperFile && (
        <ImageCropperModal
          file={avatarCropperFile}
          aspectRatio={1}
          targetWidth={512}
          targetHeight={512}
          circle
          onCancel={() => setAvatarCropperFile(null)}
          onCrop={(cropped) => {
            setAvatarCropperFile(null);
            uploadPartnerAvatarFile(cropped);
          }}
        />
      )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-sm">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Nenhum membro cadastrado na sua equipe</h3>
            <p className="text-muted-foreground">Comece cadastrando o primeiro membro da sua equipe</p>
          </div>
        ) : (
          <>
            {viewMode === 'card' ? (
              <>
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span>
                    Exibindo {groupStart}-{groupEnd} de {groupedEntries.length} grupos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGroupPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentGroupPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="text-foreground">
                      Página {currentGroupPage} de {totalGroupPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGroupPage((prev) => Math.min(totalGroupPages, prev + 1))}
                      disabled={currentGroupPage >= totalGroupPages}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedGroups.map(({ companyName, members }) => (
                    <div key={companyName} className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">{companyName}</p>
                      {members.map((partner) => (
                        <div key={partner.id} className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                              {partner.avatarUrl ? (
                                <img
                                  src={partner.avatarUrl}
                                  alt={formatFullName(partner.name, partner.lastName)}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Users className="w-6 h-6 text-blue-600" />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openModal(partner)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(partner.id)}
                                className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <h3 className="text-foreground mb-2">{formatFullName(partner.name, partner.lastName)}</h3>
                          <div className="space-y-1 text-sm mb-3 text-muted-foreground">
                            <p>Email: {partner.email}</p>
                            <p>WhatsApp: {partner.whatsapp}</p>
                            <p>CPF: {partner.cpf}</p>
                            <p>Empresa: {getCompanyName(partner.companyId)}</p>
                          </div>
                          <span className={`inline-block px-3 py-1 rounded-full text-sm ${getRoleBadgeColor(partner.role)}`}>
                            {normalizeRoleValue(partner.role)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {sortedPartners.map((partner) => (
                  <div
                    key={partner.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openModal(partner)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openModal(partner);
                      }
                    }}
                    className="w-full text-left px-4 py-3 sm:px-6 sm:py-4 hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {partner.avatarUrl ? (
                            <img
                              src={partner.avatarUrl}
                              alt={formatFullName(partner.name, partner.lastName)}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <span className="text-foreground font-medium">
                          {formatFullName(partner.name, partner.lastName)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(partner);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(partner.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
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
                        {editingPartner ? 'Editar Membro' : 'Cadastrar Membro'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {editingPartner
                          ? 'Atualize os dados do membro da equipe.'
                          : 'Adicione um novo gerente ou vendedor à sua equipe.'}
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
                  <label className="block text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    required
                    disabled={!!editingPartner}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground mb-2">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf || ''}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    placeholder="000.000.000-00"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Os 6 primeiros dígitos serão usados como senha
                  </p>
                </div>

                <div>
                  <label className="block text-foreground mb-2">Papel</label>
                  <select
                    value={formData.role || 'vendedor'}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        role: nextRole,
                        companyId: roleRequiresCompany(nextRole) ? prev.companyId || '' : null,
                      }));
                    }}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                    required
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {roleRequiresCompany(formData.role) && !isCompany && !isManager && (
                <div>
                  <label className="block text-foreground mb-2">Empresa vinculada</label>
                  <select
                    value={(formData.companyId as string) || ''}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Selecione uma empresa...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {companies.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      Cadastre uma empresa antes de vincular membros.
                    </p>
                  )}
                </div>
              )}

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
                      <Users className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors w-full text-left"
                      >
                        Escolher arquivo
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handlePartnerAvatarFileSelection}
                        className="sr-only"
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
                        className="mt-2 text-sm text-red-600 hover:underline"
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
                    <LoadingDots label={editingPartner ? 'Salvando' : 'Cadastrando'} />
                  ) : editingPartner ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
	              </div>
	            </div>
	          )}
	        </>
	      )}
	    </Layout>
	  );
}
