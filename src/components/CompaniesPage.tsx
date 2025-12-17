import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from './Layout';
import { Plus, Edit, Trash2, Search, Building2, LayoutGrid, List, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { LoadingDots } from './LoadingDots';
import { useTheme } from '../utils/theme';
import { normalizeHexColor } from '../utils/cardBaseColor';
import { fetchCnpjaOffice, isValidCnpj, officeToCompanyFields, onlyDigits, formatCnpj } from '../utils/cnpj';
import { ImageCropperModal } from './ImageCropperModal';
import { readEnumParam, readIntParam, readTrimmedStringParam, writeQueryParamsPatch } from '../utils/urlQuery';

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

type SocioeconomicProfile = {
  ageRange?: string;
  gender?: string;
  maritalStatus?: string;
  children?: string;
  incomeClass?: string;
  education?: string;
  interests?: string[];
};

interface CompaniesPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const getDefaultViewMode = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'card');

const COMPANIES_QUERY_KEYS = {
  search: 'cmp_q',
  view: 'cmp_view',
  page: 'cmp_page',
} as const;

const SOCIO_AGE_RANGES = [
  'Até 17',
  '18–24',
  '25–34',
  '35–44',
  '45–54',
  '55–64',
  '65+',
];

const SOCIO_GENDERS = [
  'Feminino',
  'Masculino',
  'Não-binário',
  'Outro',
  'Prefere não dizer',
];

const SOCIO_MARITAL_STATUS = [
  'Solteiro(a)',
  'Casado(a)',
  'União estável',
  'Divorciado(a)',
  'Viúvo(a)',
  'Prefere não dizer',
];

const SOCIO_CHILDREN = [
  'Não',
  'Sim (1)',
  'Sim (2)',
  'Sim (3+)',
  'Prefere não dizer',
];

const SOCIO_INCOME_CLASS = [
  'Classe A',
  'Classe B',
  'Classe C',
  'Classe D/E',
  'Prefere não dizer',
];

const SOCIO_EDUCATION = [
  'Fundamental',
  'Médio',
  'Superior',
  'Pós-graduação',
  'Mestrado/Doutorado',
  'Prefere não dizer',
];

const SOCIO_INTERESTS = [
  'Gastronomia',
  'Música',
  'Esportes',
  'Tecnologia',
  'Saúde',
  'Moda',
  'Viagens',
  'Beleza',
  'Filmes e séries',
  'Games',
  'Sustentabilidade',
  'Família',
  'Educação',
];

export function CompaniesPage({ user, accessToken, onNavigate, onLogout }: CompaniesPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();
  const companiesQuery = useQuery<Company[]>({
    queryKey: ['companies', accessToken],
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar empresas');
      return Array.isArray(data.companies) ? data.companies : [];
    },
  });
  const companies = companiesQuery.data || [];
  const companiesLoading = companiesQuery.isPending && companies.length === 0;
  const companiesError = companiesQuery.isError
    ? ((companiesQuery.error as any)?.message || 'Erro ao carregar empresas')
    : '';

  const partnersQuery = useQuery<any[]>({
    queryKey: ['partners', accessToken],
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar equipe');
      return Array.isArray(data.partners) ? data.partners : [];
    },
  });
  const partners = partnersQuery.data || [];

  const surveysQuery = useQuery<any[]>({
    queryKey: ['surveys', accessToken],
    enabled: !!accessToken && String(user?.role || '').toLowerCase() === 'admin',
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar questionários');
      return Array.isArray(data.surveys) ? data.surveys : [];
    },
  });
  const surveys = surveysQuery.data || [];

  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyWizardMode, setCompanyWizardMode] = useState<'create' | 'edit'>('create');
  const [companyWizardStep, setCompanyWizardStep] = useState<1 | 2 | 3>(1);
  const initialUrlState = useMemo(
    () => ({
      searchTerm: readTrimmedStringParam(COMPANIES_QUERY_KEYS.search),
      viewMode: readEnumParam(COMPANIES_QUERY_KEYS.view, ['card', 'list'] as const, getDefaultViewMode()),
      cardPage: readIntParam(COMPANIES_QUERY_KEYS.page, 1, { min: 1 }),
    }),
    []
  );
  const [searchTerm, setSearchTerm] = useState(initialUrlState.searchTerm);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cnpjaLoading, setCnpjaLoading] = useState(false);
  const [cnpjaError, setCnpjaError] = useState<string>('');
  const [socioError, setSocioError] = useState<string>('');
  const [partnerWizardError, setPartnerWizardError] = useState<string>('');
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [logoCropperFile, setLogoCropperFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(initialUrlState.viewMode);
  const [cardPage, setCardPage] = useState(initialUrlState.cardPage);
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
    socioeconomicProfile: {
      ageRange: '',
      gender: '',
      maritalStatus: '',
      children: '',
      incomeClass: '',
      education: '',
      interests: [],
    },
  });

  const [partnerFormData, setPartnerFormData] = useState<{
    name: string;
    lastName: string;
    whatsapp: string;
    email: string;
    cpf: string;
    role: string;
  }>({
    name: '',
    lastName: '',
    whatsapp: '',
    email: '',
    cpf: '',
    role: 'vendedor',
  });

  useEffect(() => {
    writeQueryParamsPatch({
      [COMPANIES_QUERY_KEYS.search]: searchTerm || null,
      [COMPANIES_QUERY_KEYS.view]: viewMode,
      [COMPANIES_QUERY_KEYS.page]: cardPage > 1 ? String(cardPage) : null,
    });
  }, [cardPage, searchTerm, viewMode]);

  useEffect(() => {
    setCardPage(1);
  }, [searchTerm, viewMode]);

  const surveyNameById = surveys.reduce<Record<string, string>>((acc, s) => {
    acc[s.id] = s.title;
    return acc;
  }, {});

  const normalizeCardBaseColor = (input: any) => {
    if (typeof input !== 'string') return undefined;
    const trimmed = input.trim();
    const isHex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
    if (!trimmed || !isHex) return undefined;
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  };

  const getCompanyIdForWizard = () => editingCompany?.id || '';

  const getSocioProfile = (): SocioeconomicProfile => {
    const profile = (formData.socioeconomicProfile || {}) as SocioeconomicProfile;
    return {
      ageRange: profile.ageRange || '',
      gender: profile.gender || '',
      maritalStatus: profile.maritalStatus || '',
      children: profile.children || '',
      incomeClass: profile.incomeClass || '',
      education: profile.education || '',
      interests: Array.isArray(profile.interests) ? profile.interests : [],
    };
  };

  const updateSocioProfile = (patch: Partial<SocioeconomicProfile>) => {
    setFormData((prev) => ({
      ...prev,
      socioeconomicProfile: {
        ...(prev.socioeconomicProfile || {}),
        ...patch,
      },
    }));
  };

  const saveCompany = async (payload: any, companyId?: string) => {
    const url = companyId
      ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies/${companyId}`
      : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`;

    const response = await fetch(url, {
      method: companyId ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Erro ao salvar empresa');
    }
    return data?.company as Company;
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (companyWizardStep === 3) return;
    setSaving(true);
    setSocioError('');
    try {
      const companyId = getCompanyIdForWizard();

      if (companyWizardStep === 1) {
        const payload: any = { ...formData };
        delete payload.socioeconomicProfile;
        const normalizedCard = normalizeCardBaseColor(payload.cardBaseColor);
        if (normalizedCard) payload.cardBaseColor = normalizedCard;
        else delete payload.cardBaseColor;

        const saved = await saveCompany(payload, companyId || undefined);
        setEditingCompany(saved);
        setFormData((prev) => ({ ...prev, ...saved }));
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
        setCompanyWizardStep(2);
        return;
      }

      if (companyWizardStep === 2) {
        if (!companyId) {
          setSocioError('Salve os dados cadastrais antes de preencher o perfil socioeconômico.');
          return;
        }
        const payload = { socioeconomicProfile: getSocioProfile() };
        const saved = await saveCompany(payload, companyId);
        setEditingCompany(saved);
        setFormData((prev) => ({ ...prev, ...saved }));
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
        setCompanyWizardStep(3);
      }
    } catch (error: any) {
      console.error('Error saving company wizard:', error);
      alert(error?.message || 'Erro ao salvar empresa');
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
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
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

  const uploadLogoFile = async (file: File) => {
    setLogoUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
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

  const handleLogoFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoCropperFile(file);
  };

	  const openModal = (company?: Company) => {
      setCnpjaLoading(false);
      setCnpjaError('');
      setSocioError('');
      setPartnerWizardError('');
      setPartnerSaving(false);
      setCompanyWizardStep(1);
	    if (company) {
        setCompanyWizardMode('edit');
	      setEditingCompany(company);
	      setFormData({
          ...company,
          socioeconomicProfile: {
            ageRange: '',
            gender: '',
            maritalStatus: '',
            children: '',
            incomeClass: '',
            education: '',
            interests: [],
            ...(company.socioeconomicProfile || {}),
          },
        });
	    } else {
        setCompanyWizardMode('create');
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
          socioeconomicProfile: {
            ageRange: '',
            gender: '',
            maritalStatus: '',
            children: '',
            incomeClass: '',
            education: '',
            interests: [],
          },
	      });
	    }
      setPartnerFormData({
        name: '',
        lastName: '',
        whatsapp: '',
        email: '',
        cpf: '',
        role: 'vendedor',
      });
	    setShowModal(true);
	  };

	  const closeModal = () => {
	    setShowModal(false);
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
        socioeconomicProfile: {
          ageRange: '',
          gender: '',
          maritalStatus: '',
          children: '',
          incomeClass: '',
          education: '',
          interests: [],
        },
      });
	    setSaving(false);
      setCnpjaLoading(false);
      setCnpjaError('');
      setSocioError('');
      setPartnerWizardError('');
      setPartnerSaving(false);
      setCompanyWizardStep(1);
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

  const searchDigits = onlyDigits(searchTerm);
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (searchDigits.length > 0 && onlyDigits(company.cnpj).includes(searchDigits)) ||
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
  const companyIdForWizard = getCompanyIdForWizard();
  const socioProfile = getSocioProfile();
  const companyPartners = companyIdForWizard
    ? partners.filter((p) => String(p?.companyId || '') === companyIdForWizard)
    : [];
  const canGoToSocio = !!companyIdForWizard;
  const canGoToPartners = !!companyIdForWizard;

  const currentRole = (user?.role || '').toString().trim().toLowerCase();
  const isSellerRole = currentRole === 'vendedor' || currentRole === 'seller';
  const isManagerRole = currentRole === 'gerente' || currentRole === 'manager';
  const isCompanyRole = currentRole === 'empresa' || currentRole === 'company';

  const partnerRoleOptions = (() => {
    if (isManagerRole) return [{ value: 'vendedor', label: 'Vendedor' }];
    if (isCompanyRole) {
      return [
        { value: 'gerente', label: 'Gerente' },
        { value: 'vendedor', label: 'Vendedor' },
      ];
    }
    return [
      { value: 'gerente', label: 'Gerente' },
      { value: 'vendedor', label: 'Vendedor' },
    ];
  })();

  const createPartnerFromWizard = async () => {
    if (isSellerRole) {
      setPartnerWizardError('Você não tem permissão para cadastrar membros da equipe.');
      return;
    }
    if (!companyIdForWizard) {
      setPartnerWizardError('Salve a empresa antes de cadastrar parceiros.');
      return;
    }

    const payload: any = {
      ...partnerFormData,
      companyId: companyIdForWizard,
    };

    const requiredFields: Array<keyof typeof payload> = ['name', 'email', 'cpf', 'role', 'whatsapp'];
    for (const field of requiredFields) {
      if (!String(payload[field] || '').trim()) {
        setPartnerWizardError('Preencha nome, email, CPF, WhatsApp e perfil.');
        return;
      }
    }

    setPartnerSaving(true);
    setPartnerWizardError('');
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPartnerWizardError(data?.error || 'Erro ao cadastrar parceiro.');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['partners'] });
      setPartnerFormData({
        name: '',
        lastName: '',
        whatsapp: '',
        email: '',
        cpf: '',
        role: partnerRoleOptions.find((opt) => opt.value === 'vendedor')?.value || 'vendedor',
      });
    } catch (err: any) {
      console.error('Error creating partner (wizard):', err);
      setPartnerWizardError(err?.message || 'Erro ao cadastrar parceiro.');
    } finally {
      setPartnerSaving(false);
    }
  };

  const lookupCompanyByCnpj = async () => {
    const digits = onlyDigits(String(formData.cnpj || ''));
    if (!isValidCnpj(digits)) {
      setCnpjaError('CNPJ inválido. Verifique e tente novamente.');
      return;
    }

    setCnpjaLoading(true);
    setCnpjaError('');
    try {
      const office = await fetchCnpjaOffice(digits);
      const fields = officeToCompanyFields(office);

      setFormData((prev) => ({
        ...prev,
        cnpj: fields.cnpj || prev.cnpj,
        name: prev.name ? prev.name : fields.name || prev.name,
        legalName: prev.legalName ? prev.legalName : fields.legalName || prev.legalName,
        address: prev.address ? prev.address : fields.address || prev.address,
        phone: prev.phone ? prev.phone : fields.phone || prev.phone,
        email: prev.email ? prev.email : fields.email || prev.email,
      }));
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('HTTP 429')) {
        setCnpjaError('Limite de consultas atingido (CNPJa). Aguarde um minuto e tente novamente.');
      } else if (msg.includes('HTTP 404')) {
        setCnpjaError('CNPJ não encontrado no CNPJa.');
      } else {
        setCnpjaError('Não foi possível buscar os dados do CNPJ. Tente novamente.');
      }
      console.error('CNPJa lookup error:', error);
    } finally {
      setCnpjaLoading(false);
    }
  };

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

        {companiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : companiesError ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-sm">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Erro ao carregar empresas</h3>
            <p className="text-muted-foreground mb-6">{companiesError}</p>
            <button
              type="button"
              onClick={() => companiesQuery.refetch()}
              className="px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Tentar novamente
            </button>
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
                          <p>CNPJ: {formatCnpj(company.cnpj)}</p>
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
	                    {companyWizardMode === 'create' ? 'Nova Empresa' : 'Editar Empresa'}
	                  </h3>
	                  <p className="text-sm text-muted-foreground mt-1">
	                    {companyWizardMode === 'edit'
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

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCompanyWizardStep(1)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                      companyWizardStep === 1
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">1.</span> Dados cadastrais
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyWizardStep(2)}
                    disabled={!canGoToSocio}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                      companyWizardStep === 2
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                    title={!canGoToSocio ? 'Salve a empresa primeiro' : 'Perfil socioeconômico'}
                  >
                    <span className="font-medium">2.</span> Perfil socioeconômico
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyWizardStep(3)}
                    disabled={!canGoToPartners}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                      companyWizardStep === 3
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                    title={!canGoToPartners ? 'Salve a empresa primeiro' : 'Cadastro de parceiros'}
                  >
                    <span className="font-medium">3.</span> Parceiros (equipe)
                  </button>
                </div>
	            </div>

	            <form onSubmit={handleWizardSubmit} className="p-4 sm:p-6 space-y-4">
                {companyWizardStep === 1 && (
                  <div className="space-y-4">
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
                  <div className="flex items-stretch gap-2">
                    <input
                      type="text"
                      value={formData.cnpj || ''}
                      onChange={(e) => {
                        setCnpjaError('');
                        setFormData({ ...formData, cnpj: e.target.value });
                      }}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                      required
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={lookupCompanyByCnpj}
                      disabled={cnpjaLoading}
                      className="px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      title="Buscar dados da empresa pelo CNPJ (CNPJa)"
                    >
                      {cnpjaLoading ? <LoadingDots label="Buscando" /> : 'Buscar'}
                    </button>
                  </div>
                  {cnpjaError ? (
                    <p className="text-sm text-destructive mt-2">{cnpjaError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      Busca dados no CNPJa (limite ~5 consultas/min por IP). Não sobrescreve campos já preenchidos.
                    </p>
                  )}
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
                        onChange={handleLogoFileSelection}
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

                  </div>
                )}

                {companyWizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-sm text-muted-foreground">Etapa opcional</p>
                      <p className="text-foreground font-medium mt-1">
                        Perfil socioeconômico do cliente
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Descreve o perfil esperado do cliente (persona). Preencha apenas o que fizer sentido.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-foreground mb-2">Idade (faixa)</label>
                        <select
                          value={socioProfile.ageRange || ''}
                          onChange={(e) => updateSocioProfile({ ageRange: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_AGE_RANGES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-2">Gênero (quando relevante)</label>
                        <select
                          value={socioProfile.gender || ''}
                          onChange={(e) => updateSocioProfile({ gender: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_GENDERS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-2">Estado civil</label>
                        <select
                          value={socioProfile.maritalStatus || ''}
                          onChange={(e) => updateSocioProfile({ maritalStatus: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_MARITAL_STATUS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-2">Filhos</label>
                        <select
                          value={socioProfile.children || ''}
                          onChange={(e) => updateSocioProfile({ children: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_CHILDREN.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-2">Renda média / classe econômica</label>
                        <select
                          value={socioProfile.incomeClass || ''}
                          onChange={(e) => updateSocioProfile({ incomeClass: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_INCOME_CLASS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-2">Escolaridade</label>
                        <select
                          value={socioProfile.education || ''}
                          onChange={(e) => updateSocioProfile({ education: e.target.value })}
                          className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Não informado</option>
                          {SOCIO_EDUCATION.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-foreground mb-2">Interesses</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SOCIO_INTERESTS.map((interest) => {
                          const selected = (socioProfile.interests || []).includes(interest);
                          return (
                            <label
                              key={interest}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-card text-foreground border-border hover:bg-muted'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="accent-current"
                                checked={selected}
                                onChange={() => {
                                  const current = socioProfile.interests || [];
                                  const next = selected
                                    ? current.filter((i) => i !== interest)
                                    : [...current, interest];
                                  updateSocioProfile({ interests: next });
                                }}
                              />
                              <span className="text-sm">{interest}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Você pode selecionar nenhum, um ou vários.</p>
                    </div>

                    {socioError && <p className="text-sm text-destructive">{socioError}</p>}
                  </div>
                )}

                {companyWizardStep === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-sm text-muted-foreground">Etapa opcional</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Você pode cadastrar a equipe agora ou depois na tela <span className="text-foreground font-medium">Equipe</span>.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4">
                      <h4 className="text-foreground font-semibold mb-3">Cadastrar parceiro</h4>

                      {isSellerRole ? (
                        <p className="text-sm text-muted-foreground">
                          Você não tem permissão para cadastrar membros da equipe.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-foreground mb-2">Nome</label>
                              <input
                                type="text"
                                value={partnerFormData.name}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                                placeholder="Ex: Maria"
                              />
                            </div>

                            <div>
                              <label className="block text-foreground mb-2">Sobrenome</label>
                              <input
                                type="text"
                                value={partnerFormData.lastName}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                                placeholder="Ex: Silva"
                              />
                            </div>

                            <div>
                              <label className="block text-foreground mb-2">WhatsApp</label>
                              <input
                                type="text"
                                value={partnerFormData.whatsapp}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, whatsapp: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                                placeholder="(11) 99999-9999"
                              />
                            </div>

                            <div>
                              <label className="block text-foreground mb-2">Email</label>
                              <input
                                type="email"
                                value={partnerFormData.email}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                                placeholder="email@empresa.com"
                              />
                            </div>

                            <div>
                              <label className="block text-foreground mb-2">CPF</label>
                              <input
                                type="text"
                                value={partnerFormData.cpf}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, cpf: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                                placeholder="000.000.000-00"
                              />
                            </div>

                            <div>
                              <label className="block text-foreground mb-2">Perfil</label>
                              <select
                                value={partnerFormData.role}
                                onChange={(e) => setPartnerFormData((prev) => ({ ...prev, role: e.target.value }))}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary"
                              >
                                {partnerRoleOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {partnerWizardError && (
                            <p className="text-sm text-destructive mt-3">{partnerWizardError}</p>
                          )}

                          <div className="flex flex-col sm:flex-row gap-3 mt-4">
                            <button
                              type="button"
                              onClick={createPartnerFromWizard}
                              disabled={partnerSaving}
                              className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                              {partnerSaving ? <LoadingDots label="Cadastrando" /> : 'Cadastrar parceiro'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                closeModal();
                                onNavigate('partners');
                              }}
                              className="w-full sm:w-auto px-5 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                              Abrir Equipe
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-card p-4">
                      <h4 className="text-foreground font-semibold mb-3">Equipe desta empresa</h4>
                      {companyPartners.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum parceiro cadastrado para esta empresa ainda.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {companyPartners.map((p: any) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm text-foreground font-medium truncate">
                                  {String(p?.name || '')} {String(p?.lastName || '')}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {String(p?.email || '')}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted text-foreground capitalize">
                                {String(p?.role || '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-border">
                  {companyWizardStep === 1 ? (
                    <>
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
                        {saving ? <LoadingDots label={companyIdForWizard ? 'Salvando' : 'Cadastrando'} /> : 'Próximo'}
                      </button>
                    </>
                  ) : companyWizardStep === 2 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCompanyWizardStep(1)}
                        className="w-full sm:flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompanyWizardStep(3)}
                        className="w-full sm:flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        Pular
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                      >
                        {saving ? <LoadingDots label="Salvando" /> : 'Salvar e avançar'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCompanyWizardStep(2)}
                        className="w-full sm:flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await Promise.all([
                            queryClient.invalidateQueries({ queryKey: ['companies'] }),
                            queryClient.invalidateQueries({ queryKey: ['partners'] }),
                            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] }),
                          ]);
                          closeModal();
                        }}
                        className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Concluir
                      </button>
                    </>
                  )}
                </div>
	            </form>
          </div>
        </div>
      )}

      {logoCropperFile && (
        <ImageCropperModal
          file={logoCropperFile}
          aspectRatio={1}
          targetWidth={512}
          targetHeight={512}
          onCancel={() => setLogoCropperFile(null)}
          onCrop={(cropped) => {
            setLogoCropperFile(null);
            uploadLogoFile(cropped);
          }}
        />
      )}
    </Layout>
  );
}
