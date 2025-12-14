import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from './Layout';
import { 
  BrainCog,
  FileText, 
  CheckCircle, 
  Mic, 
  Square, 
  Play, 
  Pause,
  ExternalLink,
  Download,
  Star,
  QrCode,
  FilePenLine,
  Trash,
  Send,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { projectId } from '../utils/supabase/info';
import { SurveyRenderer } from './SurveyRenderer';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import servirHeader from '../../assets/SERVIR.png';
import goldHeader from '../../assets/GOLD.png';

interface EvaluationDetailPageProps {
  evaluationId: string;
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function EvaluationDetailPage({ 
  evaluationId, 
  user, 
  accessToken, 
  onNavigate, 
  onLogout 
}: EvaluationDetailPageProps) {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [evaluator, setEvaluator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [surveyDetail, setSurveyDetail] = useState<{ survey: any; sections: any[] } | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [managerRating, setManagerRating] = useState(5);
  const [managerNotes, setManagerNotes] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedBaseRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sendAfterStopRef = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [reachedLimit, setReachedLimit] = useState(false);
  const MAX_DURATION = 300; // 5 minutos
  const [aiPollCount, setAiPollCount] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sellerNamesById, setSellerNamesById] = useState<Record<string, string>>({});
  const [statusTooltipOpen, setStatusTooltipOpen] = useState<null | 'voucher' | 'survey' | 'audio' | 'ai'>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isEvaluator = user.role === 'evaluator';
  const isManager = user.role === 'gerente' || user.role === 'manager';
  const isAdmin = user.role === 'admin';
  const isPartner = user.role === 'partner' || user.role === 'parceiro';

  const ai = evaluation?.aiAnalysis;

  const sellerIds = useMemo(() => {
    const raw = evaluation?.visitData?.sellers;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((v: any) => String(v)).filter(Boolean);
    if (typeof raw === 'string') return raw.split(',').map((v) => v.trim()).filter(Boolean);
    return [];
  }, [evaluation?.visitData?.sellers]);

  useEffect(() => {
    if (isEvaluator) return;
    if (!sellerIds.length) return;
    const missing = sellerIds.filter((id) => !sellerNamesById[id]);
    if (!missing.length) return;

    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all(
      missing.map(async (id) => {
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/partners/${id}`,
            { headers }
          );
          const data = await res.json();
          if (res.ok) {
            const partner = data?.partner;
            return { id, name: String(partner?.name || partner?.email || id) };
          }
        } catch {}
        return { id, name: id };
      })
    ).then((rows) => {
      setSellerNamesById((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          if (r?.id) next[r.id] = r.name;
        });
        return next;
      });
    });
  }, [accessToken, isEvaluator, sellerIds, sellerNamesById]);

  const vendorsLabel = useMemo(() => {
    if (sellerIds.length) {
      const names = sellerIds
        .map((id) => sellerNamesById[id] || id)
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      if (names.length) return names.join(', ');
    }
    const legacy = evaluation?.visitData?.vendors;
    return legacy ? String(legacy) : '-';
  }, [evaluation?.visitData?.vendors, sellerIds, sellerNamesById]);

  const parseNumber = (value: any) => {
    if (value === undefined || value === null) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  };

  const SERVIR_START_ANGLE = 90;
  const SERVIR_END_ANGLE = -270;

  const overallScore100 = (() => {
    const n = parseNumber(ai?.overallScore);
    if (n == null) return null;
    const normalized = n <= 10 ? n * 10 : n;
    return Math.round(normalized);
  })();

  const npsScore = (() => {
    const n = parseNumber(ai?.npsScore);
    return n == null ? null : Math.round(n);
  })();

  const servirAvg = parseNumber(ai?.servirAvg);
  const goldAvg = parseNumber(ai?.goldAvg);

  const servirRadialData = useMemo(() => {
    const scores = ai?.pillarScores || {};
    const palette: Record<string, { fill: string; stroke: string }> = {
      S: { fill: 'rgba(37, 99, 235, 0.55)', stroke: 'rgba(37, 99, 235, 0.9)' },
      E: { fill: 'rgba(34, 197, 94, 0.55)', stroke: 'rgba(34, 197, 94, 0.9)' },
      R: { fill: 'rgba(245, 158, 11, 0.55)', stroke: 'rgba(245, 158, 11, 0.9)' },
      V: { fill: 'rgba(239, 68, 68, 0.55)', stroke: 'rgba(239, 68, 68, 0.9)' },
      I: { fill: 'rgba(139, 92, 246, 0.55)', stroke: 'rgba(139, 92, 246, 0.9)' },
      R_REL: { fill: 'rgba(20, 184, 166, 0.55)', stroke: 'rgba(20, 184, 166, 0.9)' },
    };

    const entries = Object.entries(scores).map(([key, value]) => {
      const label = key.toUpperCase() === 'R_REL' ? 'R REL' : key.toUpperCase();
      const n = parseNumber(value) ?? 0;
      const score = n <= 10 ? n * 10 : n;
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
  }, [ai?.pillarScores]);

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

      let rotate = -angle + 90; // tangente
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

  const goldBars = useMemo(() => {
    const scores = ai?.goldScores || {};
    const entries = Object.entries(scores).map(([key, value]) => {
      const n = parseNumber(value) ?? 0;
      return { name: key.toUpperCase(), value: n };
    });

    const order = ['G', 'O', 'L', 'D'];
    entries.sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return entries;
  }, [ai?.goldScores]);

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

  const servirScoresOrdered = useMemo(() => {
    const scores = ai?.pillarScores || {};
    const normalizeKey = (key: any) => String(key || '').toUpperCase().replace(/\s+/g, '_');
    const order = ['S', 'E', 'R', 'V', 'I', 'R_REL'];
    const entries = Object.entries(scores).map(([key, value]) => ({
      key: String(key),
      label: normalizeKey(key),
      value,
    }));

    entries.sort((a, b) => {
      const aIndex = order.indexOf(a.label);
      const bIndex = order.indexOf(b.label);
      if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return entries;
  }, [ai?.pillarScores]);

  const goldScoresOrdered = useMemo(() => {
    const scores = ai?.goldScores || {};
    const normalizeKey = (key: any) => String(key || '').toUpperCase().replace(/\s+/g, '_');
    const order = ['G', 'O', 'L', 'D'];
    const entries = Object.entries(scores).map(([key, value]) => ({
      key: String(key),
      label: normalizeKey(key),
      value,
    }));

    entries.sort((a, b) => {
      const aIndex = order.indexOf(a.label);
      const bIndex = order.indexOf(b.label);
      if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return entries;
  }, [ai?.goldScores]);

  useEffect(() => {
    loadEvaluationData();
  }, [evaluationId]);

  useEffect(() => {
    if (!evaluation || evaluation.voucherValidated || evaluation.status === 'completed') return;
    // Poll for updates so the evaluator sees validation without refresh
    const interval = setInterval(() => {
      loadEvaluationData();
    }, 4000);
    return () => clearInterval(interval);
  }, [evaluation, evaluationId]);

  // Poll IA results after conclusão
  useEffect(() => {
    if (!evaluation || evaluation.status !== 'completed' || evaluation.aiAnalysis) return;
    if (aiPollCount > 12) return; // ~1 minuto se 5s
    const interval = setInterval(() => {
      loadEvaluationData();
      setAiPollCount((c) => c + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [evaluation, evaluation?.aiAnalysis, evaluationId, aiPollCount]);

  useEffect(() => {
    if (isRecording && elapsedSeconds >= MAX_DURATION) {
      setReachedLimit(true);
      sendAfterStopRef.current = false;
      stopRecording();
    }
  }, [elapsedSeconds, isRecording]);

  const loadEvaluationData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      const evaluationRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}`,
        { headers }
      );
      const evaluationData = await evaluationRes.json();
      setEvaluation(evaluationData.evaluation);

      if (evaluationData.evaluation) {
        const [companyRes, evaluatorRes] = await Promise.all([
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies/${evaluationData.evaluation.companyId}`,
            { headers }
          ),
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluators/${evaluationData.evaluation.evaluatorId}`,
            { headers }
          ),
        ]);

        const companyData = await companyRes.json();
        const evaluatorData = await evaluatorRes.json();

        setCompany(companyData.company);
        setEvaluator(evaluatorData.evaluator);

        // Set current step based on evaluation status
        if (evaluationData.evaluation.status === 'completed') {
          setCurrentStep(5);
        } else if (evaluationData.evaluation.voucherValidated) {
          setCurrentStep(3);
        } else if (evaluationData.evaluation.status === 'in_progress') {
          setCurrentStep(2);
        }

        // Fetch survey structure to exibir respostas no modo admin/manager
        const surveyId = evaluationData.evaluation.surveyId || companyData.company?.defaultSurveyId;
        if (surveyId) {
          const surveyRes = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/surveys/${surveyId}`,
            { headers }
          );
          if (surveyRes.ok) {
            const surveyJson = await surveyRes.json();
            setSurveyDetail(surveyJson);
          }
        }
      }
    } catch (error) {
      console.error('Error loading evaluation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}/pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar PDF');
      }
      const data = await res.json();
      // recarrega para pegar reportUrl no KV
      await loadEvaluationData();
      if (!res.ok) {
        throw new Error(data?.error || "Erro ao gerar PDF");
      }
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      console.error('Erro gerando PDF', err);
      alert(err.message || 'Erro ao gerar PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!evaluationId) return;
    setReanalyzing(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}/reanalyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao reprocessar');
      }

      // Reset polling so a new analysis result is fetched
      setAiPollCount(0);
      await loadEvaluationData();
      alert('Reprocessamento solicitado. Os resultados aparecerão quando a IA finalizar.');
    } catch (error: any) {
      console.error('Erro ao reprocessar IA:', error);
      alert(error.message || 'Erro ao reprocessar IA');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleValidateVoucher = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}/validate-voucher`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ managerRating, managerNotes }),
        }
      );

      if (response.ok) {
        alert('Voucher validado com sucesso!');
        await loadEvaluationData();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.error}`);
      }
    } catch (error) {
      console.error('Error validating voucher:', error);
      alert('Erro ao validar voucher');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      elapsedBaseRef.current = 0;
      setElapsedSeconds(0);

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (sendAfterStopRef.current) {
          sendAfterStopRef.current = false;
          // wait next tick to ensure state update
          setTimeout(() => handleCompleteEvaluation(audioBlob), 50);
        }
      });

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Erro ao iniciar gravação. Verifique as permissões do microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      elapsedBaseRef.current += elapsedSeconds;
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      audio.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleCompleteEvaluation = async (blobOverride?: Blob | null) => {
    const blobToSend = blobOverride ?? audioBlob;
    if (!blobToSend) {
      alert('Por favor, grave o áudio da avaliação');
      return;
    }

    try {
      setIsCompleting(true);
      // Upload audio
      const formData = new FormData();
      formData.append('file', blobToSend, 'evaluation-audio.webm');
      formData.append('folder', 'audios');

      const uploadRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const uploadData = await uploadRes.json();

      // Update evaluation
      const updateRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            audioPath: uploadData.path,
            audioUrl: uploadData.url,
            completedAt: new Date().toISOString(),
          }),
        }
      );

      if (updateRes.ok) {
        // Trigger IA em background
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/analyze-evaluation/${evaluationId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        // Recarrega dados e deixa a UI mostrar o passo concluído
        await loadEvaluationData();
        setCurrentStep(5); // passo "completed"
      }
    } catch (error) {
      console.error('Error completing evaluation:', error);
      alert('Erro ao concluir avaliação');
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} currentPage={isEvaluator ? 'my-evaluations' : 'evaluations'} onNavigate={onNavigate} onLogout={onLogout}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!evaluation || !company) {
    return (
      <Layout user={user} currentPage={isEvaluator ? 'my-evaluations' : 'evaluations'} onNavigate={onNavigate} onLogout={onLogout}>
        <div className="text-center py-12">
          <p className="text-gray-600">Avaliação não encontrada</p>
        </div>
      </Layout>
    );
  }

  const steps = [
    { number: 1, title: 'Instruções', icon: FileText },
    { number: 2, title: 'Validar Voucher', icon: CheckCircle },
    { number: 3, title: 'Preencher Formulário', icon: FileText },
    { number: 4, title: 'Concluir', icon: Star },
  ];

  const renderAnswerValue = (question: any, value: any) => {
    if (value === undefined || value === null) return '—';
    if (!question) {
      return Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    switch (question.type) {
      case 'checkbox':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'matrix':
        return typeof value === 'object'
          ? Object.entries(value)
              .map(([row, col]) => `${row}: ${col}`)
              .join('; ')
          : String(value);
      default:
        return Array.isArray(value) ? value.join(', ') : String(value);
    }
  };

  return (
    <Layout user={user} currentPage={isEvaluator ? 'my-evaluations' : 'evaluations'} onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => onNavigate(isEvaluator ? 'my-evaluations' : 'evaluations')}
            className="inline-flex items-center gap-2 text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-2 -ml-2 mb-2"
          >
            ← Voltar
          </button>
          <h2 className="text-gray-900 mb-2">{company.name}</h2>
          <p className="text-gray-600">
            {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')} - {evaluation.period}
          </p>
        </div>

        {/* Resumo rápido para administradores/gerentes */}
        {!isEvaluator && (
          <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <UiTooltip
                open={statusTooltipOpen === 'voucher'}
                onOpenChange={(open) => setStatusTooltipOpen(open ? 'voucher' : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center h-10 w-10 rounded-full border ${
                      evaluation.voucherValidated
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                    aria-label="Voucher"
                    onClick={() => setStatusTooltipOpen((prev) => (prev === 'voucher' ? null : 'voucher'))}
                  >
                    <QrCode className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Voucher: {evaluation.voucherValidated ? 'validado' : 'pendente'}
                </TooltipContent>
              </UiTooltip>

              <UiTooltip
                open={statusTooltipOpen === 'survey'}
                onOpenChange={(open) => setStatusTooltipOpen(open ? 'survey' : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center h-10 w-10 rounded-full border ${
                      evaluation.stage === 'survey_submitted' ||
                      evaluation.surveyResponseId ||
                      evaluation.surveyData?.answers?.length
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                    aria-label="Questionário"
                    onClick={() => setStatusTooltipOpen((prev) => (prev === 'survey' ? null : 'survey'))}
                  >
                    <FilePenLine className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Questionário: {evaluation.stage === 'survey_submitted' || evaluation.surveyResponseId || evaluation.surveyData?.answers?.length ? 'enviado' : 'pendente'}
                </TooltipContent>
              </UiTooltip>

              <UiTooltip
                open={statusTooltipOpen === 'audio'}
                onOpenChange={(open) => setStatusTooltipOpen(open ? 'audio' : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center h-10 w-10 rounded-full border ${
                      evaluation.audioPath || evaluation.audioUrl
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                    aria-label="Áudio"
                    onClick={() => setStatusTooltipOpen((prev) => (prev === 'audio' ? null : 'audio'))}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Áudio: {evaluation.audioPath || evaluation.audioUrl ? 'enviado' : 'pendente'}
                </TooltipContent>
              </UiTooltip>

              <UiTooltip
                open={statusTooltipOpen === 'ai'}
                onOpenChange={(open) => setStatusTooltipOpen(open ? 'ai' : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center h-10 w-10 rounded-full border ${
                      evaluation.aiAnalysis
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'bg-gray-100 border-gray-200 text-gray-400'
                    }`}
                    aria-label="IA"
                    onClick={() => setStatusTooltipOpen((prev) => (prev === 'ai' ? null : 'ai'))}
                  >
                    <BrainCog className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  IA: {evaluation.aiAnalysis ? 'processada' : 'pendente'}
                </TooltipContent>
              </UiTooltip>
            </div>
            {evaluation.visitData && (
              <div className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><strong>Início:</strong> {evaluation.visitData.startTime || '-'}</div>
                <div><strong>Término:</strong> {evaluation.visitData.endTime || '-'}</div>
                <div><strong>Vendedores:</strong> {vendorsLabel}</div>
              </div>
            )}
          </div>
        )}

        {/* Progress Steps (for evaluators) */}
        {isEvaluator && evaluation.status !== 'completed' && (
          <div className="mb-6 sm:mb-8 bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`
                          w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2
                          ${isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
                        `}
                      >
                        {isCompleted ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </div>
                      <p className="text-xs sm:text-sm text-center text-gray-600">{step.title}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-1 sm:mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Instructions */}
        {isEvaluator && currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-gray-900 mb-4">Instruções Iniciais</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4">
                  <p className="text-gray-700">
                    <strong>Empresa:</strong> {company.name}
                  </p>
                  <p className="text-gray-700">
                    <strong>Endereço:</strong> {company.address}
                  </p>
                  {company.phone && (
                    <p className="text-gray-700">
                      <strong>Telefone:</strong> {company.phone}
                    </p>
                  )}
                </div>

                {evaluation.notes && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4">
                    <p className="text-gray-700">
                      <strong>Observações:</strong> {evaluation.notes}
                    </p>
                  </div>
                )}

                {company.standardPdfUrl && (
                  <div>
                    <h4 className="text-gray-900 mb-2">Padrão de Atendimento</h4>
                    <a
                      href={company.standardPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                    >
                      <Download className="w-5 h-5" />
                      Baixar PDF do Padrão
                    </a>
                  </div>
                )}

                <div className="bg-green-50 border-l-4 border-green-600 p-4">
                  <p className="text-gray-700">
                    <strong>Código do Voucher:</strong>{' '}
                    <span className="font-mono text-lg" style={{ wordBreak: 'break-all' }}>
                      {evaluation.voucherCode}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Apresente este código ao gerente após a avaliação para validação
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(2)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Iniciar Visita →
            </button>
          </div>
        )}

        {/* Step 2: Voucher Validation */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h3 className="text-gray-900 mb-4">Validação do Voucher</h3>

            {isEvaluator && !evaluation.voucherValidated && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4">
                  <p className="text-gray-700 mb-2">
                    <strong>Código do Voucher:</strong>{' '}
                    <span className="font-mono text-2xl" style={{ wordBreak: 'break-all' }}>
                      {evaluation.voucherCode}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Apresente este código ao gerente para validação. Aguarde a validação para continuar.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-shrink-0">
                    <QrCode className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-2">
                      Mostre este QR code para o gerente ler e validar o voucher.
                    </p>
                    <div className="inline-flex items-center justify-center bg-white p-3 rounded-lg border border-gray-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(evaluation.voucherCode)}`}
                        alt="QR code do voucher"
                        style={{ width: 160, height: 160 }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-gray-600">Aguardando validação do gerente...</p>
              </div>
            )}

            {isManager && !evaluation.voucherValidated && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700 mb-2">
                    <strong>Avaliador:</strong> {evaluator?.name}
                  </p>
                  <p className="text-gray-700">
                    <strong>Código do Voucher:</strong>{' '}
                    <span className="font-mono text-2xl" style={{ wordBreak: 'break-all' }}>
                      {evaluation.voucherCode}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Avalie o avaliador (1-5 estrelas)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setManagerRating(rating)}
                        className={`p-2 rounded-lg transition-colors ${
                          managerRating >= rating ? 'text-yellow-500' : 'text-gray-300'
                        }`}
                      >
                        <Star className="w-8 h-8" fill={managerRating >= rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">Observações sobre o avaliador</label>
                  <textarea
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Comportamento, postura, etc..."
                  />
                </div>

                <button
                  onClick={handleValidateVoucher}
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Validar Voucher
                </button>
              </div>
            )}

            {evaluation.voucherValidated && (
              <div className="space-y-4">
                <div className="bg-green-50 border-l-4 border-green-600 p-4">
                  <p className="text-gray-700">
                    ✓ Voucher validado com sucesso!
                  </p>
                </div>

                {isEvaluator && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Continuar para Formulário →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Form */}
        {isEvaluator && currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-gray-900 mb-4">Preencher Formulário</h3>
              {evaluation.surveyId || company.defaultSurveyId ? (
                <SurveyRenderer
                  surveyId={evaluation.surveyId || company.defaultSurveyId}
                  accessToken={accessToken}
                  evaluationId={evaluation.id}
                  onSubmitted={() => {
                    setCurrentStep(4);
                  }}
                />
              ) : company.surveyMonkeyLink ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Preencha o formulário de avaliação no SurveyMonkey
                  </p>
                  <a
                    href={company.surveyMonkeyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Abrir Formulário
                  </a>
                </div>
              ) : (
                <p className="text-gray-600">
                  Formulário não disponível para esta empresa
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Audio */}
        {isEvaluator && currentStep === 4 && evaluation.status !== 'completed' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-gray-900">Gravar Áudio da Avaliação</h4>
              {!controlsVisible && !audioBlob && (
                <button
                  onClick={() => {
                    setControlsVisible(true);
                    startRecording();
                  }}
                  className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Gravar
                </button>
              )}
            </div>

            {(controlsVisible || audioBlob) && (
              <div className="border rounded-2xl bg-[#f2f0ea] p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between text-gray-800 text-lg font-mono">
                  <div className="flex items-center gap-2">
                    {isPaused && (
                      <button
                        onClick={() => {
                          if (audioBlob) {
                            playAudio();
                          } else {
                            resumeRecording();
                          }
                        }}
                        className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-100 transition"
                        title="Reproduzir"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <span>
                      {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
                      {String(elapsedSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="w-full h-8 mx-3 flex items-center gap-1 overflow-hidden">
                    {Array.from({ length: 32 }).map((_, idx) => (
                      <span
                        key={idx}
                        className="w-1 rounded-full bg-gray-500"
                        style={{
                          height: `${8 + (idx % 5) * 4}px`,
                          animation: isRecording && !isPaused ? `pulse ${1 + (idx % 5) * 0.2}s ease-in-out infinite` : 'none',
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-sm text-gray-700">
                    {reachedLimit
                      ? 'Limite atingido'
                      : !audioBlob
                        ? (isRecording ? (isPaused ? 'pausado' : 'gravando') : 'pronto')
                        : 'gravado'}
                  </span>
                </div>

                <div className="flex items-center justify-around py-2">
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setIsRecording(false);
                      setIsPaused(false);
                      setElapsedSeconds(0);
                      elapsedBaseRef.current = 0;
                      setControlsVisible(false);
                      setReachedLimit(false);
                    }}
                    className="p-3 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
                    title="Descartar"
                    disabled={!isRecording && !audioBlob}
                  >
                    <Trash className="w-6 h-6 text-gray-700" />
                  </button>

                  <button
                    onClick={() => {
                      if (!isRecording && !audioBlob) {
                        setControlsVisible(true);
                        startRecording();
                      } else if (isRecording && !isPaused) {
                        pauseRecording();
                      } else if (isPaused) {
                        resumeRecording();
                      }
                    }}
                    className="p-4 rounded-full border-4"
                    style={{
                      borderColor: "#e11d48",
                      color: "#e11d48",
                      backgroundColor: "#fff",
                    }}
                    title={isRecording ? (isPaused ? "Retomar" : "Pausar") : "Iniciar"}
                  >
                    {isRecording ? (isPaused ? <Mic className="w-6 h-6" /> : <Pause className="w-6 h-6" />) : <Mic className="w-6 h-6" />}
                  </button>

                  <button
                    onClick={() => {
                      if (isRecording) {
                        sendAfterStopRef.current = true;
                        stopRecording();
                      } else if (audioBlob) {
                        handleCompleteEvaluation();
                      }
                    }}
                    className="p-4 rounded-full bg-black text-white hover:bg-gray-800 transition disabled:opacity-50"
                    title="Enviar"
                    disabled={!isRecording && !audioBlob}
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </div>

                {audioBlob && (
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <button
                      onClick={playAudio}
                      className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      {isPlaying ? 'Pausar' : 'Reproduzir'}
                    </button>
                    <span>Áudio gravado com sucesso.</span>
                  </div>
                )}
                {reachedLimit && (
                  <p className="text-xs text-red-600">Limite de gravação atingido. Ouça, envie ou descarte.</p>
                )}
              </div>
            )}
          </div>
        )}

        {isCompleting && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <div className="text-sm text-gray-800">Enviando sua avaliação...</div>
            </div>
          </div>
        )}

        {/* Completed */}
        {(evaluation.status === 'completed' || currentStep === 5) && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-gray-900 mb-2">Avaliação Concluída</h3>
              <p className="text-gray-600">
                Concluída em {new Date(evaluation.completedAt || evaluation.updatedAt || Date.now()).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {evaluation.aiAnalysis ? (
              <div className="bg-blue-50 rounded-lg p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h4 className="text-gray-900">Análise por IA</h4>
                  {(isAdmin || isManager || isPartner) && (
                    <button
                      onClick={() => {
                        // limpa análise atual para sinalizar loading enquanto reprocessa
                        setEvaluation((prev: any) => prev ? { ...prev, aiAnalysis: null } : prev);
                        handleReanalyze();
                      }}
                      disabled={reanalyzing}
                      className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {reanalyzing ? 'Reprocessando...' : 'Reprocessar IA'}
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white shadow-md rounded-lg p-4">
                      <p className="text-sm text-gray-500">Pontuação Geral</p>
                      <p className="text-2xl font-bold text-blue-800">
                        {overallScore100 != null ? overallScore100 : '--'}
                        <span className="text-xs text-gray-500 ml-2">/100</span>
                      </p>
                    </div>
                    <div className="bg-white shadow-md rounded-lg p-4">
                      <p className="text-sm text-gray-500">NPS</p>
                      <p className="text-2xl font-bold text-purple-800">{npsScore != null ? npsScore : '--'}</p>
                    </div>
                    <div className="bg-white shadow-md rounded-lg p-4">
                      <p className="text-sm text-gray-500">Média SERVIR</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {servirAvg != null ? servirAvg.toFixed(1) : '--'}
                      </p>
                    </div>
                    <div className="bg-white shadow-md rounded-lg p-4">
                      <p className="text-sm text-gray-500">Média GOLD</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {goldAvg != null ? goldAvg.toFixed(1) : '--'}
                      </p>
                    </div>
                  </div>

	                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
	                    <div className="bg-white shadow-md rounded-lg p-4">
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
                          <PolarAngleAxis
                            dataKey="pillar"
                            axisLine={false}
                            tickLine={false}
                            tick={renderServirAngleTick}
                          />
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
	                    <div className="bg-white shadow-md rounded-lg p-4">
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

                  <div className="bg-white shadow-md rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Resumo</p>
                    <p className="text-sm text-gray-700">{evaluation.aiAnalysis.summary || '—'}</p>
                    {(evaluation.aiAnalysis.strengths?.length || evaluation.aiAnalysis.improvements?.length) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {evaluation.aiAnalysis.strengths?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2">Pontos fortes</p>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                              {evaluation.aiAnalysis.strengths.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {evaluation.aiAnalysis.improvements?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2">Pontos de melhoria</p>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                              {evaluation.aiAnalysis.improvements.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setShowAiDetails((v) => !v)}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    {showAiDetails ? "Ocultar detalhes da análise" : "Ver detalhes da análise"}
                  </button>
                  {showAiDetails && (
                    <div className="mt-3 space-y-2 bg-white/50 border border-gray-200 rounded p-3">
                      <div>
                        <strong>Notas SERVIR:</strong>{" "}
                        {servirScoresOrdered.map(({ key, label, value }) => (
                          <span key={key} className="mr-2">
                            {label}:{value ?? "-"}
                          </span>
                        ))}
                      </div>
                      <div>
                        <strong>Notas GOLD:</strong>{" "}
                        {goldScoresOrdered.map(({ key, label, value }) => (
                          <span key={key} className="mr-2">
                            {label}:{value ?? "-"}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <span>SERVIR: {evaluation.aiAnalysis.servirAvg ?? "-"}</span>
                        <span>GOLD: {evaluation.aiAnalysis.goldAvg ?? "-"}</span>
                        <span>AG: {evaluation.aiAnalysis.agScore ?? "-"}</span>
                        <span>NPS: {evaluation.aiAnalysis.npsScore ?? "-"}</span>
                      </div>
                      {evaluation.aiAnalysis.recommendationsSeller && (
                        <div>
                          <strong>Recomendações (Vendedor):</strong>
                          <ul className="list-disc list-inside ml-4">
                            {evaluation.aiAnalysis.recommendationsSeller.map((r: string, i: number) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {evaluation.aiAnalysis.recommendationsManager && (
                        <div>
                          <strong>Recomendações (Gestor):</strong>
                          <ul className="list-disc list-inside ml-4">
                            {evaluation.aiAnalysis.recommendationsManager.map((r: string, i: number) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {evaluation.aiAnalysis.strategicInsights && (
                        <div>
                          <strong>Insights estratégicos:</strong>
                          <ul className="list-disc list-inside ml-4">
                            {evaluation.aiAnalysis.strategicInsights.map((r: string, i: number) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {evaluation.aiAnalysis.actionPlan && (
                        <div>
                          <strong>Plano de ação:</strong>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                            {["7dias","30dias","90dias"].map((k) => (
                              <div key={k} className="border border-gray-100 rounded p-2">
                                <div className="font-semibold text-gray-800">{k}</div>
                                <ul className="list-disc list-inside ml-3 text-gray-700 text-sm">
                                  {(evaluation.aiAnalysis.actionPlan[k] || []).map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 rounded-lg p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h4 className="text-gray-900">Análise por IA</h4>
                  {(isAdmin || isManager || isPartner) && (
                    <button
                      onClick={handleReanalyze}
                      disabled={reanalyzing}
                      className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {reanalyzing ? 'Reprocessando...' : 'Reprocessar IA'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700">Aguardando resultados da análise dos dados...</p>
              </div>
            )}

            {(evaluation.status === 'completed' || currentStep === 5) && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleGeneratePdf}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={pdfLoading}
                >
                  {pdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}
                </button>
                {evaluation.reportUrl && (
                  <a
                    href={evaluation.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Abrir último PDF
                  </a>
                )}
              </div>
            )}

            {/* Respostas do questionário */}
            {(evaluation.surveyData?.answers?.length || evaluation.attachments || evaluation.audioUrl) && (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-gray-900 mb-0">Respostas do questionário</h4>
                    {evaluation.surveyData?.answers?.length > 0 && (
                      <button
                        onClick={() => setShowAnswers((v) => !v)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {showAnswers ? "Ocultar respostas" : "Exibir respostas"}
                      </button>
                    )}
                  </div>
                  {showAnswers ? (
                    evaluation.surveyData?.answers?.length ? (
                      <div className="space-y-4 mt-4">
                        {surveyDetail?.sections ? (
                          surveyDetail.sections.map((section: any) => (
                            <div key={section.id} className="space-y-2">
                              <h5 className="font-semibold text-gray-800">{section.title}</h5>
                              <div className="space-y-3">
                                {section.questions.map((q: any) => {
                                  const ans = evaluation.surveyData.answers.find((a: any) => a.questionId === q.id);
                                  if (!ans) return null;
                                  return (
                                    <div key={q.id} className="border border-gray-100 rounded-lg p-3">
                                      <p className="text-sm font-medium text-gray-900">{q.title}</p>
                                      <p className="text-sm text-gray-700 mt-1" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                        {renderAnswerValue(q, ans.value)}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="space-y-2">
                            {evaluation.surveyData.answers.map((ans: any, idx: number) => (
                              <div key={ans.questionId || idx} className="border border-gray-100 rounded-lg p-3">
                                <p className="text-sm font-medium text-gray-900">Pergunta {idx + 1}</p>
                                <p className="text-sm text-gray-700 mt-1" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                  {renderAnswerValue(null, ans.value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm mt-2">Questionário não respondido.</p>
                    )
                  ) : (
                    <p className="text-gray-600 text-sm mt-2">
                      Clique em &quot;Exibir respostas&quot; para ver o detalhamento do questionário.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-gray-900 mb-0">Anexos</h4>
                      <button
                        type="button"
                        onClick={() => setAttachmentsOpen(true)}
                        disabled={!evaluation.attachments?.receipt && !evaluation.attachments?.photos?.length}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-60"
                      >
                        Ver anexos
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {evaluation.attachments?.receipt ? 'Com comprovante' : 'Sem comprovante'} •{' '}
                      {evaluation.attachments?.photos?.length ? `${evaluation.attachments.photos.length} foto(s)` : 'Nenhuma foto'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4 sm:p-6">
                    <h4 className="text-gray-900 mb-3">Áudio</h4>
                    {evaluation.audioUrl ? (
                      <audio controls className="w-full">
                        <source src={evaluation.audioUrl} />
                      </audio>
                    ) : (
                      <p className="text-gray-600 text-sm">Áudio não disponível.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {attachmentsOpen && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                onClick={() => setAttachmentsOpen(false)}
              >
                <div
                  className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-gray-900">Anexos</h3>
                      <button
                        type="button"
                        onClick={() => setAttachmentsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        aria-label="Fechar"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Comprovante e fotos enviados na avaliação.</p>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">Comprovante</p>
                      {evaluation.attachments?.receipt ? (
                        <a
                          href={evaluation.attachments.receipt.url || evaluation.attachments.receipt.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {evaluation.attachments.receipt.name || 'Abrir comprovante'}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-600">Não enviado.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">Fotos</p>
                      {evaluation.attachments?.photos?.length ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {evaluation.attachments.photos.map((p: any, idx: number) => (
                            <a
                              key={idx}
                              href={p.url || p.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                              title={p.name || `Foto ${idx + 1}`}
                            >
                              {p.url || p.path ? (
                                <img
                                  src={p.url || p.path}
                                  alt={p.name || `Foto ${idx + 1}`}
                                  className="w-full rounded-lg border border-gray-200"
                                  style={{ height: 120, objectFit: 'cover' }}
                                />
                              ) : (
                                <div className="w-full rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-600" style={{ height: 120 }}>
                                  Foto {idx + 1}
                                </div>
                              )}
                              <div className="text-xs text-gray-600 mt-1">{p.name || `Foto ${idx + 1}`}</div>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Nenhuma foto enviada.</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAttachmentsOpen(false)}
                        className="rounded-lg border bg-white px-4 py-2 hover:bg-gray-50"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
