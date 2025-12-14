import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import {
  BrainCog,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  FilePenLine,
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

interface EvaluationsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string, id?: string) => void;
  onLogout: () => void;
}

function StatusIconButton(props: { done: boolean; aria: string; tooltip: string; Icon: any }) {
  const { done, aria, tooltip, Icon } = props;
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center h-9 w-9 rounded-full border ${
            done ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
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

export function EvaluationsPage({ user, accessToken, onNavigate, onLogout }: EvaluationsPageProps) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [evaluators, setEvaluators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'all' | 'last1w' | 'last4w' | 'custom'>('all');
  const ALL_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([...ALL_STATUSES]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState<any | null>(null);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

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
    loadData();
  }, []);

  useEffect(() => {
    if (!hideCompanyFilter) return;
    setCompanyId((user?.companyId || '').toString());
  }, [hideCompanyFilter, user?.companyId]);

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      const [evaluationsRes, companiesRes, evaluatorsRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations`, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators`, { headers }),
      ]);

      const evaluationsData = await evaluationsRes.json();
      const companiesData = await companiesRes.json();
      const evaluatorsData = await evaluatorsRes.json();

      setEvaluations(evaluationsData.evaluations || []);
      setCompanies(companiesData.companies || []);
      setEvaluators(evaluatorsData.evaluators || []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'N/A';
  };

  const getEvaluatorName = (evaluatorId: string) => {
    const evaluator = evaluators.find(e => e.id === evaluatorId);
    return evaluator?.name || 'N/A';
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
      scheduled: { label: 'Agendada', color: 'bg-blue-100 text-blue-800' },
      in_progress: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
    };
    const badge = badges[status as keyof typeof badges] || { label: status, color: 'bg-gray-100 text-gray-800' };
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
      setEvaluations((prev) => prev.filter((e) => !results.includes(e.id)));
      setSelectedIds([]);
      loadData();
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
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar equipe');

      const allMembers = Array.isArray(data.partners) ? data.partners : [];
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
        setEvaluations((prev) => prev.map((e) => (e.id === updatedEval.id ? updatedEval : e)));
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-gray-900 mb-2">Avaliações</h2>
          <p className="text-gray-600">Gerencie todas as avaliações agendadas e concluídas</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:bg-gray-50"
              aria-label="Filtros"
              title="Filtros"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por empresa ou avaliador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setFiltersOpen(false)}
          >
            <div
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-gray-900">Filtros de avaliações</h3>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Data inicial</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Data final</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setPeriodPreset('custom');
                      }}
                      className="border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={applyLastWeek}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last1w' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'
                    }`}
                  >
                    Última semana
                  </button>
                  <button
                    type="button"
                    onClick={applyLast4Weeks}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last4w' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'
                    }`}
                  >
                    Últimas 4 semanas
                  </button>
                  <button type="button" onClick={clearPeriod} className="px-3 py-2 rounded text-sm border bg-white">
                    Todo o período
                  </button>
                </div>

                {!isPartnerPortalRole && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Status</span>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Agendadas"
                          aria-pressed={selectedStatuses.includes('scheduled')}
                          onClick={() => toggleStatus('scheduled')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border ${
                            selectedStatuses.includes('scheduled')
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        >
                          <Calendar className="h-5 w-5" />
                        </button>
                        <span className="text-xs text-gray-600">Agendadas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Em andamento"
                          aria-pressed={selectedStatuses.includes('in_progress')}
                          onClick={() => toggleStatus('in_progress')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border ${
                            selectedStatuses.includes('in_progress')
                              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        >
                          <Clock className="h-5 w-5" />
                        </button>
                        <span className="text-xs text-gray-600">Em andamento</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Concluídas"
                          aria-pressed={selectedStatuses.includes('completed')}
                          onClick={() => toggleStatus('completed')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border ${
                            selectedStatuses.includes('completed')
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <span className="text-xs text-gray-600">Concluídas</span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          aria-label="Canceladas"
                          aria-pressed={selectedStatuses.includes('cancelled')}
                          onClick={() => toggleStatus('cancelled')}
                          className={`inline-flex items-center justify-center h-12 w-12 rounded-full border ${
                            selectedStatuses.includes('cancelled')
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                        <span className="text-xs text-gray-600">Canceladas</span>
                      </div>
                    </div>
                  </div>
                )}

                {!hideCompanyFilter && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Empresa</span>
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="border rounded px-3 py-2"
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
                    className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-50"
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
              <span className="text-sm text-gray-700">
                {selectedIds.length} selecionada(s)
              </span>
              <button
                disabled={!canDelete}
                onClick={deleteSelected}
                className={`w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg text-white transition ${
                  canDelete
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Excluir selecionadas
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEvaluations.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhuma avaliação encontrada</h3>
            <p className="text-gray-600 mb-6">
              {evaluations.length === 0 
                ? 'Comece agendando sua primeira avaliação'
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {evaluations.length === 0 && (
              <button
                onClick={() => onNavigate('schedule')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
              >
                Agendar Avaliação
              </button>
            )}
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
	                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow"
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
	                              className="mt-1.5 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
	                              checked={selectedIds.includes(evaluation.id)}
	                              onChange={() => toggleSelect(evaluation.id)}
	                            />
	                          )}
	                          <div className="min-w-0">
	                            <h3 className="text-gray-900 truncate">{getCompanyName(evaluation.companyId)}</h3>
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
	                                className="inline-flex items-center justify-center h-9 w-9 rounded-full border bg-blue-50 border-blue-200 text-blue-600"
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

	                      <div className="mt-4 space-y-3 text-sm text-gray-600">
	                        <div className="flex items-center gap-2">
	                          <Calendar className="w-4 h-4" />
	                          <span>
	                            {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')} - {evaluation.period}
	                          </span>
	                        </div>
	                        <div className="flex items-center gap-2">
	                          <span className="text-gray-500">Vendedor</span>
	                          <span className="text-gray-900">{getSellerLabel(evaluation)}</span>
	                        </div>
	                        <div className="flex items-center gap-2">
	                          <span className="text-gray-500">Voucher:</span>
	                          <span className="font-mono">{evaluation.voucherCode}</span>
	                        </div>
	                      </div>

	                      {evaluation.notes && (
	                        <div className="mt-4 text-sm text-gray-600">
	                          <span className="text-gray-500">Observações:</span> {evaluation.notes}
	                        </div>
	                      )}

	                      <div className="mt-4 text-sm text-blue-600">Clique para ver detalhes →</div>
	                    </div>

	                    {/* Desktop layout */}
	                    <div className="hidden sm:block">
	                      <div className="flex items-start justify-between mb-4">
	                        <div className="flex items-start gap-3 flex-1 min-w-0">
	                          {canDelete && (
	                            <input
	                              type="checkbox"
	                              className="mt-1.5 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
	                              checked={selectedIds.includes(evaluation.id)}
	                              onChange={() => toggleSelect(evaluation.id)}
	                            />
	                          )}
	                          <div className="flex-1 min-w-0">
	                            <div className="flex items-center gap-2 mb-2 min-w-0">
	                              <h3 className="text-gray-900 truncate">{getCompanyName(evaluation.companyId)}</h3>
	                              <span className={`px-3 py-1 rounded-full text-sm shrink-0 ${statusBadge.color}`}>
	                                {statusBadge.label}
	                              </span>
	                            </div>
	                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
	                              <div>
	                                <span className="block text-gray-500">Vendedor</span>
	                                {getSellerLabel(evaluation)}
	                              </div>
	                              <div>
	                                <span className="block text-gray-500">Data</span>
	                                {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
	                              </div>
	                              <div>
	                                <span className="block text-gray-500">Período</span>
	                                {evaluation.period}
	                              </div>
	                              <div>
	                                <span className="block text-gray-500">Voucher</span>
	                                {evaluation.voucherCode}
	                              </div>
	                            </div>
	                            {evaluation.notes && (
	                              <div className="mt-3 text-sm text-gray-600">
	                                <span className="text-gray-500">Observações:</span> {evaluation.notes}
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
	                                className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={closeEditModal}
          >
            <div
              className="bg-white rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-gray-900">Editar avaliação</h3>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Altere o vendedor avaliado (admin).</p>
              </div>

              <div className="p-4 space-y-4">
                {editError && <div className="text-sm text-red-600">{editError}</div>}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 space-y-1">
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
                  <span className="text-xs text-gray-500">Vendedor avaliado</span>
                  {editLoading ? (
                    <div className="text-sm text-gray-600">Carregando equipe...</div>
                  ) : companyMembers.length === 0 ? (
                    <div className="text-sm text-gray-600">Nenhum membro vinculado a esta empresa.</div>
                  ) : (
                    <select
                      value={selectedSellerId}
                      onChange={(e) => setSelectedSellerId(e.target.value)}
                      className="w-full border rounded px-3 py-2"
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
                    className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-50"
                    disabled={editSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveEditedSeller}
                    className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
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
        {!loading && evaluations.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h3 className="text-gray-900 mb-4">Resumo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Total</p>
                <p className="text-2xl text-gray-900">{evaluations.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Agendadas</p>
                <p className="text-2xl text-blue-600">
                  {evaluations.filter(e => e.status === 'scheduled').length}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Em Andamento</p>
                <p className="text-2xl text-yellow-600">
                  {evaluations.filter(e => e.status === 'in_progress').length}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Concluídas</p>
                <p className="text-2xl text-green-600">
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
