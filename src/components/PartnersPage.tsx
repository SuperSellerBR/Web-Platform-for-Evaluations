import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, Users } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface Partner {
  id: string;
  name: string;
  whatsapp: string;
  email: string;
  cpf: string;
  role: string;
  companyId?: string | null;
  companies?: string[]; // legado
}

interface PartnersPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function PartnersPage({ user, accessToken, onNavigate, onLogout }: PartnersPageProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    whatsapp: '',
    email: '',
    cpf: '',
    role: 'vendedor',
    companyId: '',
  });

  useEffect(() => {
    loadPartners();
    loadCompanies();
  }, []);

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
      });
    } else {
      setEditingPartner(null);
      const defaultRole =
        roleOptions.find((opt) => opt.value === 'vendedor')?.value || roleOptions[0]?.value || 'vendedor';
      setFormData({
        name: '',
        whatsapp: '',
        email: '',
        cpf: '',
        role: defaultRole,
        companyId: (isCompany || isManager) ? (user?.companyId || '') : '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPartner(null);
    setFormData({});
  };

  const filteredPartners = partners
    .filter((partner) => (isSeller ? false : canEditPartner(partner)))
    .filter(partner =>
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

  const roleRequiresCompany = (role: string | undefined) => {
    const r = (role || '').toLowerCase();
    return ['empresa', 'company', 'gerente', 'manager', 'vendedor', 'seller'].includes(r);
  };

  return (
	    <Layout user={user} currentPage="partners" onNavigate={onNavigate} onLogout={onLogout}>
	      {isSeller ? (
	        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
	          <h2 className="text-gray-900 mb-2">Acesso restrito</h2>
	          <p className="text-gray-600">Seu perfil não possui permissão para acessar o cadastro da equipe.</p>
	        </div>
	      ) : (
	        <>
	          <div className="max-w-7xl mx-auto">
	            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
	              <div>
	                <h2 className="text-gray-900 mb-2">Equipe</h2>
	                <p className="text-gray-600">Gerencie gerentes e vendedores</p>
	              </div>
	              <button
	                onClick={() => openModal()}
	                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
	              >
	                <Plus className="w-5 h-5" />
	                Cadastrar Membro
	              </button>
	            </div>

        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
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
        ) : filteredPartners.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhum membro cadastrado na sua equipe</h3>
            <p className="text-gray-600">Comece cadastrando o primeiro membro da sua equipe</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredPartners.map((partner) => (
              <div key={partner.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-green-100 rounded-lg p-3">
                    <Users className="w-6 h-6 text-green-600" />
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
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-gray-900 mb-2">{partner.name}</h3>
                <div className="space-y-1 text-sm mb-3">
                  <p className="text-gray-600">Email: {partner.email}</p>
                  <p className="text-gray-600">WhatsApp: {partner.whatsapp}</p>
                  <p className="text-gray-600">CPF: {partner.cpf}</p>
                  <p className="text-gray-600">Empresa: {getCompanyName(partner.companyId)}</p>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm ${getRoleBadgeColor(partner.role)}`}>
                  {normalizeRoleValue(partner.role)}
                </span>
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
	                    {editingPartner ? 'Editar Membro' : 'Cadastrar Membro'}
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
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!!editingPartner}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-2">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf || ''}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="000.000.000-00"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Os 6 primeiros dígitos serão usados como senha
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Papel</label>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-gray-700 mb-2">Empresa vinculada</label>
                  <select
                    value={(formData.companyId as string) || ''}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  {editingPartner ? 'Salvar' : 'Cadastrar'}
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
