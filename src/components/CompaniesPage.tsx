import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, Building2, LayoutGrid, List, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { LoadingDots } from './LoadingDots';
import { useTheme } from '../utils/theme';
import { normalizeHexColor } from '../utils/cardBaseColor';

interface Company {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  instagram?: string;
  website?: string;
  logoPath?: string;
  logoUrl?: string;
  standardPdfPath?: string;
  standardPdfUrl?: string;
  surveyMonkeyLink?: string;
  managers?: string[];
  sellers?: string[];
  socioeconomicProfile?: any;
  voucherValue?: number;
  cardBaseColor?: string;
  openingHours?: any;
  defaultSurveyId?: string;
}

interface CompaniesPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const getDefaultViewMode = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'card');

export function CompaniesPage({ user, accessToken, onNavigate, onLogout }: CompaniesPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => getDefaultViewMode());
  const [cardPage, setCardPage] = useState(1);
  const [logoErrorMap, setLogoErrorMap] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<Partial<Company>>({
    name: '',
    legalName: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    instagram: '',
    website: '',
    logoPath: '',
    logoUrl: '',
    surveyMonkeyLink: '',
    managers: [],
    sellers: [],
    voucherValue: 0,
    cardBaseColor: '',
    defaultSurveyId: '',
  });

  useEffect(() => {
    loadCompanies();
    loadPartners();
    if (user.role === 'admin') {
      loadSurveys();
    }
  }, []);

  useEffect(() => {
    setCardPage(1);
  }, [searchTerm, viewMode]);

  const surveyNameById = surveys.reduce<Record<string, string>>((acc, s) => {
    acc[s.id] = s.title;
    return acc;
  }, {});

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
    } finally {
      setLoading(false);
    }
  };

  const loadSurveys = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSurveys(data.surveys || []);
      }
    } catch (err) {
      console.error('Error loading surveys:', err);
    }
  };

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (typeof payload.cardBaseColor === 'string') {
        const trimmed = payload.cardBaseColor.trim();
        const isHex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
        if (!trimmed || !isHex) {
          delete payload.cardBaseColor;
        } else {
          payload.cardBaseColor = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
        }
      }

      const url = editingCompany
        ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies/${editingCompany.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`;

      const response = await fetch(url, {
        method: editingCompany ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadCompanies();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Erro ao salvar empresa');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        await loadCompanies();
      }
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('folder', 'standards');

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

      if (response.ok) {
        const data = await response.json();
        setFormData({
          ...formData,
          standardPdfPath: data.path,
          standardPdfUrl: data.url,
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const createCircularLogoFile = async (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024; // 5MB (antes do processamento)
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Formato inválido. Envie PNG, JPG ou WEBP.');
    }
    if (file.size > maxBytes) {
      throw new Error('Imagem muito grande. Envie uma imagem de até 5MB.');
    }

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

      return new File([blob], `logo-${Date.now()}.png`, { type: 'image/png' });
    } finally {
      URL.revokeObjectURL(src);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // permite selecionar o mesmo arquivo novamente
    e.target.value = '';
    if (!file) return;

    setLogoUploading(true);
    try {
      const processed = await createCircularLogoFile(file);
      const formDataUpload = new FormData();
      formDataUpload.append('file', processed);
      formDataUpload.append('folder', 'company-logos');

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
      if (!response.ok) throw new Error(data?.error || 'Erro ao fazer upload da logomarca');

      setFormData((prev) => ({
        ...prev,
        logoPath: data.path,
        logoUrl: data.url,
      }));
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert(error?.message || 'Erro ao fazer upload da logomarca');
    } finally {
      setLogoUploading(false);
    }
  };

	  const openModal = (company?: Company) => {
	    if (company) {
	      setEditingCompany(company);
	      setFormData(company);
	    } else {
	      setEditingCompany(null);
	      setFormData({
	        name: '',
	        legalName: '',
	        cnpj: '',
	        phone: '',
	        email: '',
	        address: '',
	        instagram: '',
	        website: '',
	        logoPath: '',
	        logoUrl: '',
	        surveyMonkeyLink: '',
	        managers: [],
	        sellers: [],
	        voucherValue: 0,
	        cardBaseColor: '',
	        defaultSurveyId: '',
	      });
	    }
	    setShowModal(true);
	  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({});
    setSaving(false);
  };

  const getInstagramAvatar = (instagram?: string) => {
    if (!instagram) return '';
    const handle = instagram
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .split(/[/?#]/)[0];
    if (!handle) return '';
    return `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/instagram-avatar?handle=${encodeURIComponent(handle)}`;
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm)
  );

  const companiesPerPage = 15;
  const totalCompanyPages = Math.max(1, Math.ceil(filteredCompanies.length / companiesPerPage));
  const currentCompanyPage = Math.min(cardPage, totalCompanyPages);
  const paginatedCompanies = viewMode === 'card'
    ? filteredCompanies.slice((currentCompanyPage - 1) * companiesPerPage, currentCompanyPage * companiesPerPage)
    : filteredCompanies;
  const cardStart = (currentCompanyPage - 1) * companiesPerPage + 1;
  const cardEnd = Math.min(currentCompanyPage * companiesPerPage, filteredCompanies.length);

  const managers = partners.filter(p => p.role === 'gerente' || p.role === 'manager');
  const sellers = partners.filter(p => p.role === 'vendedor' || p.role === 'seller');
  const cardBaseColorPreview = normalizeHexColor(formData.cardBaseColor) || '#cfd1d4';

  return (
    <Layout user={user} currentPage="companies" onNavigate={onNavigate} onLogout={onLogout}>
      <div className={`max-w-7xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-foreground mb-2">Empresas</h2>
            <p className="text-muted-foreground">Gerencie as empresas cadastradas</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Nova Empresa
          </button>
        </div>

        {/* Search + View toggle */}
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
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
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-sm">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Nenhuma empresa cadastrada</h3>
            <p className="text-muted-foreground mb-6">Comece cadastrando sua primeira empresa</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Empresa
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'card' ? (
              <>
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span>
                    Exibindo {cardStart}-{cardEnd} de {filteredCompanies.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCardPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentCompanyPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Anterior
                    </button>
                    <span className="text-foreground">
                      Página {currentCompanyPage} de {totalCompanyPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCardPage((prev) => Math.min(totalCompanyPages, prev + 1))}
                      disabled={currentCompanyPage >= totalCompanyPages}
                      className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedCompanies.map((company) => (
                    <div key={company.id} className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        {(() => {
                          const logoSrc = !logoErrorMap[company.id]
                            ? company.logoUrl || getInstagramAvatar(company.instagram)
                            : '';
                          return logoSrc ? (
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-muted">
                              <img
                                src={logoSrc}
                                alt={`Logomarca ${company.name}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setLogoErrorMap((prev) => ({ ...prev, [company.id]: true }))
                                }
                              />
                            </div>
                          ) : (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <Building2 className="w-6 h-6 text-blue-600" />
                            </div>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal(company)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(company.id)}
                              className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-foreground mb-2">{company.name}</h3>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>CNPJ: {company.cnpj}</p>
                          <p>Email: {company.email}</p>
                          <p>Telefone: {company.phone}</p>
                          {company.voucherValue && (
                            <p>Voucher: R$ {company.voucherValue.toFixed(2)}</p>
                          )}
                          {company.defaultSurveyId && (
                            <p className="text-sm">
                              Questionário: {surveyNameById[company.defaultSurveyId] || company.defaultSurveyId}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-card border border-border rounded-lg divide-y divide-border">
                  {filteredCompanies.map((company) => (
                    <div
                      key={company.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openModal(company)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openModal(company);
                        }
                      }}
                      className="w-full text-left px-4 py-3 sm:px-6 sm:py-4 hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const logoSrc = !logoErrorMap[company.id]
                              ? company.logoUrl || getInstagramAvatar(company.instagram)
                              : '';
                            return logoSrc ? (
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-muted">
                                <img
                                  src={logoSrc}
                                  alt={`Logomarca ${company.name}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setLogoErrorMap((prev) => ({ ...prev, [company.id]: true }))
                                  }
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-50 border border-border flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-blue-600" />
                              </div>
                            );
                          })()}
                          <span className="text-foreground font-medium">{company.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(company);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(company.id);
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
	          <div className="bg-card text-foreground border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
	            <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 sm:px-6 sm:py-4">
	              <div className="flex items-start justify-between gap-3">
	                <div>
	                  <h3 className="text-foreground text-lg font-semibold leading-tight">
	                    {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
	                  </h3>
	                  <p className="text-sm text-muted-foreground mt-1">
	                    {editingCompany
	                      ? 'Atualize as informações da empresa.'
	                      : 'Cadastre uma nova empresa e configure os dados principais.'}
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
	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-foreground mb-2">Razão Social</label>
                  <input
                    type="text"
                    value={formData.legalName || ''}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-2">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj || ''}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-2">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
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
                  />
                </div>

	                <div>
	                  <label className="block text-foreground mb-2">Valor do Voucher (R$)</label>
	                  <input
	                    type="number"
	                    step="0.01"
	                    value={formData.voucherValue || ''}
	                    onChange={(e) => setFormData({ ...formData, voucherValue: parseFloat(e.target.value) })}
	                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
	                  />
	                </div>

		                <div>
			                  <label className="block text-foreground mb-2">Cor do cartão (base)</label>
			                  <div className="flex items-center gap-3">
		                    <label
		                      className="relative h-10 w-12 shrink-0 rounded-lg border border-border bg-input-background overflow-hidden cursor-pointer shadow-sm focus-within:ring-2 focus-within:ring-primary/40"
		                      title={cardBaseColorPreview}
		                    >
		                      <span className="absolute inset-0" style={{ background: cardBaseColorPreview }} />
			                      <span
			                        className="absolute inset-0 pointer-events-none opacity-20"
			                        style={{
			                          background:
			                            'radial-gradient(120% 120% at 20% 20%, rgba(255,255,255,0.9), transparent 55%)',
			                        }}
			                      />
			                      <span
			                        className="absolute inset-0 pointer-events-none opacity-14"
			                        style={{ background: 'linear-gradient(135deg, transparent 60%, rgba(0,0,0,0.18) 100%)' }}
			                      />
		                      <input
		                        type="color"
		                        value={cardBaseColorPreview}
		                        onChange={(e) => setFormData({ ...formData, cardBaseColor: e.target.value })}
		                        aria-label="Selecionar cor do cartão"
		                        className="absolute inset-0 opacity-0 cursor-pointer"
		                      />
		                    </label>
		                    <input
		                      type="text"
		                      value={formData.cardBaseColor || ''}
		                      onChange={(e) => setFormData({ ...formData, cardBaseColor: e.target.value })}
		                      placeholder="#cfd1d4 (padrão)"
		                      className="flex-1 px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary font-mono uppercase tracking-wide"
		                    />
		                    <button
		                      type="button"
		                      onClick={() => setFormData({ ...formData, cardBaseColor: '' })}
	                      className="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
	                    >
	                      Padrão
	                    </button>
	                  </div>
	                  <p className="text-xs text-muted-foreground mt-2">
	                    Define a cor principal do cartão exibido ao avaliador (os efeitos de iluminação permanecem).
	                  </p>
	                </div>
	              </div>

              <div>
                <label className="block text-foreground mb-2">Endereço</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground mb-2">Instagram</label>
                  <input
                    type="text"
                    value={formData.instagram || ''}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    placeholder="@empresa"
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground mb-2">Link SurveyMonkey</label>
                <input
                  type="url"
                  value={formData.surveyMonkeyLink || ''}
                  onChange={(e) => setFormData({ ...formData, surveyMonkeyLink: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-foreground mb-2">Logomarca</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {formData.logoUrl ? (
                      <img
                        src={String(formData.logoUrl)}
                        alt="Prévia da logomarca"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoUpload}
                        className="flex-1"
                      />
                      {logoUploading && (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      )}
                      {formData.logoPath && !logoUploading && (
                        <span className="text-green-500 text-sm">✓ Enviada</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      A imagem é recortada em formato circular e redimensionada (512×512), como foto de perfil.
                    </p>
                    {formData.logoPath && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, logoPath: '', logoUrl: '' }))}
                        className="mt-2 text-sm text-destructive hover:underline"
                      >
                        Remover logomarca
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {user.role === 'admin' && (
                <div>
                  <label className="block text-foreground mb-2">Questionário padrão</label>
                  <select
                    value={formData.defaultSurveyId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultSurveyId: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Nenhum</option>
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title}
                      </option>
                    ))}
                  </select>
                  {surveys.length === 0 && (
                    <p className="text-sm text-orange-500 mt-1">
                      Crie um questionário em "Questionários" para selecioná-lo aqui.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-foreground mb-2">Padrão de Atendimento (PDF)</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  {uploading && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  )}
                  {formData.standardPdfPath && (
                    <span className="text-green-500 text-sm">✓ Arquivo enviado</span>
                  )}
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
                  disabled={uploading || logoUploading || saving}
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <LoadingDots label={editingCompany ? 'Salvando' : 'Cadastrando'} />
                  ) : editingCompany ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
