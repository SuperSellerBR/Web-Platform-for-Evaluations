import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from './Layout';
import { WalletCardItem, WalletCardStack } from './WalletCardStack';
import {
  BrainCog,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  FilePenLine,
  LayoutGrid,
  List,
  Mic,
  Pencil,
  QrCode,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { formatFullName } from '../utils/name';
import { useTheme } from '../utils/theme';
import {
  encodeStringArrayParam,
  readEnumParam,
  readStringArrayParam,
  readTrimmedStringParam,
  writeQueryParamsPatch,
} from '../utils/urlQuery';

interface EvaluationsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string, id?: string) => void;
  onLogout: () => void;
}

function StatusIconButton(props: { done: boolean; aria: string; tooltip: string; Icon: any }) {
  const { done, aria, tooltip, Icon } = props;
  const [open, setOpen] = useState(false);

  const baseClasses =
    'inline-flex items-center justify-center h-9 w-9 rounded-full border transition-colors';
  const stateClasses = done
    ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-500/15 dark:border-green-500/30 dark:text-green-200'
    : 'bg-muted border-border text-muted-foreground dark:bg-input/40';

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`${baseClasses} ${stateClasses}`}
          aria-label={aria}
          data-no-nav
          onClick={() => setOpen((prev) => !prev)}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

const EVALUATIONS_QUERY_KEYS = {
  search: 'evals_q',
  company: 'evals_company',
  view: 'evals_view',
  from: 'evals_from',
  to: 'evals_to',
  period: 'evals_period',
  statuses: 'evals_statuses',
} as const;

const PERIOD_PRESETS = ['all', 'last1w', 'last4w', 'custom'] as const;
const VIEW_MODES = ['card', 'list'] as const;
const ALL_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;

export function EvaluationsPage({ user, accessToken, onNavigate, onLogout }: EvaluationsPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const queryClient = useQueryClient();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const initialUrlState = useMemo(() => {
    const searchTerm = readTrimmedStringParam(EVALUATIONS_QUERY_KEYS.search);
    const companyId = readTrimmedStringParam(EVALUATIONS_QUERY_KEYS.company);
    const viewMode = readEnumParam(EVALUATIONS_QUERY_KEYS.view, VIEW_MODES, 'list');
    const fromDate = readTrimmedStringParam(EVALUATIONS_QUERY_KEYS.from);
    const toDate = readTrimmedStringParam(EVALUATIONS_QUERY_KEYS.to);
    const presetFromUrl = readEnumParam(EVALUATIONS_QUERY_KEYS.period, PERIOD_PRESETS, 'all');
    const statusesFromUrl = readStringArrayParam(EVALUATIONS_QUERY_KEYS.statuses).filter((s) =>
      (ALL_STATUSES as readonly string[]).includes(s),
    );
    const selectedStatuses = statusesFromUrl.length ? statusesFromUrl : [...ALL_STATUSES];
    const periodPreset: (typeof PERIOD_PRESETS)[number] =
      (fromDate || toDate) && presetFromUrl === 'all' ? 'custom' : presetFromUrl;

    return { searchTerm, companyId, viewMode, fromDate, toDate, periodPreset, selectedStatuses };
  }, []);

  const [searchTerm, setSearchTerm] = useState(initialUrlState.searchTerm);
  const [companyId, setCompanyId] = useState(initialUrlState.companyId);
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>(initialUrlState.viewMode);
  const [fromDate, setFromDate] = useState(initialUrlState.fromDate);
  const [toDate, setToDate] = useState(initialUrlState.toDate);
  const [periodPreset, setPeriodPreset] = useState<(typeof PERIOD_PRESETS)[number]>(initialUrlState.periodPreset);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialUrlState.selectedStatuses);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState<any | null>(null);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [prefilterReady, setPrefilterReady] = useState(false);

  const role =
    (user?.role || user?.user_metadata?.role || user?.app_metadata?.role || '').toString().trim().toLowerCase();
  const isPartnerPortalRole = ['parceiro', 'partner', 'gerente', 'manager', 'vendedor', 'seller'].includes(role);
  const isSellerRole = role === 'vendedor' || role === 'seller';
  const canDelete = role === 'admin' || role === 'parceiro' || role === 'partner';
  const canEditSeller = role === 'admin';
  const hideCompanyFilter =
    role === 'empresa' ||
    role === 'company' ||
    role === 'gerente' ||
    role === 'manager' ||
    role === 'vendedor' ||
    role === 'seller' ||
    role === 'parceiro' ||
    role === 'partner';

  useEffect(() => {
    if (hideCompanyFilter) setCompanyId((user?.companyId || '').toString());
    setPrefilterReady(true);
  }, [hideCompanyFilter, user?.companyId]);

  useEffect(() => {
    if (!prefilterReady) return;
    writeQueryParamsPatch({
      [EVALUATIONS_QUERY_KEYS.search]: searchTerm || null,
      [EVALUATIONS_QUERY_KEYS.company]: companyId || null,
      [EVALUATIONS_QUERY_KEYS.view]: viewMode,
      [EVALUATIONS_QUERY_KEYS.from]: fromDate || null,
      [EVALUATIONS_QUERY_KEYS.to]: toDate || null,
      [EVALUATIONS_QUERY_KEYS.period]: periodPreset !== 'all' ? periodPreset : null,
      [EVALUATIONS_QUERY_KEYS.statuses]:
        isPartnerPortalRole || selectedStatuses.length >= ALL_STATUSES.length
          ? null
          : encodeStringArrayParam(selectedStatuses),
    });
  }, [companyId, fromDate, isPartnerPortalRole, periodPreset, prefilterReady, searchTerm, selectedStatuses, toDate, viewMode]);

  const companiesQuery = useQuery<any[]>({
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

  const companyById = useMemo(() => {
    const map = new Map<string, any>();
    companies.forEach((c: any) => map.set(String(c?.id), c));
    return map;
  }, [companies]);

  const evaluatorsQuery = useQuery<any[]>({
    queryKey: ['evaluators', accessToken],
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar avaliadores');
      return Array.isArray(data.evaluators) ? data.evaluators : [];
    },
  });
  const evaluators = evaluatorsQuery.data || [];

  const evaluatorById = useMemo(() => {
    const map = new Map<string, any>();
    evaluators.forEach((e: any) => map.set(String(e?.id), e));
    return map;
  }, [evaluators]);

  const evaluationsQuery = useQuery<any[]>({
    queryKey: ['evaluations', accessToken, companyId || 'all'],
    enabled: !!accessToken && prefilterReady,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations${params.toString() ? `?${params.toString()}` : ''}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar avaliações');
      return Array.isArray(data.evaluations) ? data.evaluations : [];
    },
  });
  const evaluations = evaluationsQuery.data || [];

  const loading = !prefilterReady || (evaluationsQuery.isPending && evaluations.length === 0);
  const pageError =
    evaluationsQuery.isError && evaluations.length === 0
      ? ((evaluationsQuery.error as any)?.message || 'Erro ao carregar avaliações')
      : '';

  useEffect(() => {
    setSelectedIds([]);
  }, [evaluations]);

  useEffect(() => {
    if (viewMode === 'card') setSelectedIds([]);
  }, [viewMode]);

  const getCompanyName = (companyId: string) => {
    const company = companyById.get(String(companyId));
    return company?.name || companyId || 'N/A';
  };

  const getEvaluatorName = (evaluatorId: string) => {
    const evaluator = evaluatorById.get(String(evaluatorId));
    return (
      formatFullName(evaluator?.name, (evaluator as any)?.lastName || (evaluator as any)?.last_name) ||
      evaluatorId ||
      'N/A'
    );
  };

  const parseNumber = (value: any) => {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const formatPtBrDate = (value: any) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  };

  const getSellerLabel = (evaluation: any) => {
    const legacy = (evaluation?.visitData?.vendors ?? '').toString().trim();
    if (!legacy || legacy === '-' || legacy.toLowerCase() === 'n/a') return 'Indefinido';
    return legacy;
  };

  const normalizeRoleValue = (value: any) => (value || '').toString().trim().toLowerCase();
  const isTeamMemberRole = (value: any) =>
    ['vendedor', 'seller', 'gerente', 'manager'].includes(normalizeRoleValue(value));

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: {
        label: 'Agendada',
        color:
          'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-100 dark:border-blue-500/30',
      },
      in_progress: {
        label: 'Em Andamento',
        color:
          'bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-500/30',
      },
      completed: {
        label: 'Concluída',
        color:
          'bg-green-50 text-green-800 border border-green-200 dark:bg-green-500/15 dark:text-green-100 dark:border-green-500/30',
      },
      cancelled: {
        label: 'Cancelada',
        color:
          'bg-red-50 text-red-800 border border-red-200 dark:bg-red-500/15 dark:text-red-100 dark:border-red-500/30',
      },
    };
    const badge =
      badges[status as keyof typeof badges] || {
        label: status,
        color: 'bg-muted text-foreground border border-border',
      };
    return badge;
  };

  const applyLast4Weeks = () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 28);
    setFromDate(past.toISOString().slice(0, 10));
    setToDate(today.toISOString().slice(0, 10));
    setPeriodPreset('last4w');
  };

  const applyLastWeek = () => {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 7);
    setFromDate(past.toISOString().slice(0, 10));
    setToDate(today.toISOString().slice(0, 10));
    setPeriodPreset('last1w');
  };

  const clearPeriod = () => {
    setFromDate('');
    setToDate('');
    setPeriodPreset('all');
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const has = prev.includes(status);
      const next = has ? prev.filter((s) => s !== status) : [...prev, status];
      if (next.length === 0) return prev;
      return next;
    });
  };

  const asStringIdArray = (value: any) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
    return [];
  };

  const isAssignedToSeller = (evaluation: any) => {
    const sellerId = (user?.partnerId || user?.id || '').toString().trim();
    if (!sellerId) return false;
    const sellers = asStringIdArray(evaluation?.visitData?.sellers);
    if (sellers.includes(sellerId)) return true;

    const vendorsRaw = (evaluation?.visitData?.vendors || '').toString();
    if (!vendorsRaw) return false;
    const vendorTokens = vendorsRaw
      .split(',')
      .map((v: any) => String(v || '').trim().toLowerCase())
      .filter(Boolean);
    const userName = String(user?.name || '').trim().toLowerCase();
    const userEmail = String(user?.email || '').trim().toLowerCase();
    return (
      (userName && vendorTokens.includes(userName)) ||
      (userEmail && vendorTokens.includes(userEmail)) ||
      vendorTokens.includes(sellerId.toLowerCase())
    );
  };

  const normalizeToYmd = (value: any) => {
    if (!value) return '';
    const s = String(value);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const matchesDateRange = (scheduledDate: any) => {
    if (!fromDate && !toDate) return true;
    const ymd = normalizeToYmd(scheduledDate);
    if (!ymd) return true;
    if (fromDate && ymd < fromDate) return false;
    if (toDate && ymd > toDate) return false;
    return true;
  };

  const isInteractiveTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el || typeof (el as any).closest !== 'function') return false;
    return !!el.closest('button, a, input, select, textarea, [data-no-nav]');
  };

  const filteredEvaluations = evaluations
    .filter(evaluation => {
      const matchesSearch = 
        getCompanyName(evaluation.companyId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEvaluatorName(evaluation.evaluatorId).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCompany = !companyId || String(evaluation.companyId) === String(companyId);
      const effectiveStatuses = isPartnerPortalRole
        ? (['completed'] as string[])
        : selectedStatuses.length
          ? selectedStatuses
          : [...ALL_STATUSES];
      const matchesStatus = effectiveStatuses.includes(evaluation.status);
      const matchesPeriod = matchesDateRange(evaluation.scheduledDate);
      const matchesSeller = !isSellerRole || isAssignedToSeller(evaluation);
      
      return matchesSearch && matchesCompany && matchesStatus && matchesPeriod && matchesSeller;
    })
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  const walletItems: WalletCardItem[] = useMemo(() => {
    if (viewMode !== 'card') return [];
    return filteredEvaluations.map((evaluation) => {
      const companyIdValue = String(evaluation?.companyId || '');
      const evaluatorIdValue = String(evaluation?.evaluatorId || '');
      const company = companyById.get(companyIdValue);
      const evaluator = evaluatorById.get(evaluatorIdValue);
      const companyName = (company?.name || companyIdValue || 'N/A') as string;
      const evaluatorName =
        formatFullName(
          evaluator?.name,
          (evaluator as any)?.lastName || (evaluator as any)?.last_name,
        ) ||
        evaluatorIdValue ||
        'N/A';

      const vendorsRaw = (evaluation?.visitData?.vendors ?? '').toString().trim();
      const sellerLabel =
        vendorsRaw && vendorsRaw !== '-' && vendorsRaw.toLowerCase() !== 'n/a'
          ? vendorsRaw
          : '-';

      const overallScore100 = (() => {
        const n = parseNumber(evaluation?.aiAnalysis?.overallScore);
        if (n == null) return null;
        const normalized = n <= 10 ? n * 10 : n;
        return Math.round(normalized);
      })();

      const npsScore = (() => {
        const n = parseNumber(evaluation?.aiAnalysis?.npsScore);
        if (n == null) return null;
        const normalized = n > 10 ? n / 10 : n;
        return Math.round(normalized);
      })();

      const metrics: WalletCardItem['metrics'] = [];
      if (overallScore100 != null) metrics.push({ key: 'overall', label: 'Pontuação Geral', value: `${overallScore100}/100` });
      if (npsScore != null) metrics.push({ key: 'nps', label: 'NPS', value: String(npsScore) });

      const voucherDone = !!evaluation.voucherValidated;
      const surveyDone =
        evaluation.stage === 'survey_submitted' ||
        !!evaluation.surveyResponseId ||
        !!evaluation.surveyData?.answers?.length;
      const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
      const aiDone = !!evaluation.aiAnalysis;

      return {
        id: String(evaluation?.id),
        companyName,
        logoUrl: company?.logoUrl || (company as any)?.logo_url,
        baseColor: company?.cardBaseColor || (company as any)?.card_base_color,
        dateLabel: formatPtBrDate(evaluation?.scheduledDate),
        voucherCode: evaluation?.voucherCode,
        voucherValue: null,
        evaluatorName,
        secondaryLabel: 'Vendedor',
        secondaryValue: sellerLabel,
        metrics,
        accentSeed: company?.name || company?.id || String(evaluation?.id || ''),
        companyDisplay: companyName || 'Empresa',
        statuses: [
          { key: 'voucher', label: `Voucher: ${voucherDone ? 'validado' : 'pendente'}`, done: voucherDone, Icon: QrCode },
          { key: 'survey', label: `Questionário: ${surveyDone ? 'enviado' : 'pendente'}`, done: surveyDone, Icon: FilePenLine },
          { key: 'audio', label: `Áudio: ${audioDone ? 'enviado' : 'pendente'}`, done: audioDone, Icon: Mic },
          { key: 'ai', label: `IA: ${aiDone ? 'processada' : 'pendente'}`, done: aiDone, Icon: BrainCog },
        ],
      };
    });
  }, [companyById, evaluatorById, filteredEvaluations, viewMode]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const deleteSelected = async () => {
    if (!canDelete || selectedIds.length === 0) return;
    const confirmDelete = window.confirm(`Excluir ${selectedIds.length} avaliação(ões)?`);
    if (!confirmDelete) return;
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${id}`,
            { method: 'DELETE', headers },
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Falha ao excluir avaliação ${id}`);
          }
          return id;
        }),
      );
      // Remoção otimista no front; loadData mantém consistência
      setSelectedIds([]);
      queryClient.setQueriesData({ queryKey: ['evaluations'] }, (prev: unknown) => {
        if (!Array.isArray(prev)) return prev;
        return prev.filter((e: any) => !results.includes(e?.id));
      });
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    } catch (err) {
      console.error('Error deleting evaluations:', err);
      alert((err as Error).message || 'Erro ao excluir avaliações. Verifique permissões ou tente novamente.');
    }
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditLoading(false);
    setEditSaving(false);
    setEditError(null);
    setEditingEvaluation(null);
    setCompanyMembers([]);
    setSelectedSellerId('');
  };

  const openEditModal = async (evaluation: any) => {
    if (!canEditSeller) return;
    if (!evaluation || evaluation.status !== 'completed') return;

    setEditOpen(true);
    setEditLoading(true);
    setEditSaving(false);
    setEditError(null);
    setEditingEvaluation(evaluation);
    setCompanyMembers([]);
    setSelectedSellerId('');

    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const allMembers = await queryClient.fetchQuery<any[]>({
        queryKey: ['partners', accessToken],
        queryFn: async () => {
          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`, {
            headers,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Erro ao carregar equipe');
          return Array.isArray(data.partners) ? data.partners : [];
        },
        staleTime: 5 * 60_000,
      });
      const members = allMembers
        .filter((p: any) => p?.companyId === evaluation.companyId)
        .filter((p: any) => isTeamMemberRole(p?.role));

      setCompanyMembers(members);

      const currentSellerId = Array.isArray(evaluation?.visitData?.sellers) ? evaluation.visitData.sellers[0] : '';
      if (currentSellerId) {
        setSelectedSellerId(String(currentSellerId));
      } else if (members.length) {
        const vendorsRaw = (evaluation?.visitData?.vendors || '').toString();
        const firstVendorName = vendorsRaw.split(',')[0]?.trim().toLowerCase();
        const match = firstVendorName
          ? members.find((m: any) => (m?.name || '').toString().trim().toLowerCase() === firstVendorName)
          : null;
        setSelectedSellerId(String(match?.id || members[0]?.id || ''));
      }
    } catch (err) {
      console.error('Error loading company members:', err);
      setEditError((err as Error).message || 'Erro ao carregar equipe');
    } finally {
      setEditLoading(false);
    }
  };

  const saveEditedSeller = async () => {
    if (!canEditSeller) return;
    if (!editingEvaluation?.id) return;
    if (!selectedSellerId) return;

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${editingEvaluation.id}/evaluated-seller`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sellerId: selectedSellerId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar vendedor avaliado');
      const updatedEval = data?.evaluation;
      if (updatedEval?.id) {
        queryClient.setQueriesData({ queryKey: ['evaluations'] }, (prev: unknown) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((e: any) => (e?.id === updatedEval.id ? updatedEval : e));
        });
        queryClient.invalidateQueries({ queryKey: ['evaluations'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      }
      closeEditModal();
    } catch (err) {
      console.error('Error updating evaluated seller:', err);
      setEditError((err as Error).message || 'Erro ao atualizar vendedor avaliado');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Layout user={user} currentPage="evaluations" onNavigate={onNavigate} onLogout={onLogout}>
        <div className={`max-w-7xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
          <div className="mb-6 sm:mb-8">
            <h2 className="text-foreground mb-2">Avaliações</h2>
            <p className="text-muted-foreground">Gerencie todas as avaliações agendadas e concluídas</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
              aria-label="Filtros"
              title="Filtros"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por empresa ou avaliador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
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
                <span className="hidden sm:inline">Cards</span>
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
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setFiltersOpen(false)}
          >
            <div
              className="bg-card text-foreground border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-card border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-foreground">Filtros de avaliações</h3>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="p-2 text-foreground hover:bg-muted rounded-lg"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 bg-card text-foreground">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data inicial</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="border border-border bg-input text-foreground rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data final</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="border border-border bg-input text-foreground rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={applyLastWeek}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last1w'
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-card border-border text-foreground'
                    }`}
                  >
                    Última semana
                  </button>
                  <button
                    type="button"
                    onClick={applyLast4Weeks}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last4w'
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-card border-border text-foreground'
                    }`}
                  >
                    Últimas 4 semanas
                  </button>
                  <button
                    type="button"
                    onClick={clearPeriod}
                    className="px-3 py-2 rounded text-sm border border-border bg-muted text-foreground"
                  >
                    Todo o período
                  </button>
                </div>

                {!isPartnerPortalRole && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="flex flex-wrap gap-4">
                      {/*
                        Usamos cores fixas para os ícones quando ativos para garantir contraste no modo escuro.
                      */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Agendadas"
                          aria-pressed={selectedStatuses.includes('scheduled')}
                          onClick={() => toggleStatus('scheduled')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border transition-colors ${
                            selectedStatuses.includes('scheduled')
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500 dark:border-blue-300 dark:text-white dark:ring-1 dark:ring-blue-300/80'
                              : 'bg-muted border-border text-muted-foreground dark:bg-input/40'
                          }`}
                        >
                          <Calendar
                            className="h-5 w-5"
                            style={{
                              color: selectedStatuses.includes('scheduled')
                                ? '#60a5fa' // azul visível no modo escuro
                                : undefined,
                            }}
                          />
                        </button>
                        <span className="text-xs text-muted-foreground">Agendadas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Em andamento"
                          aria-pressed={selectedStatuses.includes('in_progress')}
                          onClick={() => toggleStatus('in_progress')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border transition-colors ${
                            selectedStatuses.includes('in_progress')
                              ? 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-amber-500 dark:border-amber-300 dark:text-amber-50 dark:ring-1 dark:ring-amber-300/80'
                              : 'bg-muted border-border text-muted-foreground dark:bg-input/40'
                          }`}
                        >
                          <Clock
                            className="h-5 w-5"
                            style={{
                              color: selectedStatuses.includes('in_progress') ? '#fbbf24' : undefined,
                            }}
                          />
                        </button>
                        <span className="text-xs text-muted-foreground">Em andamento</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Concluídas"
                          aria-pressed={selectedStatuses.includes('completed')}
                          onClick={() => toggleStatus('completed')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border transition-colors ${
                            selectedStatuses.includes('completed')
                              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-emerald-500 dark:border-emerald-300 dark:text-emerald-50 dark:ring-1 dark:ring-emerald-300/80'
                              : 'bg-muted border-border text-muted-foreground dark:bg-input/40'
                          }`}
                        >
                          <CheckCircle
                            className="h-5 w-5"
                            style={{
                              color: selectedStatuses.includes('completed') ? '#34d399' : undefined,
                            }}
                          />
                        </button>
                        <span className="text-xs text-muted-foreground">Concluídas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Canceladas"
                          aria-pressed={selectedStatuses.includes('cancelled')}
                          onClick={() => toggleStatus('cancelled')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border transition-colors ${
                            selectedStatuses.includes('cancelled')
                              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-rose-500 dark:border-rose-300 dark:text-rose-50 dark:ring-1 dark:ring-rose-300/80'
                              : 'bg-muted border-border text-muted-foreground dark:bg-input/40'
                          }`}
                        >
                          <XCircle
                            className="h-5 w-5"
                            style={{
                              color: selectedStatuses.includes('cancelled') ? '#f87171' : undefined,
                            }}
                          />
                        </button>
                        <span className="text-xs text-muted-foreground">Canceladas</span>
                      </div>
                    </div>
                  </div>
                )}

                {!hideCompanyFilter && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Empresa</span>
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="border border-border bg-input text-foreground rounded px-3 py-2"
                    >
                      <option value="">Todas as empresas</option>
                      {companies.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-lg border border-border bg-muted px-4 py-2 text-foreground hover:bg-muted/80"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex flex-col gap-3">
          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selecionada(s)
              </span>
              <button
                disabled={!canDelete}
                onClick={deleteSelected}
                className={`w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg text-white transition ${
                  canDelete ? 'bg-destructive hover:bg-destructive/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Excluir selecionadas
              </button>
            </div>
          )}
        </div>

        {pageError ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-md">
            <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Não foi possível carregar</h3>
            <p className="text-muted-foreground mb-6">{pageError}</p>
            <button
              type="button"
              onClick={() => {
                evaluationsQuery.refetch();
                companiesQuery.refetch();
                evaluatorsQuery.refetch();
              }}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-colors w-full sm:w-auto"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredEvaluations.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-card border border-border rounded-lg shadow-md">
            <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Nenhuma avaliação encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {evaluations.length === 0 
                ? 'Comece agendando sua primeira avaliação'
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {evaluations.length === 0 && (
              <button
                onClick={() => onNavigate('schedule')}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 transition-colors w-full sm:w-auto"
              >
                Agendar Avaliação
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="space-y-6">
            <WalletCardStack
              items={walletItems}
              onOpen={(id) => onNavigate('evaluation-detail', id)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvaluations.map((evaluation) => {
              const statusBadge = getStatusBadge(evaluation.status);
              const voucherDone = !!evaluation.voucherValidated;
              const surveyDone =
                evaluation.stage === 'survey_submitted' ||
                !!evaluation.surveyResponseId ||
                !!evaluation.surveyData?.answers?.length;
              const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
              const aiDone = !!evaluation.aiAnalysis;
	              
	                return (
	                  <div 
	                    key={evaluation.id} 
	                    className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 hover:shadow-lg hover:shadow-primary/10 transition-shadow"
                    role="button"
                    tabIndex={0}
                    aria-label="Abrir avaliação"
                    onClick={(e) => {
                      if (isInteractiveTarget(e.target)) return;
                      onNavigate('evaluation-detail', evaluation.id);
                    }}
                    onKeyDown={(e) => {
                      if (isInteractiveTarget(e.target)) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate('evaluation-detail', evaluation.id);
	                      }
	                    }}
	                  >
	                    {/* Mobile layout */}
	                    <div className="sm:hidden">
	                      <div className="flex items-start justify-between gap-4">
	                        <div className="flex items-start gap-3 min-w-0">
	                          {canDelete && (
	                            <input
	                              type="checkbox"
	                              className="mt-1.5 h-5 w-5 text-primary border-border rounded focus:ring-primary/60 bg-input"
	                              checked={selectedIds.includes(evaluation.id)}
	                              onChange={() => toggleSelect(evaluation.id)}
	                            />
	                          )}
	                          <div className="min-w-0">
	                            <h3 className="text-foreground truncate">{getCompanyName(evaluation.companyId)}</h3>
	                            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${statusBadge.color}`}>
	                              {statusBadge.label}
	                            </span>
	                          </div>
	                        </div>

	                        <div className="flex flex-col items-end gap-2 shrink-0">
	                          <div className="flex items-center gap-2 flex-nowrap">
	                            <StatusIconButton
	                              done={voucherDone}
	                              aria="Voucher"
	                              tooltip={`Voucher: ${voucherDone ? 'validado' : 'pendente'}`}
	                              Icon={QrCode}
	                            />
	                            <StatusIconButton
	                              done={surveyDone}
	                              aria="Questionário"
	                              tooltip={`Questionário: ${surveyDone ? 'enviado' : 'pendente'}`}
	                              Icon={FilePenLine}
	                            />
	                            <StatusIconButton
	                              done={audioDone}
	                              aria="Áudio"
	                              tooltip={`Áudio: ${audioDone ? 'enviado' : 'pendente'}`}
	                              Icon={Mic}
	                            />
	                            <StatusIconButton
	                              done={aiDone}
	                              aria="IA"
	                              tooltip={`IA: ${aiDone ? 'processada' : 'pendente'}`}
	                              Icon={BrainCog}
	                            />
	                            {canEditSeller && evaluation.status === 'completed' && (
	                              <button
	                                type="button"
	                                onClick={() => openEditModal(evaluation)}
	                                className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
	                                title="Editar vendedor avaliado"
	                                aria-label="Editar vendedor avaliado"
	                                data-no-nav
	                              >
	                                <Pencil className="h-4 w-4" />
	                              </button>
	                            )}
	                          </div>
	                        </div>
	                      </div>

	                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
	                        <div className="flex items-center gap-2">
	                          <Calendar className="w-4 h-4" />
	                          <span>
	                            {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')} - {evaluation.period}
	                          </span>
	                        </div>
	                        <div className="flex items-center gap-2">
	                          <span className="text-muted-foreground/80">Vendedor</span>
	                          <span className="text-foreground">{getSellerLabel(evaluation)}</span>
	                        </div>
	                        <div className="flex items-center gap-2">
	                          <span className="text-muted-foreground/80">Voucher:</span>
	                          <span className="font-mono text-foreground">{evaluation.voucherCode}</span>
	                        </div>
	                      </div>

	                      {evaluation.notes && (
	                        <div className="mt-4 text-sm text-muted-foreground">
	                          <span className="text-muted-foreground/80">Observações:</span> {evaluation.notes}
	                        </div>
	                      )}

	                      <div className="mt-4 text-sm text-primary">Clique para ver detalhes →</div>
	                    </div>

	                    {/* Desktop layout */}
	                    <div className="hidden sm:block">
	                      <div className="flex items-start justify-between mb-4">
	                        <div className="flex items-start gap-3 flex-1 min-w-0">
	                          {canDelete && (
	                            <input
	                              type="checkbox"
	                              className="mt-1.5 h-5 w-5 text-primary border-border rounded focus:ring-primary/60 bg-input"
	                              checked={selectedIds.includes(evaluation.id)}
	                              onChange={() => toggleSelect(evaluation.id)}
	                            />
	                          )}
	                          <div className="flex-1 min-w-0">
	                            <div className="flex items-center gap-2 mb-2 min-w-0">
	                              <h3 className="text-foreground truncate">{getCompanyName(evaluation.companyId)}</h3>
	                              <span className={`px-3 py-1 rounded-full text-sm shrink-0 ${statusBadge.color}`}>
	                                {statusBadge.label}
	                              </span>
	                            </div>
	                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
	                              <div>
	                                <span className="block text-muted-foreground/80">Vendedor</span>
	                                {getSellerLabel(evaluation)}
	                              </div>
	                              <div>
	                                <span className="block text-muted-foreground/80">Data</span>
	                                {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
	                              </div>
	                              <div>
	                                <span className="block text-muted-foreground/80">Período</span>
	                                {evaluation.period}
	                              </div>
	                              <div>
	                                <span className="block text-muted-foreground/80">Voucher</span>
	                                {evaluation.voucherCode}
	                              </div>
	                            </div>
	                            {evaluation.notes && (
	                              <div className="mt-3 text-sm text-muted-foreground">
	                                <span className="text-muted-foreground/80">Observações:</span> {evaluation.notes}
	                              </div>
	                            )}
	                          </div>
	                        </div>
	                        <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
	                          <div className="flex flex-wrap justify-end gap-1 max-w-[10rem]">
	                            <StatusIconButton
	                              done={voucherDone}
	                              aria="Voucher"
	                              tooltip={`Voucher: ${voucherDone ? 'validado' : 'pendente'}`}
	                              Icon={QrCode}
	                            />
	                            <StatusIconButton
	                              done={surveyDone}
	                              aria="Questionário"
	                              tooltip={`Questionário: ${surveyDone ? 'enviado' : 'pendente'}`}
	                              Icon={FilePenLine}
	                            />
	                            <StatusIconButton
	                              done={audioDone}
	                              aria="Áudio"
	                              tooltip={`Áudio: ${audioDone ? 'enviado' : 'pendente'}`}
	                              Icon={Mic}
	                            />
	                            <StatusIconButton
	                              done={aiDone}
	                              aria="IA"
	                              tooltip={`IA: ${aiDone ? 'processada' : 'pendente'}`}
	                              Icon={BrainCog}
	                            />
	                          </div>
	                          <div className="flex items-center gap-1">
	                            {canEditSeller && evaluation.status === 'completed' && (
	                              <button
	                                onClick={() => openEditModal(evaluation)}
	                                className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
	                                title="Editar vendedor avaliado"
	                                data-no-nav
	                              >
	                                <Pencil className="w-5 h-5" />
	                              </button>
	                            )}
	                          </div>
	                        </div>
	                      </div>
	                    </div>
	                  </div>
	              );
	            })}
          </div>
        )}

        {editOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeEditModal}
          >
            <div
              className="bg-card text-foreground border border-border rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-card border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-foreground">Editar avaliação</h3>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="p-2 hover:bg-muted rounded-lg"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Altere o vendedor avaliado (admin).</p>
              </div>

              <div className="p-4 space-y-4">
                {editError && <div className="text-sm text-destructive">{editError}</div>}

                <div className="bg-muted border border-border rounded-lg p-3 text-sm text-foreground space-y-1">
                  <div>
                    <strong>Empresa:</strong>{' '}
                    {editingEvaluation ? getCompanyName(editingEvaluation.companyId) : '-'}
                  </div>
                  <div>
                    <strong>Avaliador:</strong>{' '}
                    {editingEvaluation ? getEvaluatorName(editingEvaluation.evaluatorId) : '-'}
                  </div>
                  <div>
                    <strong>Data:</strong>{' '}
                    {editingEvaluation?.scheduledDate
                      ? new Date(editingEvaluation.scheduledDate).toLocaleDateString('pt-BR')
                      : '-'}
                    {editingEvaluation?.period ? ` • ${editingEvaluation.period}` : ''}
                  </div>
                  <div>
                    <strong>Voucher:</strong> {editingEvaluation?.voucherCode || '-'}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Vendedor avaliado</span>
                  {editLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando equipe...</div>
                  ) : companyMembers.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum membro vinculado a esta empresa.</div>
                  ) : (
                    <select
                      value={selectedSellerId}
                      onChange={(e) => setSelectedSellerId(e.target.value)}
                      className="w-full border border-border bg-input text-foreground rounded px-3 py-2"
                    >
                      <option value="">Selecione um membro...</option>
                      {companyMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email || m.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-lg border border-border bg-muted px-4 py-2 hover:bg-muted/80 text-foreground"
                    disabled={editSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveEditedSeller}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60"
                    disabled={editSaving || editLoading || !selectedSellerId || companyMembers.length === 0}
                  >
                    {editSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {!loading && !pageError && evaluations.length > 0 && (
          <div className="mt-6 bg-card border border-border rounded-lg shadow-md p-4 sm:p-6">
            <h3 className="text-foreground mb-4">Resumo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-muted-foreground text-sm">Total</p>
                <p className="text-2xl text-foreground">{evaluations.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Agendadas</p>
                <p className="text-2xl text-primary">
                  {evaluations.filter(e => e.status === 'scheduled').length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Em Andamento</p>
                <p className="text-2xl text-amber-500">
                  {evaluations.filter(e => e.status === 'in_progress').length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Concluídas</p>
                <p className="text-2xl text-green-500">
                  {evaluations.filter(e => e.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
