import { useEffect, useMemo, useState } from 'react';
import { Layout } from './Layout';
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, User, Pencil, Trash2, QrCode, FilePenLine, Mic, BrainCog, X } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { formatFullName } from '../utils/name';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { LoadingDots } from './LoadingDots';
import { useTheme } from '../utils/theme';

const STATUS_META = {
  scheduled: {
    label: 'Agendada',
    color: 'bg-blue-500',
    light: 'bg-blue-500/15 dark:bg-blue-500/20',
    dot: 'bg-blue-500',
    border: 'border-blue-500/30 dark:border-blue-200/40',
    text: 'text-blue-900 dark:text-blue-200',
  },
  in_progress: {
    label: 'Em andamento',
    color: 'bg-yellow-500',
    light: 'bg-yellow-500/20 dark:bg-yellow-500/25',
    dot: 'bg-yellow-500',
    border: 'border-yellow-500/40 dark:border-yellow-400/40',
    text: 'text-yellow-700 dark:text-yellow-100',
  },
  completed: {
    label: 'Concluída',
    color: 'bg-green-600',
    light: 'bg-green-600/15 dark:bg-green-600/20',
    dot: 'bg-green-600',
    border: 'border-green-600/35 dark:border-green-200/40',
    text: 'text-green-700 dark:text-green-100',
  },
  late: {
    label: 'Atrasada',
    color: 'bg-red-600',
    light: 'bg-red-500/15 dark:bg-red-500/20',
    dot: 'bg-red-600',
    border: 'border-red-500/40 dark:border-red-500/50',
    text: 'text-red-700 dark:text-red-200',
  },
  cancelled: {
    label: 'Cancelada',
    color: 'bg-gray-400',
    light: 'bg-gray-300/40 dark:bg-muted',
    dot: 'bg-gray-400',
    border: 'border-gray-400/60 dark:border-border',
    text: 'text-foreground',
  },
} as const;

type StatusKey = keyof typeof STATUS_META;

const MAX_PILLS = 3;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (key: string | null) => {
  if (!key) return null;
  const [y, m, d] = key.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const dateKeyFromValue = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateKey(d);
};

const dateKeyToUtcMidday = (key: string) => {
  if (!key) return '';
  return `${key}T12:00:00.000Z`; // usar meio-dia UTC para evitar volta de dia por fuso
};

const ALLOW_REPEATS_KEY = 'schedule:allowRepeats';
const readAllowRepeats = () => {
  const stored = localStorage.getItem(ALLOW_REPEATS_KEY);
  return stored === null ? true : stored === 'true';
};

function StatusIconButton(props: { done: boolean; aria: string; tooltip: string; Icon: any }) {
  const { done, aria, tooltip, Icon } = props;
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
            done
              ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-500/15 dark:border-green-500/30 dark:text-green-200'
              : 'bg-muted border-border text-muted-foreground dark:bg-input/40'
          }`}
          aria-label={aria}
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

interface SchedulePageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function SchedulePage({ user, accessToken, onNavigate, onLogout }: SchedulePageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [companies, setCompanies] = useState<any[]>([]);
  const [evaluators, setEvaluators] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [matchedEvaluators, setMatchedEvaluators] = useState<any[]>([]);
  const [loadingEvaluators, setLoadingEvaluators] = useState(false);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [allowRepeats, setAllowRepeats] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(formatDateKey(new Date()));
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [formData, setFormData] = useState({
    companyId: '',
    evaluatorId: '',
    date: '',
    period: 'manhã',
    notes: '',
    surveyId: '',
    voucherValue: '',
  });

  const now = new Date();
  const todayKey = formatDateKey(now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.companyId) {
      loadMatchedEvaluators(formData.companyId);
      const company = companies.find((c) => c.id === formData.companyId);
      if (company?.defaultSurveyId) {
        setFormData((prev) => ({ ...prev, surveyId: company.defaultSurveyId }));
      }
    }
  }, [formData.companyId, allowRepeats]);

  useEffect(() => {
    if (!formData.surveyId && surveys.length > 0) {
      setFormData((prev) => ({ ...prev, surveyId: surveys[0].id }));
    }
  }, [surveys]);

  useEffect(() => {
    setAllowRepeats(readAllowRepeats());

    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);

    const handleSetting = (event: any) => {
      if (event?.type === 'allowRepeatsChanged') {
        setAllowRepeats(!!event.detail);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ALLOW_REPEATS_KEY) {
        setAllowRepeats(readAllowRepeats());
      }
    };
    window.addEventListener('allowRepeatsChanged', handleSetting as any);
    window.addEventListener('storage', handleStorage);

    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('allowRepeatsChanged', handleSetting as any);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const evaluationsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    evaluations.forEach((evaluation) => {
      const key = dateKeyFromValue(evaluation?.scheduledDate);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(evaluation);
    });
    return map;
  }, [evaluations]);

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      const [companiesRes, evaluatorsRes, evaluationsRes, surveysRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators`, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations`, { headers }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys`, { headers }),
      ]);

      const companiesData = await companiesRes.json();
      const evaluatorsData = await evaluatorsRes.json();
      const evaluationsData = await evaluationsRes.json();
      const surveysData = await surveysRes.json();

      setCompanies(companiesData.companies || []);
      setEvaluators(evaluatorsData.evaluators || []);
      setEvaluations(evaluationsData.evaluations || []);
      setSurveys(surveysData.surveys || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadMatchedEvaluators = async (companyId: string) => {
    try {
      setLoadingEvaluators(true);
      const allow = readAllowRepeats();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/match-evaluators/${companyId}?allowRepeats=${allow}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setMatchedEvaluators(data.evaluators || []);
    } catch (error) {
      console.error('Error loading matched evaluators:', error);
    } finally {
      setLoadingEvaluators(false);
    }
  };

  const getEffectiveStatus = (evaluation: any): StatusKey => {
    const statusRaw = String(evaluation?.status || '').toLowerCase();
    if (statusRaw.includes('cancel')) return 'cancelled';
    if (statusRaw.includes('complet')) return 'completed';
    if (statusRaw.includes('progress') || statusRaw.includes('andament')) return 'in_progress';
    if (statusRaw.includes('late') || statusRaw.includes('overdue') || statusRaw.includes('atras')) return 'late';

    const evalDateKey = dateKeyFromValue(evaluation?.scheduledDate);
    if (evalDateKey && evalDateKey < todayKey) return 'late';
    return 'scheduled';
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    return company?.name || 'Empresa';
  };

  const getEvaluatorName = (evaluatorId: string) => {
    const evaluator = evaluators.find((e) => e.id === evaluatorId);
    return formatFullName(evaluator?.name, (evaluator as any)?.lastName) || 'Avaliador';
  };

  const parseVoucherValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isEditing = !!editingEvaluation?.id;
      const url = isEditing
        ? `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${editingEvaluation.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          scheduledDate: dateKeyToUtcMidday(formData.date) || formData.date,
          voucherValue: parseVoucherValue(formData.voucherValue),
        }),
      });

      if (response.ok) {
        await loadData();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Error scheduling evaluation:', error);
      alert('Erro ao agendar avaliação');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (date: Date) => {
    setSelectedDate(date);
    const key = formatDateKey(date);
    setSelectedDayKey(key);
    setEditingEvaluation(null);
    setFormData((prev) => ({
      ...prev,
      date: key,
    }));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setEditingEvaluation(null);
    setFormData({
      companyId: '',
      evaluatorId: '',
      date: '',
      period: 'manhã',
      notes: '',
      surveyId: '',
      voucherValue: '',
    });
    setMatchedEvaluators([]);
  };

  // Calendar logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getEvaluationsForDate = (date: Date) => {
    const key = formatDateKey(date);
    return evaluationsByDate[key] || [];
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const isPastDate = (date: Date) => date < startOfToday && formatDateKey(date) !== todayKey;

  const filteredEvaluations = evaluations.filter((evaluation) => {
    if (!selectedDayKey) return true;
    return dateKeyFromValue(evaluation?.scheduledDate) === selectedDayKey;
  });

  const formatSelectedDayLabel = () => {
    if (!selectedDayKey) return 'Todas as avaliações';
    const parsed = parseDateKey(selectedDayKey);
    if (!parsed) return 'Dia selecionado';
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleDaySelect = (day: Date) => {
    setSelectedDayKey(formatDateKey(day));
  };

  const handleAddClick = (day: Date) => {
    if (isPastDate(day)) return;
    openModal(day);
  };

  const handleMobileAddClick = () => {
    const base = parseDateKey(selectedDayKey) || new Date();
    const target = isPastDate(base) ? new Date() : base;
    handleAddClick(target);
  };

  const handleDelete = async (evaluationId: string) => {
    const confirmDelete = window.confirm('Deseja excluir este agendamento?');
    if (!confirmDelete) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao excluir');
      }
      setEvaluations((prev) => prev.filter((ev) => ev.id !== evaluationId));
      await loadData();
    } catch (err) {
      console.error('delete error', err);
      alert('Erro ao excluir agendamento');
    }
  };

  const handleEdit = (evaluation: any) => {
    const dateKey = dateKeyFromValue(evaluation?.scheduledDate);
    const parsed = parseDateKey(dateKey || '');
    setEditingEvaluation(evaluation);
    setSelectedDayKey(dateKey || null);
    if (parsed) setSelectedDate(parsed);
    setFormData({
      companyId: evaluation.companyId || '',
      evaluatorId: evaluation.evaluatorId || '',
      date: dateKey || '',
      period: evaluation.period || 'manhã',
      notes: evaluation.notes || '',
      surveyId: evaluation.surveyId || '',
      voucherValue: parseVoucherValue(
        evaluation.voucherValue ?? evaluation.visitData?.voucherValue ?? ''
      ),
    });
    loadMatchedEvaluators(evaluation.companyId);
    setShowModal(true);
  };

  return (
    <Layout user={user} currentPage="schedule" onNavigate={onNavigate} onLogout={onLogout}>
      <div className={`max-w-7xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="mb-6 sm:mb-8">
          <h2 className="text-foreground mb-2">Agendar Avaliação</h2>
          <p className="text-muted-foreground">Selecione uma data no calendário para criar uma nova avaliação</p>
        </div>

        {/* Calendar */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <button
              onClick={previousMonth}
              className="p-2 rounded-lg transition-colors text-foreground hover:bg-muted"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h3 className="text-foreground capitalize">{monthName}</h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg transition-colors text-foreground hover:bg-muted"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Week days */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-muted-foreground text-xs sm:text-sm py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayEvaluations = getEvaluationsForDate(day);
              const dayKey = formatDateKey(day);
              const isToday = dayKey === todayKey;
              const isPast = isPastDate(day);
              const isSelected = selectedDayKey === dayKey;
              const statusDots = Array.from(
                new Set(dayEvaluations.map((ev) => getEffectiveStatus(ev) as string))
              ) as StatusKey[];
              const count = dayEvaluations.length;
              const visiblePills = dayEvaluations.slice(0, MAX_PILLS);
              const overflow = count - visiblePills.length;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDaySelect(day)}
                  style={{
                    ...(isPast
                      ? {
                          opacity: 0.25,
                          filter: 'grayscale(1) saturate(0.6)',
                        }
                      : {}),
                    ...(!isSelected && isToday
                      ? {
                          backgroundColor: 'rgba(59, 130, 246, 0.10)',
                          boxShadow:
                            '0 0 0 2px rgba(59, 130, 246, 0.95) inset, 0 0 0 4px rgba(59, 130, 246, 0.35)',
                        }
                      : {}),
                  }}
                  className={`
                    calendar-cell group relative aspect-square rounded-lg border transition-colors p-2 flex flex-col overflow-hidden
                    border-border
                    ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                    ${
                      isPast
                        ? 'bg-muted text-muted-foreground cursor-not-allowed pointer-events-none select-none'
                        : 'bg-card hover:border-primary/60'
                    }
                  `}
                >
                  <div className="flex items-start justify-between text-xs sm:text-sm">
                    <span className={`${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{day.getDate()}</span>
                    {!isMobile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddClick(day);
                        }}
                        disabled={isPast}
                        className={`
                          hidden sm:flex items-center justify-center rounded-full p-1 transition absolute top-1 right-0 translate-x-1/2
                          opacity-0 group-hover:opacity-100 focus:opacity-100
                          ${isPast ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20'}
                        `}
                        aria-label={`Agendar em ${day.toLocaleDateString('pt-BR')}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    {/* Desktop pills */}
                    <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                      {visiblePills.map((ev) => {
                        const status = getEffectiveStatus(ev);
                        const meta = STATUS_META[status] || STATUS_META.scheduled;
                        return (
                          <div
                            key={ev.id}
                            className={`calendar-pill text-[10px] sm:text-xs font-medium px-2 py-1 rounded border ${meta.light} ${meta.border} ${meta.text} truncate`}
                          >
                            {getCompanyName(ev.companyId)}
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="calendar-pill text-[10px] sm:text-xs px-2 py-1 rounded bg-muted text-muted-foreground border border-dashed border-border text-center">
                          +{overflow}
                        </div>
                      )}
                    </div>

                    {/* Mobile indicators */}
                    {isMobile && (
                      <div className="sm:hidden flex flex-col items-center gap-1 mt-auto">
                        <div className="flex items-center justify-center gap-1 min-h-[10px]">
                          {statusDots.map((status) => (
                            <span
                              key={`${dayKey}-${status}`}
                              className={`w-2 h-2 rounded-full ${STATUS_META[status]?.dot || 'bg-muted-foreground'}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {(['scheduled', 'in_progress', 'completed', 'late'] as StatusKey[]).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${STATUS_META[status].color} opacity-80`}></div>
              <span className={STATUS_META[status].text}>{STATUS_META[status].label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded bg-transparent"
              style={{ boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.95) inset, 0 0 0 3px rgba(59, 130, 246, 0.25)' }}
            />
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* Mobile add button */}
      <button
        type="button"
        onClick={handleMobileAddClick}
        className="hidden"
        aria-label="Agendar avaliação"
      />

      {/* Bottom list */}
      <div className="mt-6 bg-card border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-foreground text-sm sm:text-base">Avaliações {selectedDayKey ? 'do dia' : ''}</p>
            <p className="text-muted-foreground text-xs sm:text-sm">{formatSelectedDayLabel()}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Total: {filteredEvaluations.length}</span>
            <button
              type="button"
              onClick={handleMobileAddClick}
              className="inline-flex items-center justify-center bg-blue-600 text-white p-2 rounded-full shadow-sm hover:bg-blue-700 transition"
              aria-label="Agendar avaliação"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        {filteredEvaluations.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Nenhuma avaliação para este dia.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[320px] overflow-auto">
            {filteredEvaluations.map((evaluation) => {
              const status = getEffectiveStatus(evaluation);
              const meta = STATUS_META[status] || STATUS_META.scheduled;
              const dateLabel = dateKeyFromValue(evaluation.scheduledDate);
              const parsedDate = parseDateKey(dateLabel);
              const displayDate = parsedDate
                ? parsedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-';
              const isScheduled = status === 'scheduled';
              const voucherDone = !!evaluation.voucherValidated;
              const surveyDone =
                evaluation.stage === 'survey_submitted' ||
                !!evaluation.surveyResponseId ||
                !!(evaluation.surveyData?.answers?.length);
              const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
              const aiDone = !!evaluation.aiAnalysis;
              return (
                <div key={evaluation.id} className="px-4 py-3 flex items-stretch gap-3">
                  <span className={`inline-block w-2 rounded-full ${meta.color} flex-shrink-0`}></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-medium truncate">{getCompanyName(evaluation.companyId)}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground border border-border">
                        Voucher: {evaluation.voucherCode || '—'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {displayDate}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {evaluation.period || '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-4 h-4" /> {getEvaluatorName(evaluation.evaluatorId)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusIconButton
                        done={voucherDone}
                        aria="Voucher"
                        tooltip={`Voucher: ${voucherDone ? 'validado' : 'pendente'}`}
                        Icon={QrCode}
                      />
                      <StatusIconButton
                        done={surveyDone}
                        aria="Questionário"
                        tooltip={`Questionário: ${surveyDone ? 'respondido' : 'pendente'}`}
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
                  </div>
                  {isScheduled && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(evaluation)}
                        className="p-2 rounded-full border border-border text-foreground hover:bg-muted transition"
                        title="Editar agendamento"
                        aria-label="Editar agendamento"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(evaluation.id)}
                        className="p-2 rounded-full border border-red-200 text-red-700 hover:bg-red-50 transition dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/15"
                        title="Excluir agendamento"
                        aria-label="Excluir agendamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-foreground text-lg font-semibold leading-tight">
                    {editingEvaluation ? 'Editar agendamento' : 'Agendar Avaliação'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedDate.toLocaleDateString('pt-BR')} · Defina empresa, avaliador e questionário.
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
                <label className="block text-foreground mb-2">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, date: val });
                    const parsed = parseDateKey(val);
                    if (parsed) setSelectedDate(parsed);
                  }}
                  className="block w-full max-w-full min-w-0 px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent appearance-none box-border"
                  style={{ WebkitAppearance: 'none' }}
                  required
                />
              </div>

              <div>
                <label className="block text-foreground mb-2">Empresa</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value, evaluatorId: '' })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={!!editingEvaluation}
                  required
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-foreground mb-2">
                  Avaliador (ordenado por pontuação e aderência)
                </label>
                <select
                  value={formData.evaluatorId}
                  onChange={(e) => setFormData({ ...formData, evaluatorId: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                  disabled={!formData.companyId || loadingEvaluators}
                >
                  <option value="" disabled>
                    {!formData.companyId
                      ? 'Selecione uma empresa primeiro'
                      : loadingEvaluators
                        ? 'Carregando a lista de avaliadores disponíveis...'
                        : matchedEvaluators.length === 0
                          ? 'Nenhum avaliador disponível para esta empresa'
                          : 'Selecione um avaliador'}
                  </option>
                  {matchedEvaluators.map(evaluator => (
                    <option key={evaluator.id} value={evaluator.id}>
                      {formatFullName(evaluator.name, evaluator.lastName)} (Pontuação: {evaluator.matchScore})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-foreground mb-2">Questionário</label>
                <select
                  value={formData.surveyId}
                  onChange={(e) => setFormData({ ...formData, surveyId: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.title}
                    </option>
                  ))}
                </select>
                {surveys.length === 0 && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    Nenhum questionário criado. Crie um em Questionários.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-foreground mb-2">Valor do voucher (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.voucherValue}
                  onChange={(e) => setFormData({ ...formData, voucherValue: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Ex.: 50,00"
                />
              </div>

              <div>
                <label className="block text-foreground mb-2">Período</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="manhã">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                  placeholder="Instruções especiais para o avaliador..."
                />
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
                  disabled={loading}
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <LoadingDots label={editingEvaluation ? 'Salvando' : 'Agendando'} />
                  ) : editingEvaluation ? 'Salvar alterações' : 'Agendar Avaliação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
