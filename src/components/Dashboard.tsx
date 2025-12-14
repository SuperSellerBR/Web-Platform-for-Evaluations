import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from './Layout';
import { projectId } from '../utils/supabase/info';
import { CheckCircle, Crown, Globe, Medal, SlidersHorizontal, Sparkles, ThumbsDown, ThumbsUp, Trophy, X } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  RadialBar,
  RadialBarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import servirHeader from '../../assets/SERVIR.png';
import goldHeader from '../../assets/GOLD.png';

interface DashboardProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

type Summary = {
  counts: {
    totalEvaluations: number;
    completed: number;
    scheduled: number;
    late: number;
    companies: number;
    evaluators: number;
  };
  averages: { overall: number | null; servir: number | null; gold: number | null; nps: number | null; ag: number | null };
  pillars: Record<string, number | null>;
  goldPillars: Record<string, number | null>;
  timeline: { date: string; overall: number | null; servir: number | null; gold: number | null }[];
  recentEvaluations: {
    id: string;
    companyId: string;
    scheduledDate: string;
    status: string;
    overall: number | null;
    servir: number | null;
    gold: number | null;
    nps: number | null;
    sellerLabel?: string | null;
  }[];
};

const SELLER_MATCH_STOPWORDS = new Set(['da', 'de', 'do', 'dos', 'das', 'e']);

export function Dashboard({ user, accessToken, onNavigate, onLogout }: DashboardProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefilterReady, setPrefilterReady] = useState(false);
  const [computedNps, setComputedNps] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<
    { label: string; date: string; overall: number | null; servir: number | null; gold: number | null }[]
  >([]);
  const [timelineDebug, setTimelineDebug] = useState<{
    total: number;
    afterFilters: number;
    completedWithAi: number;
    missingAi: number;
    withValidDate: number;
    missingDate: number;
  } | null>(null);

  const [companies, setCompanies] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [sellerIdsWithEvaluations, setSellerIdsWithEvaluations] = useState<string[]>([]);

  const [companyId, setCompanyId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'all' | 'last1w' | 'last4w' | 'custom'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const getEvaluationSellerLabel = (evaluation: any) => {
    const label =
      evaluation?.sellerLabel ||
      (evaluation?.visitData?.vendors || '').toString().trim() ||
      evaluation?.vendorName ||
      '';
    return label.trim() ? label.trim() : 'Indefinido';
  };

  const SERVIR_START_ANGLE = 90;
  const SERVIR_END_ANGLE = -270;

  const role = (user?.role || '').toString().trim().toLowerCase();
  const hideCompanyFilter =
    role === 'empresa' ||
    role === 'company' ||
    role === 'gerente' ||
    role === 'manager' ||
    role === 'vendedor' ||
    role === 'seller';
  const hideSellerFilter = role === 'vendedor' || role === 'seller';
  const isSellerUser = role === 'vendedor' || role === 'seller';
  const npsQuestionIdsBySurveyRef = useRef<Map<string, string[]>>(new Map());
  const summaryReqSeqRef = useRef(0);
  const timelineReqSeqRef = useRef(0);
  const overallScore100 =
    summary?.averages.overall != null ? Number((summary.averages.overall * 10).toFixed(0)) : null;
  const OverallScoreIcon =
    overallScore100 != null && overallScore100 >= 80
      ? Trophy
      : overallScore100 != null && overallScore100 >= 60
        ? Medal
        : null;

  const NpsIcon =
    computedNps == null
      ? null
      : computedNps < 0
        ? ThumbsDown
        : computedNps >= 70
          ? Crown
          : computedNps > 50
            ? Sparkles
            : computedNps > 20
              ? CheckCircle
              : computedNps > 0
                ? ThumbsUp
                : null;

  // Pré-filtro por perfil
  useEffect(() => {
    if (role === 'empresa' || role === 'company') setCompanyId(user?.companyId || '');
    if (role === 'gerente' || role === 'manager') setCompanyId(user?.companyId || '');
    if (role === 'vendedor' || role === 'seller') {
      setCompanyId(user?.companyId || '');
      setSellerId(user?.partnerId || user?.id || '');
    }
    if (role === 'evaluator') setSellerId(user?.evaluatorId || user?.id || '');
    setPrefilterReady(true);
  }, [role, user]);

  useEffect(() => {
    if (!prefilterReady) return;
    if (isSellerUser) return;
    fetchSummary();
  }, [prefilterReady, companyId, sellerId, status, fromDate, toDate, isSellerUser]);

  useEffect(() => {
    if (!prefilterReady) return;
    fetchTimeline();
  }, [prefilterReady, companyId, sellerId, status, fromDate, toDate, teamMembers]);

  useEffect(() => {
    // carregar opções para dropdowns
    const headers = { Authorization: `Bearer ${accessToken}` };
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`, { headers })
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies || []))
      .catch(() => {});

    if (hideSellerFilter) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const members = Array.isArray(data.partners) ? data.partners : [];
        const normalize = (v: any) => (v || '').toString().trim().toLowerCase();
        const filtered = members.filter((p: any) =>
          ['vendedor', 'seller', 'gerente', 'manager'].includes(normalize(p?.role))
        );
        setTeamMembers(filtered);
      })
      .catch(() => {});
  }, [accessToken]);

  const fetchSummary = async () => {
    const requestSeq = ++summaryReqSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (sellerId) params.set('sellerId', sellerId);
      if (status) params.set('status', status);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/dashboard/summary?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar dashboard');
      if (requestSeq === summaryReqSeqRef.current) setSummary(data);
    } catch (e: any) {
      if (requestSeq === summaryReqSeqRef.current) setError(e.message || 'Erro ao carregar dashboard');
    } finally {
      if (requestSeq === summaryReqSeqRef.current) setLoading(false);
    }
  };

  const parseDate = (v: any) => {
    if (!v) return null;
    if (!isNaN(Number(v))) {
      const d = new Date(Number(v));
      if (!isNaN(d.getTime())) return d;
    }
    const d1 = new Date(v);
    if (!isNaN(d1.getTime())) return d1;
    const [dp] = String(v).split(/[ T]/);
    const m = dp.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      const d2 = new Date(iso);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  };

  const parseNumber = (value: any) => {
    if (value === undefined || value === null) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  };

  const normalizeNpsRating0to10 = (value: any) => {
    const n = parseNumber(value);
    if (n == null) return null;
    const rating = n > 10 ? n / 10 : n;
    if (!Number.isFinite(rating)) return null;
    if (rating < 0 || rating > 10) return null;
    return rating;
  };

  const normalizeSellerToken = (value: any) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const sellerTokenWords = (value: any) =>
    normalizeSellerToken(value)
      .split(/\s+/)
      .filter((w) => w && !SELLER_MATCH_STOPWORDS.has(w));

  const computeNps = (ratings: number[]) => {
    if (!ratings.length) return null;
    const total = ratings.length;
    const promoters = ratings.filter((r) => r >= 9).length;
    const detractors = ratings.filter((r) => r <= 6).length;
    const score = (promoters / total) * 100 - (detractors / total) * 100;
    const rounded = Math.round(score);
    return Math.max(-100, Math.min(100, rounded));
  };

  const extractNpsQuestionIdsFromSurvey = (surveyPayload: any): string[] => {
    const questions = (surveyPayload?.sections || []).flatMap((s: any) => s?.questions || []);
    const byType = questions
      .filter((q: any) => String(q?.type || '').toLowerCase() === 'nps')
      .map((q: any) => q.id)
      .filter(Boolean);
    if (byType.length) return byType;

    const normalizeText = (text: any) =>
      String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    const byTitle = questions
      .filter((q: any) => {
        const t = normalizeText(q?.title);
        return t.includes('nps') || t.includes('recomendar') || t.includes('recomendaria');
      })
      .map((q: any) => q.id)
      .filter(Boolean);
    return byTitle;
  };

  const buildSummaryFromEvaluations = (evaluationsList: any[]): Summary => {
    const today = new Date().toISOString().slice(0, 10);
    const isLate = (e: any) =>
      e?.status !== 'completed' && e?.scheduledDate && String(e.scheduledDate).slice(0, 10) < today;

    const completed = evaluationsList.filter((e: any) => e?.status === 'completed');
    const scheduled = evaluationsList.filter((e: any) => e?.status !== 'completed' && !isLate(e));
    const late = evaluationsList.filter((e: any) => isLate(e));

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const onlyNumbers = (arr: any[]) =>
      arr.filter((n) => typeof n === 'number' && Number.isFinite(n)) as number[];

    const overallArr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.overallScore));
    const servirArr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.servirAvg));
    const goldArr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.goldAvg));
    const npsArr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.npsScore));
    const agArr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.agScore));

    const pillarKeys = ['S', 'E', 'R', 'V', 'I', 'R_REL'];
    const goldKeys = ['G', 'O', 'L', 'D'];
    const pillarScores: Record<string, number | null> = {};
    pillarKeys.forEach((k) => {
      const arr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.pillarScores?.[k]));
      pillarScores[k] = avg(arr);
    });
    const goldScores: Record<string, number | null> = {};
    goldKeys.forEach((k) => {
      const arr = onlyNumbers(completed.map((e: any) => e?.aiAnalysis?.goldScores?.[k]));
      goldScores[k] = avg(arr);
    });

    const companiesCount = new Set(evaluationsList.map((e: any) => e?.companyId).filter(Boolean)).size;
    const evaluatorsCount = new Set(evaluationsList.map((e: any) => e?.evaluatorId).filter(Boolean)).size;

    const recentEvaluations = [...completed]
      .sort((a: any, b: any) =>
        String(a?.completedAt || a?.scheduledDate || a?.createdAt || '').localeCompare(
          String(b?.completedAt || b?.scheduledDate || b?.createdAt || ''),
        ),
      )
      .slice(-10)
      .map((e: any) => ({
        id: e.id,
        companyId: e.companyId,
        scheduledDate: e.scheduledDate,
        status: e.status,
        overall: e.aiAnalysis?.overallScore ?? null,
        servir: e.aiAnalysis?.servirAvg ?? null,
        gold: e.aiAnalysis?.goldAvg ?? null,
        nps: e.aiAnalysis?.npsScore ?? null,
        sellerLabel: (e?.visitData?.vendors || '').toString().trim() || null,
      }));

    return {
      counts: {
        totalEvaluations: evaluationsList.length,
        completed: completed.length,
        scheduled: scheduled.length,
        late: late.length,
        companies: companiesCount,
        evaluators: evaluatorsCount,
      },
      averages: {
        overall: avg(overallArr),
        servir: avg(servirArr),
        gold: avg(goldArr),
        nps: avg(npsArr),
        ag: avg(agArr),
      },
      pillars: pillarScores,
      goldPillars: goldScores,
      timeline: [],
      recentEvaluations,
    };
  };

  // Timeline derivada direto das avaliações (independente do summary)
  const fetchTimeline = async () => {
    const requestSeq = ++timelineReqSeqRef.current;
    if (isSellerUser) {
      setLoading(true);
      setError(null);
    }
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar avaliações');
      const allEvals: any[] = data.evaluations || [];
      let evals: any[] = [...allEvals];

      // filtros
      if (companyId) evals = evals.filter((e) => e.companyId === companyId);
      // IDs de vendedores com avaliações (não depende do sellerId para não "sumir" ao filtrar)
      const asIdArray = (val: any) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
        if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
        return [];
      };
      const membersForCompany = companyId
        ? teamMembers.filter((m: any) => String(m?.companyId) === String(companyId))
        : teamMembers;
      const memberIndex = membersForCompany.map((m: any) => {
        const id = String(m?.id || '').trim();
        return {
          id,
          idKey: normalizeSellerToken(id),
          nameKey: normalizeSellerToken(m?.name),
          emailKey: normalizeSellerToken(m?.email),
          nameWords: sellerTokenWords(m?.name),
        };
      });

      const matchesMemberFromVendorToken = (
        member: { id: string; idKey: string; nameKey: string; emailKey: string; nameWords: string[] },
        tokenRaw: string,
      ) => {
        const tokenKey = normalizeSellerToken(tokenRaw);
        if (!tokenKey) return false;
        if (tokenKey === member.idKey || tokenKey === member.nameKey || tokenKey === member.emailKey) return true;
        if (member.nameKey && tokenKey) {
          const minLen = Math.min(member.nameKey.length, tokenKey.length);
          if (minLen >= 4 && (tokenKey.includes(member.nameKey) || member.nameKey.includes(tokenKey))) return true;
        }
        const tokenWords = sellerTokenWords(tokenRaw);
        if (!tokenWords.length || !member.nameWords.length) return false;
        const tokenInMember = tokenWords.every((w) => member.nameWords.includes(w));
        const memberInToken = member.nameWords.every((w) => tokenWords.includes(w));
        if (!tokenInMember && !memberInToken) return false;
        const significant = tokenWords.filter((w) => w.length >= 3);
        return significant.length > 0;
      };

      const sellerIds = new Set<string>();
      evals.forEach((e) => {
        asIdArray(e?.visitData?.sellers).forEach((id) => sellerIds.add(id));
        const vendorTokens = asIdArray(e?.visitData?.vendors);
        if (!vendorTokens.length || !memberIndex.length) return;
        vendorTokens.forEach((token) => {
          const tokenRaw = String(token || '').trim();
          if (!tokenRaw) return;
          memberIndex.forEach((m) => {
            if (!m.id) return;
            if (matchesMemberFromVendorToken(m, tokenRaw)) sellerIds.add(m.id);
          });
        });
      });

      if (requestSeq !== timelineReqSeqRef.current) return;
      setSellerIdsWithEvaluations(Array.from(sellerIds));
      if (sellerId) {
        const selectedMember = memberIndex.find((m) => String(m.id) === String(sellerId));
        const fallbackMember = hideSellerFilter
          ? {
              id: String(sellerId),
              idKey: normalizeSellerToken(sellerId),
              nameKey: normalizeSellerToken(user?.name),
              emailKey: normalizeSellerToken(user?.email),
              nameWords: sellerTokenWords(user?.name),
            }
          : null;
        const memberToMatch = selectedMember || fallbackMember;
        evals = evals.filter((e) => {
          const sellers = asIdArray(e?.visitData?.sellers);
          if (sellers.includes(String(sellerId))) return true;
          const vendorTokens = asIdArray(e?.visitData?.vendors);
          if (!vendorTokens.length || !memberToMatch) return false;
          return vendorTokens.some((t) => matchesMemberFromVendorToken(memberToMatch, String(t || '')));
        });
      }
      if (status === 'completed') evals = evals.filter((e) => e.status === 'completed');
      if (status === 'scheduled') evals = evals.filter((e) => e.status !== 'completed');
      const fromD = fromDate ? parseDate(fromDate) : null;
      const toD = toDate ? parseDate(toDate) : null;
      evals = evals.filter((e) => {
        const d = parseDate(e.scheduledDate) || parseDate(e.createdAt);
        if (!d) return false;
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
        return true;
      });

      if (isSellerUser) {
        if (requestSeq !== timelineReqSeqRef.current) return;
        setSummary(buildSummaryFromEvaluations(evals));
        setLoading(false);
      }

      // NPS = %Promotores − %Detratores (promotores: 9–10; detratores: 0–6)
      // Prioriza aiAnalysis.npsScore; fallback usa surveyData + metadados do survey.
      const completedEvals = evals.filter((e) => e.status === 'completed');
      const surveyIdsNeedingLookup = Array.from(
        new Set(
          completedEvals
            .filter((e) => normalizeNpsRating0to10(e?.aiAnalysis?.npsScore) == null && e?.surveyId)
            .map((e) => String(e.surveyId))
        )
      ).filter((id) => !npsQuestionIdsBySurveyRef.current.has(id));

      if (surveyIdsNeedingLookup.length) {
        await Promise.all(
          surveyIdsNeedingLookup.map(async (surveyId) => {
            try {
              const sRes = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${surveyId}`,
                { headers }
              );
              const sData = await sRes.json();
              if (!sRes.ok) {
                npsQuestionIdsBySurveyRef.current.set(surveyId, []);
                return;
              }
              npsQuestionIdsBySurveyRef.current.set(surveyId, extractNpsQuestionIdsFromSurvey(sData));
            } catch {
              npsQuestionIdsBySurveyRef.current.set(surveyId, []);
            }
          })
        );
      }

      const npsRatings: number[] = [];
      completedEvals.forEach((e) => {
        const fromAi = normalizeNpsRating0to10(e?.aiAnalysis?.npsScore);
        if (fromAi != null) {
          npsRatings.push(fromAi);
          return;
        }
        const surveyId = e?.surveyId ? String(e.surveyId) : '';
        const npsQuestionIds = surveyId ? npsQuestionIdsBySurveyRef.current.get(surveyId) || [] : [];
        if (!npsQuestionIds.length) return;
        const answers: any[] = Array.isArray(e?.surveyData?.answers) ? e.surveyData.answers : [];
        const values = answers
          .filter((a) => a?.questionId && npsQuestionIds.includes(String(a.questionId)))
          .map((a) => normalizeNpsRating0to10(a?.value))
          .filter((v): v is number => v != null);
        if (!values.length) return;
        const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
        const rating = normalizeNpsRating0to10(avg);
        if (rating != null) npsRatings.push(rating);
      });
      if (requestSeq !== timelineReqSeqRef.current) return;
      setComputedNps(computeNps(npsRatings));

      const completedWithAi = evals.filter((e) => e.status === 'completed' && e.aiAnalysis);
      const completedWithoutAi = evals.filter((e) => e.status === 'completed' && !e.aiAnalysis).length;

      const dated = completedWithAi
        .map((e) => ({
          e,
          d: parseDate(e.scheduledDate) || parseDate(e.createdAt),
        }))
        .filter((item) => item.d);

      const groups: Record<string, { d: Date; overall: number[]; servir: number[]; gold: number[] }> = {};
      dated.forEach(({ e, d }) => {
        if (!d) return;
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!groups[ymd]) groups[ymd] = { d: d, overall: [], servir: [], gold: [] };
        const ai = e.aiAnalysis || {};
        // overallScore pode vir em 0-10 ou 0-100; normaliza para 0-100
        if (typeof ai.overallScore === 'number') {
          const val = ai.overallScore <= 10 ? ai.overallScore * 10 : ai.overallScore;
          groups[ymd].overall.push(val);
        }
        if (typeof ai.servirAvg === 'number') groups[ymd].servir.push(ai.servirAvg);
        if (typeof ai.goldAvg === 'number') groups[ymd].gold.push(ai.goldAvg);
      });

      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      let timeline = Object.entries(groups)
        .map(([key, vals]) => ({
          date: key,
          label: vals.d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          overall: avg(vals.overall),
          servir: avg(vals.servir),
          gold: avg(vals.gold),
        }))
        .filter((t) => t.overall !== null || t.servir !== null || t.gold !== null)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      // Fallback: se temos avaliações concluídas mas nenhuma data parseável, gera pontos indexados
      if (timeline.length === 0 && completedWithAi.length > 0) {
        timeline = completedWithAi
          .map((e, idx) => {
            const ai = e.aiAnalysis || {};
            const overall =
              typeof ai.overallScore === 'number'
                ? ai.overallScore <= 10
                  ? ai.overallScore * 10
                  : ai.overallScore
                : null;
            const servir = typeof ai.servirAvg === 'number' ? ai.servirAvg : null;
            const gold = typeof ai.goldAvg === 'number' ? ai.goldAvg : null;
            if (overall === null && servir === null && gold === null) return null;
            return {
              date: e.scheduledDate || e.createdAt || `Ponto-${idx + 1}`,
              label: `P${idx + 1}`,
              overall,
              servir,
              gold,
            };
          })
          .filter(Boolean) as any[];
      }

      if (requestSeq !== timelineReqSeqRef.current) return;
      setTimelineData(timeline);
      setTimelineDebug({
        total: allEvals.length,
        afterFilters: evals.length,
        completedWithAi: completedWithAi.length,
        missingAi: completedWithoutAi,
        withValidDate: dated.length,
        missingDate: completedWithAi.length - dated.length,
      });
      if (timeline.length === 0) {
        console.debug('[dashboard] timeline vazio', {
          total: allEvals.length,
          afterFilters: evals.length,
          completedWithAi: completedWithAi.length,
          completedWithoutAi,
          validDates: dated.length,
        });
      }
    } catch (err) {
      console.error('Erro ao montar timeline:', err);
      if (requestSeq !== timelineReqSeqRef.current) return;
      if (isSellerUser) {
        setSummary(null);
        setError('Erro ao carregar dashboard');
        setLoading(false);
      }
      setTimelineData([]);
      setTimelineDebug(null);
      setComputedNps(null);
      setSellerIdsWithEvaluations([]);
    }
  };

  // Fallback: se timelineData estiver vazio, tenta derivar de summary.recentEvaluations
  useEffect(() => {
    if (timelineData.length > 0) return;
    if (!summary || !summary.recentEvaluations) return;

    const parseDate = (v: any) => {
      if (!v) return null;
      const d1 = new Date(v);
      if (!isNaN(d1.getTime())) return d1;
      const [dp] = String(v).split(/[ T]/);
      const m = dp.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
      if (m) {
        const iso = `${m[3]}-${m[2]}-${m[1]}`;
        const d2 = new Date(iso);
        if (!isNaN(d2.getTime())) return d2;
      }
      return null;
    };

    const group: Record<string, { d: Date; overall: number[]; servir: number[]; gold: number[] }> = {};
    summary.recentEvaluations.forEach((e) => {
      const d = parseDate(e.scheduledDate);
      if (!d) return;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!group[ymd]) group[ymd] = { d: d, overall: [], servir: [], gold: [] };
      if (typeof e.overall === 'number') {
        const val = e.overall <= 10 ? e.overall * 10 : e.overall;
        group[ymd].overall.push(val);
      }
      if (typeof e.servir === 'number') group[ymd].servir.push(e.servir);
      if (typeof e.gold === 'number') group[ymd].gold.push(e.gold);
    });
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const timeline = Object.entries(group)
      .map(([key, vals]) => ({
        date: key,
        label: vals.d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        overall: avg(vals.overall),
        servir: avg(vals.servir),
        gold: avg(vals.gold),
      }))
      .filter((t) => t.overall !== null || t.servir !== null || t.gold !== null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    if (timeline.length > 0) setTimelineData(timeline);
  }, [timelineData.length, summary]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Pontuação Geral', value: summary.averages.overall ?? '-', accent: 'text-blue-700' },
      { label: 'SERVIR', value: summary.averages.servir ?? '-', accent: 'text-emerald-700' },
      { label: 'GOLD', value: summary.averages.gold ?? '-', accent: 'text-amber-700' },
      { label: 'NPS', value: summary.averages.nps ?? '-', accent: 'text-purple-700' },
      { label: 'Avaliações concluídas', value: summary.counts.completed, accent: 'text-slate-700' },
      { label: 'Agendadas', value: summary.counts.scheduled, accent: 'text-slate-700' },
      { label: 'Atrasadas', value: summary.counts.late, accent: 'text-red-700' },
    ];
  }, [summary]);

  const sellerOptions = useMemo(() => {
    const ids = new Set(sellerIdsWithEvaluations.map((id) => String(id)));
    const options = teamMembers.filter((m: any) => ids.has(String(m?.id)));
    options.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));
    return options;
  }, [sellerIdsWithEvaluations, teamMembers]);

  useEffect(() => {
    if (hideSellerFilter) return;
    if (!sellerId) return;
    const ids = new Set(sellerIdsWithEvaluations.map((id) => String(id)));
    if (!ids.has(String(sellerId))) {
      setSellerId('');
    }
  }, [hideSellerFilter, sellerId, sellerIdsWithEvaluations]);

  const filtersSummary = useMemo(() => {
    const sellerLabel = sellerId
      ? teamMembers.find((m: any) => String(m.id) === String(sellerId))?.name ||
        (String(user?.partnerId) === String(sellerId) ||
        String(user?.id) === String(sellerId) ||
        String(user?.evaluatorId) === String(sellerId)
          ? user?.name
          : '') ||
        sellerId
      : 'Todos os colaboradores';

    const formatISO = (iso: string) => {
      const [yyyy, mm, dd] = String(iso || '').split('-');
      if (yyyy && mm && dd) return `${dd}/${mm}/${yyyy}`;
      return iso;
    };

    const periodLabel = (() => {
      if (periodPreset === 'all' && !fromDate && !toDate) return 'Todo o período';
      if (periodPreset === 'last1w') return 'Última semana';
      if (periodPreset === 'last4w') return 'Últimas 4 semanas';
      if (fromDate && toDate) return `De ${formatISO(fromDate)} até ${formatISO(toDate)}`;
      if (fromDate) return `A partir de ${formatISO(fromDate)}`;
      if (toDate) return `Até ${formatISO(toDate)}`;
      return 'Todo o período';
    })();

    return { periodLabel, sellerLabel };
  }, [fromDate, periodPreset, sellerId, teamMembers, toDate, user?.evaluatorId, user?.id, user?.name, user?.partnerId]);

  const resolvedCompanyId = (companyId || user?.companyId || '').toString();
  const selectedCompany = useMemo(() => {
    if (!resolvedCompanyId) return null;
    return companies.find((c: any) => c.id === resolvedCompanyId) || null;
  }, [companies, resolvedCompanyId]);
  const selectedCompanyLogoUrl = (selectedCompany?.logoUrl || selectedCompany?.logo_url || '') as string;

  useEffect(() => {
    setLogoError(false);
  }, [selectedCompanyLogoUrl]);

  const pillarBars = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.pillars).map(([k, v]) => ({ name: k.toUpperCase(), value: v ?? 0 }));
  }, [summary]);

  const goldBars = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.goldPillars).map(([k, v]) => ({ name: k.toUpperCase(), value: v ?? 0 }));
  }, [summary]);

  const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

  const servirRadialData = useMemo(() => {
    if (!summary) return [];
    const palette: Record<string, { fill: string; stroke: string }> = {
      S: { fill: 'rgba(37, 99, 235, 0.55)', stroke: 'rgba(37, 99, 235, 0.9)' },
      E: { fill: 'rgba(34, 197, 94, 0.55)', stroke: 'rgba(34, 197, 94, 0.9)' },
      R: { fill: 'rgba(245, 158, 11, 0.55)', stroke: 'rgba(245, 158, 11, 0.9)' },
      V: { fill: 'rgba(239, 68, 68, 0.55)', stroke: 'rgba(239, 68, 68, 0.9)' },
      I: { fill: 'rgba(139, 92, 246, 0.55)', stroke: 'rgba(139, 92, 246, 0.9)' },
      R_REL: { fill: 'rgba(20, 184, 166, 0.55)', stroke: 'rgba(20, 184, 166, 0.9)' },
    };

    const entries = Object.entries(summary.pillars).map(([key, value]) => {
      const label = key.toUpperCase() === 'R_REL' ? 'R REL' : key.toUpperCase();
      const scoreRaw = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
      const score = Number.isFinite(scoreRaw) ? (scoreRaw <= 10 ? scoreRaw * 10 : scoreRaw) : 0;
      const colorKey = label === 'R REL' ? 'R_REL' : label;
      const color = palette[colorKey] || palette.S;
      return { pillar: label, score, fill: color.fill, stroke: color.stroke };
    });

    const order = ['S', 'E', 'R', 'V', 'I', 'R REL'];
    entries.sort((a, b) => {
      const ai = order.indexOf(a.pillar);
      const bi = order.indexOf(b.pillar);
      if (ai === -1 && bi === -1) return a.pillar.localeCompare(b.pillar);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return entries;
  }, [summary]);

  const renderServirAngleTick = useMemo(() => {
    const formatLabel = (v: string) => (v === 'R REL' ? 'Rʳᵉˡ' : v);
    const rad = Math.PI / 180;
    const count = servirRadialData.length || 1;
    const step = (SERVIR_END_ANGLE - SERVIR_START_ANGLE) / count;
    const centerOffset = step / 2;

    return (props: any) => {
      const { cx, cy, radius, payload } = props || {};
      if (cx == null || cy == null || radius == null || !payload) return null;

      const angle = (payload.coordinate ?? 0) + centerOffset;
      const labelRadius = Number(radius) + 10;
      const x = Number(cx) + Math.cos(-rad * angle) * labelRadius;
      const y = Number(cy) + Math.sin(-rad * angle) * labelRadius;

      let rotate = -angle + 90;
      const normalized = ((rotate % 360) + 360) % 360;
      if (normalized > 90 && normalized < 270) rotate += 180;

      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={11}
          transform={`rotate(${rotate}, ${x}, ${y})`}
        >
          {formatLabel(String(payload.value))}
        </text>
      );
    };
  }, [SERVIR_END_ANGLE, SERVIR_START_ANGLE, servirRadialData.length]);

  const renderGoldBarLabel = (props: any) => {
    const { x, y, width, height, value } = props || {};
    const v = typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(v) || v <= 0) return null;

    const xPos = Number(x) + Number(width) / 2;
    const yTop = Number(y) + 14;
    const yMax = Number(y) + Number(height) - 6;
    const yPos = Math.min(yTop, yMax);
    if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) return null;

    return (
      <text
        x={xPos}
        y={yPos}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        fontSize={12}
        fontWeight={700}
        style={{ pointerEvents: 'none' }}
      >
        {v.toFixed(1)}
      </text>
    );
  };

  // Normaliza dados da timeline para o gráfico (garante números e escala correta)
  const timelinePlotData = useMemo(() => {
    return timelineData.map((p) => {
      const norm = (val: any) => {
        const n = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(n)) return null;
        // se vier em 0-10, leva para 0-100
        return n <= 10 ? n * 10 : n;
      };
      return {
        ...p,
        overall: norm(p.overall),
        servir: typeof p.servir === 'number' ? p.servir : parseFloat(String(p.servir)),
        gold: typeof p.gold === 'number' ? p.gold : parseFloat(String(p.gold)),
      };
    });
  }, [timelineData]);

  // Dados para gráfico em barras (evolução) com SERVIR/GOLD escalados para 0-100
  const timelineBarData = useMemo(() => {
    return timelinePlotData.map((p) => ({
      ...p,
      servirScaled: p.servir != null ? p.servir * 10 : null,
      goldScaled: p.gold != null ? p.gold * 10 : null,
    }));
  }, [timelinePlotData]);

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

  return (
    <Layout user={user} currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-4 overflow-hidden">
          <div className="min-w-0 flex-1">
            <h2 className="text-gray-900 mb-2">Dashboard</h2>
            <div className="mt-1 flex items-center gap-3 min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white hover:bg-gray-50"
                aria-label="Filtros"
                title="Filtros"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0 text-sm text-gray-600 leading-tight">
                <p className="truncate">{filtersSummary.periodLabel}</p>
                <p className="truncate">{filtersSummary.sellerLabel}</p>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            {selectedCompanyLogoUrl && !logoError ? (
              <div
                className="rounded-full border border-gray-200 bg-white flex items-center justify-center"
                style={{ width: 73, height: 73 }}
              >
                <img
                  src={selectedCompanyLogoUrl}
                  alt={selectedCompany?.name ? `Logo ${selectedCompany.name}` : 'Logo da empresa'}
                  className="rounded-full object-cover"
                  style={{ width: 62, height: 62 }}
                  loading="lazy"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div
                className="rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500"
                style={{ width: 73, height: 73 }}
              >
                <Globe style={{ width: 62, height: 62 }} />
              </div>
            )}
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
                  <h3 className="text-gray-900">Filtros do dashboard</h3>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">Defina o período e os responsáveis para refinar os dados.</p>
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={applyLastWeek}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last1w' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'
                    }`}
                  >
                    Última semana
                  </button>
                  <button
                    onClick={applyLast4Weeks}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'last4w' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'
                    }`}
                  >
                    Últimas 4 semanas
                  </button>
                  <button
                    onClick={clearPeriod}
                    className={`px-3 py-2 rounded text-sm border ${
                      periodPreset === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'
                    }`}
                  >
                    Todo o período
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {!hideSellerFilter && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Vendedor/Gerente</span>
                      <select
                        value={sellerId}
                        onChange={(e) => setSellerId(e.target.value)}
                        className="border rounded px-3 py-2"
                      >
                        <option value="">Todos os colaboradores</option>
                        {sellerOptions.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.email || m.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

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

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full" />
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        {summary && !loading && (
          <div className="space-y-6">
	            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
	              <div className="bg-white shadow rounded-lg p-4">
	                <p className="text-sm text-gray-500">Pontuação Geral</p>
	                <div className="flex items-center justify-between gap-3 mt-1">
	                  <p className="text-2xl sm:text-3xl font-bold text-blue-700">
	                    {overallScore100 != null ? overallScore100 : '--'}
	                    <span className="text-xs text-gray-500 ml-1">/100</span>
	                  </p>
	                  {OverallScoreIcon && (
	                    <span className="text-gray-900" style={{ flexShrink: 0 }} aria-hidden>
	                      <OverallScoreIcon className="w-6 h-6" />
	                    </span>
	                  )}
	                </div>
	              </div>
	              <div className="bg-white shadow rounded-lg p-4">
	                <p className="text-sm text-gray-500">NPS</p>
	                <div className="flex items-center justify-between gap-3 mt-1">
	                  <p className="text-2xl sm:text-3xl font-bold text-purple-700">{computedNps != null ? computedNps : '--'}</p>
	                  {NpsIcon && (
	                    <span className="text-gray-900" style={{ flexShrink: 0 }} aria-hidden>
	                      <NpsIcon className="w-6 h-6" />
	                    </span>
	                  )}
	                </div>
	              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-500">Média SERVIR</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {summary.averages.servir != null ? summary.averages.servir.toFixed(1) : '--'}
                </p>
              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm text-gray-500">Média GOLD</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                  {summary.averages.gold != null ? summary.averages.gold.toFixed(1) : '--'}
                </p>
              </div>
            </div>

	            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
	              <div className="bg-white shadow rounded-lg p-4">
	                <img
	                  src={servirHeader}
	                  alt="Metodologia SERVIR"
	                  className="block mb-2 h-auto"
	                  style={{ width: '37.5%' }}
	                  loading="lazy"
	                />
	                <ResponsiveContainer width="100%" height={260}>
	                  <RadialBarChart
	                    data={servirRadialData}
	                    layout="centric"
                    innerRadius={0}
                    outerRadius="80%"
                    startAngle={SERVIR_START_ANGLE}
                    endAngle={SERVIR_END_ANGLE}
                  >
                    <PolarGrid gridType="circle" radialLines />
                    <PolarAngleAxis dataKey="pillar" axisLine={false} tickLine={false} tick={renderServirAngleTick} />
                    <PolarRadiusAxis domain={[0, 100]} tickCount={6} angle={90} />
                    <RadialBar dataKey="score" cornerRadius={4}>
                      {servirRadialData.map((entry, index) => (
                        <Cell key={`${entry.pillar}-${index}`} fill={entry.fill} stroke={entry.stroke} strokeWidth={1} />
                      ))}
                    </RadialBar>
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <img
                  src={goldHeader}
                  alt="Dimensões GOLD"
	                  className="block mb-2 h-auto"
	                  style={{ width: '33%' }}
	                  loading="lazy"
	                />
		                <ResponsiveContainer width="100%" height={260}>
		                  <BarChart data={goldBars}>
		                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
	                    <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={false} width={0} />
	                    <Tooltip />
	                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} label={renderGoldBarLabel} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Evolução da nota geral</p>
              {timelinePlotData.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum dado disponível.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timelinePlotData}>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <Tooltip
                      formatter={(value: any) => (typeof value === 'number' ? value.toFixed(1) : value)}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Geral"
                      stroke="#1d4ed8"
                      strokeWidth={2.2}
                      dot={{ r: 4, strokeWidth: 1.5, stroke: '#1d4ed8', fill: '#ffffff' }}
                      activeDot={{ r: 5.5, strokeWidth: 2, stroke: '#1d4ed8', fill: '#ffffff' }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Últimas avaliações</p>
              <div className="space-y-3 text-sm text-gray-700">
                {summary.recentEvaluations.length === 0 && <p>Nenhuma avaliação concluída.</p>}
                {summary.recentEvaluations.map((e) => {
                  const companyName = companies.find((c) => c.id === e.companyId)?.name || e.companyId;
                  const sellerLabel = getEvaluationSellerLabel(e);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onNavigate('evaluation-detail', e.id)}
                      className="block w-full text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{companyName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(e.scheduledDate).toLocaleDateString('pt-BR')} • {e.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          Vendedor: {sellerLabel}
                        </p>
                      </div>
                        <div className="flex items-center gap-2 text-xs overflow-x-auto">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                            <span className="text-gray-600">Geral</span>
                            <span className="font-semibold text-gray-900">{e.overall ?? '-'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1">
                            <span className="text-blue-700">SERVIR</span>
                            <span className="font-semibold text-blue-900">{e.servir ?? '-'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
                            <span className="text-amber-700">GOLD</span>
                            <span className="font-semibold text-amber-900">{e.gold ?? '-'}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
