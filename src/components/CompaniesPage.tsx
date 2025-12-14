import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Upload, Search, Building2 } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

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
  openingHours?: any;
  defaultSurveyId?: string;
}

interface CompaniesPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function CompaniesPage({ user, accessToken, onNavigate, onLogout }: CompaniesPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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
    defaultSurveyId: '',
  });

  useEffect(() => {
    loadCompanies();
    loadPartners();
    if (user.role === 'admin') {
      loadSurveys();
    }
  }, []);

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
    
    try {
      const url = editingCompany
        ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies/${editingCompany.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`;

      const response = await fetch(url, {
        method: editingCompany ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
        defaultSurveyId: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({});
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj.includes(searchTerm)
  );

  const managers = partners.filter(p => p.role === 'gerente' || p.role === 'manager');
  const sellers = partners.filter(p => p.role === 'vendedor' || p.role === 'seller');

  return (
    <Layout user={user} currentPage="companies" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-gray-900 mb-2">Empresas</h2>
            <p className="text-gray-600">Gerencie as empresas cadastradas</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Nova Empresa
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou CNPJ..."
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
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhuma empresa cadastrada</h3>
            <p className="text-gray-600 mb-6">Comece cadastrando sua primeira empresa</p>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Cadastrar Empresa
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                {company.logoUrl ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={company.logoUrl}
                      alt={`Logomarca ${company.name}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="bg-blue-100 rounded-lg p-3">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(company)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-gray-900 mb-2">{company.name}</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">CNPJ: {company.cnpj}</p>
                  <p className="text-gray-600">Email: {company.email}</p>
                  <p className="text-gray-600">Telefone: {company.phone}</p>
                  {company.voucherValue && (
                    <p className="text-gray-600">
                      Voucher: R$ {company.voucherValue.toFixed(2)}
                    </p>
                  )}
                  {company.defaultSurveyId && (
                    <p className="text-gray-600 text-sm">
                      Questionário: {surveyNameById[company.defaultSurveyId] || company.defaultSurveyId}
                    </p>
                  )}
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
                {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Nome</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Razão Social</label>
                  <input
                    type="text"
                    value={formData.legalName || ''}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">CNPJ</label>
                  <input
                    type="text"
                    value={formData.cnpj || ''}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Telefone</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Valor do Voucher (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.voucherValue || ''}
                    onChange={(e) => setFormData({ ...formData, voucherValue: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Endereço</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">Instagram</label>
                  <input
                    type="text"
                    value={formData.instagram || ''}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="@empresa"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Link SurveyMonkey</label>
                <input
                  type="url"
                  value={formData.surveyMonkeyLink || ''}
                  onChange={(e) => setFormData({ ...formData, surveyMonkeyLink: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Logomarca</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {formData.logoUrl ? (
                      <img
                        src={String(formData.logoUrl)}
                        alt="Prévia da logomarca"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Building2 className="w-7 h-7 text-gray-400" />
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
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      )}
                      {formData.logoPath && !logoUploading && (
                        <span className="text-green-600 text-sm">✓ Enviada</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      A imagem é recortada em formato circular e redimensionada (512×512), como foto de perfil.
                    </p>
                    {formData.logoPath && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, logoPath: '', logoUrl: '' }))}
                        className="mt-2 text-sm text-red-600 hover:underline"
                      >
                        Remover logomarca
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {user.role === 'admin' && (
                <div>
                  <label className="block text-gray-700 mb-2">Questionário padrão</label>
                  <select
                    value={formData.defaultSurveyId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultSurveyId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nenhum</option>
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title}
                      </option>
                    ))}
                  </select>
                  {surveys.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      Crie um questionário em "Questionários" para selecioná-lo aqui.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2">Padrão de Atendimento (PDF)</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  {uploading && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  )}
                  {formData.standardPdfPath && (
                    <span className="text-green-600 text-sm">✓ Arquivo enviado</span>
                  )}
                </div>
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
                  disabled={uploading || logoUploading}
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingCompany ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
