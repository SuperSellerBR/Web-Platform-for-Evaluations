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
  X,
  ScanQrCode,
  CircleCheckBig,
  Building2,
  CalendarDays,
  MapPinHouse,
  Phone,
  Instagram,
  BookText,
  BookOpenText
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
import { formatFullName } from '../utils/name';
import { projectId } from '../utils/supabase/info';
import { SurveyRenderer } from './SurveyRenderer';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import servirHeader from '../../assets/SERVIR.png';
import servirHeaderDark from '../../assets/SERVIRW.png';
import goldHeader from '../../assets/GOLD.png';
import bannerImg from '../../assets/banner.png';
import { AudioRecorder } from './AudioRecorder';
import { useTheme } from '../utils/theme';

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
  const { resolvedTheme } = useTheme();
  const [evaluation, setEvaluation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [evaluator, setEvaluator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [surveyDetail, setSurveyDetail] = useState<{ survey: any; sections: any[] } | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>('audio/webm');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [managerRating, setManagerRating] = useState(5);
  const [managerNotes, setManagerNotes] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [receiptAttachment, setReceiptAttachment] = useState<{ name: string; url: string; path: string } | null>(null);
  const [photoAttachments, setPhotoAttachments] = useState<{ name: string; url: string; path: string }[]>([]);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string>('');
  const [completionErrors, setCompletionErrors] = useState<{ general?: string; receipt?: string; audio?: string }>({});
  const [startingVisit, setStartingVisit] = useState(false);
  const [startVisitError, setStartVisitError] = useState<string>('');
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [resolvedAudioSrc, setResolvedAudioSrc] = useState<{ src: string; type: string }>({ src: '', type: '' });
  const [audioError, setAudioError] = useState<string>('');
  const [audioDebugUrl, setAudioDebugUrl] = useState<string>('');
  const [audioSupportError, setAudioSupportError] = useState<string>('');
  const servirHeaderSrc = resolvedTheme === 'dark' ? servirHeaderDark : servirHeader;
  const isDark = resolvedTheme === 'dark';

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  type CompletionErrorKey = 'general' | 'receipt' | 'audio';
  const clearCompletionError = (key: CompletionErrorKey) => {
    setCompletionErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  useEffect(() => {
    // se houver áudio já salvo, tenta inferir mime pelo caminho/URL
    if (evaluation?.audioUrl) {
      const lower = evaluation.audioUrl.toLowerCase();
      if (lower.endsWith('.m4a') || lower.includes('audio/mp4')) {
        setRecordedMime('audio/mp4');
      } else if (lower.endsWith('.mp3')) {
        setRecordedMime('audio/mpeg');
      } else {
        setRecordedMime('audio/webm');
      }
    }
  }, [evaluation?.audioUrl]);

  useEffect(() => {
    if (!evaluation?.attachments) return;
    if (!receiptAttachment && evaluation.attachments.receipt) {
      setReceiptAttachment(evaluation.attachments.receipt);
    }
    if (photoAttachments.length === 0 && Array.isArray(evaluation.attachments.photos) && evaluation.attachments.photos.length) {
      setPhotoAttachments(evaluation.attachments.photos);
    }
  }, [evaluation?.attachments, receiptAttachment, photoAttachments.length]);

  const inferMimeFromUrl = (url: string | null | undefined) => {
    if (!url) return recordedMime || 'audio/mpeg';
    const lower = url.toLowerCase();
    if (lower.includes('.m4a') || lower.includes('.mp4')) return 'audio/mp4';
    if (lower.includes('.mp3')) return 'audio/mpeg';
    if (lower.includes('.webm')) return 'audio/webm';
    if (lower.includes('.ogg')) return 'audio/ogg';
    return recordedMime || 'audio/mpeg';
  };
  const BUCKET_NAME = 'make-7946999d-files';
  const normalizeStoragePath = (raw?: string | null) => {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    const safeDecode = (val: string) => {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    };

    // If we got a full Supabase storage URL, extract only the object path inside the bucket
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean); // storage/v1/object/sign/<bucket>/rest/of/path
      const objIndex = parts.indexOf('object');
      if (objIndex !== -1 && parts.length > objIndex + 3) {
        const pathParts = parts.slice(objIndex + 3); // skip object/<scope>/<bucket>
        const joined = safeDecode(pathParts.join('/'));
        return joined.startsWith(`${BUCKET_NAME}/`)
          ? joined.slice(BUCKET_NAME.length + 1)
          : joined;
      }
    } catch {
      // not a URL, continue with path heuristics
    }

    const noLeadingSlash = trimmed.replace(/^\/+/, '');
    const audiosIdx = noLeadingSlash.indexOf('audios/');
    const base = audiosIdx >= 0 ? noLeadingSlash.slice(audiosIdx) : noLeadingSlash;
    const decodedBase = safeDecode(base);
    if (base.startsWith(`${BUCKET_NAME}/`)) {
      return base.slice(BUCKET_NAME.length + 1);
    }
    return decodedBase;
  };

  const normalizedAudioPath = useMemo(
    () => normalizeStoragePath(evaluation?.audioPath || evaluation?.audioUrl || ''),
    [evaluation?.audioPath, evaluation?.audioUrl]
  );
  const toStoragePath = (path: string) => path.split('/').map((p) => encodeURIComponent(p)).join('/');

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

  // Resolve áudio para tocar, tentando baixar o blob e re-assinar a URL caso a original falhe
  useEffect(() => {
    if (evaluation?.audioUrl || evaluation?.audioPath) {
      console.log('[audio] carregando', { audioUrl: evaluation?.audioUrl, audioPath: evaluation?.audioPath, normalizedAudioPath });
    }
    let cancelled = false;
    let revokeUrl: string | null = null;

    const loadAudio = async () => {
      if (!evaluation?.audioUrl && !evaluation?.audioPath) {
        setResolvedAudioSrc({ src: '', type: '' });
        setAudioError('');
        setAudioDebugUrl('');
        setAudioSupportError('');
        return;
      }

      let success = false;
      let lastErrorMsg = '';

      const fetchBlob = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.blob();
      };

      const tryWithSignedUrl = async () => {
        const candidates: string[] = [];
        const rawPath = evaluation?.audioPath;
        const normalizedFromPath = normalizeStoragePath(rawPath);
        if (normalizedFromPath) candidates.push(normalizedFromPath);
        if (rawPath && rawPath.trim()) {
          const trimmed = rawPath.trim();
          candidates.push(trimmed);
          try {
            const decoded = decodeURIComponent(trimmed);
            candidates.push(decoded);
          } catch {}
          if (trimmed.startsWith(`${BUCKET_NAME}/`)) {
            candidates.push(trimmed.slice(BUCKET_NAME.length + 1));
          }
        }
        const normalizedFromUrl = normalizeStoragePath(evaluation?.audioUrl);
        if (normalizedFromUrl) candidates.push(normalizedFromUrl);

        const unique = Array.from(new Set(candidates.filter(Boolean)));
        if (!unique.length) throw new Error('no path');

        let lastErr: any = null;
        for (const path of unique) {
          try {
            // Tenta com path decodificado e codificado; algumas versões do edge podem não decodificar query
            const pathCandidates = [path, encodeURIComponent(path)];
            for (const pathParam of pathCandidates) {
              const signedUrl = `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/file?path=${pathParam}`;
              const res = await fetch(signedUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: 'no-store',
              });
              const data = await res.json().catch(() => null);
              if (!res.ok || !data?.url) {
                lastErr = new Error(`signed url fail: ${res.status} (${pathParam})`);
                console.log('[audio] signed url miss', { path, pathParam, status: res.status, body: data });
                continue;
              }
              const blob = await fetchBlob(data.url);
              if (cancelled) return;
              const url = URL.createObjectURL(blob);
              revokeUrl = url;
            setResolvedAudioSrc({ src: url, type: blob.type || inferMimeFromUrl(data.url) });
            setAudioDebugUrl(data.url);
            setAudioError('');
            setAudioSupportError('');
            success = true;
            console.log('[audio] signed url ok', { path, pathParam, type: blob.type, size: blob.size });
            return;
          }
        } catch (err) {
          lastErr = err;
          lastErrorMsg = String(err?.message || err);
          console.log('[audio] signed url error', { path, err });
        }
      }

      throw lastErr || new Error('signed url fail');
      };

      const tryWithStorageApi = async () => {
        const rawPath = normalizedAudioPath || normalizeStoragePath(evaluation?.audioUrl) || '';
        if (!rawPath) throw new Error('no storage path');
        const storageUrl = `https://${projectId}.supabase.co/storage/v1/object/authenticated/${BUCKET_NAME}/${toStoragePath(rawPath)}`;
        const res = await fetch(storageUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`storage api status ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setResolvedAudioSrc({ src: url, type: blob.type || inferMimeFromUrl(storageUrl) });
        setAudioDebugUrl(storageUrl);
        setAudioError('');
        setAudioSupportError('');
        success = true;
        console.log('[audio] storage api ok', { storageUrl, type: blob.type, size: blob.size });
      };

      const tryWithDirectUrl = async () => {
        const direct = evaluation?.audioUrl;
        if (!direct) throw new Error('no direct url');
        const blob = await fetchBlob(direct);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setResolvedAudioSrc({ src: url, type: blob.type || inferMimeFromUrl(direct) });
        setAudioDebugUrl(direct);
        setAudioError('');
        setAudioSupportError('');
        success = true;
        console.log('[audio] direct url ok', { type: blob.type, size: blob.size });
      };

      try {
        // Prefira re-assinar usando o path salvo (evita URLs expiradas)
        await tryWithSignedUrl();
      } catch (err) {
        console.log('Audio load via signed url failed', err);
        try {
          await tryWithStorageApi();
        } catch (err3) {
          lastErrorMsg = String(err3?.message || err3) || lastErrorMsg;
          console.log('Audio load via storage api failed', err3);
        }
        try {
          await tryWithDirectUrl();
        } catch (err2) {
          lastErrorMsg = String(err2?.message || err2) || lastErrorMsg;
          console.log('Audio load via direct url failed', err2);
          if (cancelled) return;
          const fallback = evaluation?.audioUrl || '';
          setAudioError('Não foi possível reproduzir automaticamente. Tente abrir o áudio em outra aba.');
          setAudioDebugUrl(fallback);
          setResolvedAudioSrc({ src: fallback, type: inferMimeFromUrl(fallback) });
        }
      }

      if (!success) {
        const fallback = evaluation?.audioUrl || '';
        setAudioError(lastErrorMsg || 'Não foi possível carregar o áudio (ver console).');
        setAudioDebugUrl(fallback);
        setResolvedAudioSrc({ src: fallback, type: inferMimeFromUrl(fallback) });
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [accessToken, normalizedAudioPath, evaluation?.audioUrl]);

  // Verifica suporte do navegador para o mime carregado
  useEffect(() => {
    const type = resolvedAudioSrc.type || inferMimeFromUrl(evaluation?.audioUrl);
    if (!resolvedAudioSrc.src && !evaluation?.audioUrl) {
      setAudioSupportError('');
      return;
    }
    const audioEl = document.createElement('audio');
    const support = type ? audioEl.canPlayType(type) : 'maybe';
    if (type && !support) {
      setAudioSupportError(`Seu navegador não suporta este formato (${type}). Abra o áudio em outra aba ou use Chrome/Edge.`);
    } else {
      setAudioSupportError('');
    }
  }, [resolvedAudioSrc, evaluation?.audioUrl]);

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
    if (startingVisit) return;
    // Poll apenas na tela do voucher (evita "voltar" para instruções durante transições)
    if (!isEvaluator) return;
    if (currentStep !== 2) return;
    if (!evaluation || evaluation.voucherValidated || evaluation.status === 'completed') return;
    // Poll for updates so the evaluator sees validation without refresh
    const interval = setInterval(() => {
      loadEvaluationData();
    }, 4000);
    return () => clearInterval(interval);
  }, [evaluation, evaluationId, startingVisit, currentStep, isEvaluator]);

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
	        } else if (
	          evaluationData.evaluation.stage === 'survey_submitted' ||
	          evaluationData.evaluation.surveyResponseId ||
	          evaluationData.evaluation.surveyData?.answers?.length
	        ) {
	          setCurrentStep(4);
	        } else if (evaluationData.evaluation.voucherValidated) {
	          setCurrentStep(3);
	        } else if (evaluationData.evaluation.status === 'in_progress') {
	          setCurrentStep(2);
	        } else {
	          setCurrentStep(1);
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
      let mediaRecorder: MediaRecorder;
      const preferred = ['audio/mp4', 'audio/m4a', 'audio/webm'];
      const supportedMime = preferred.find((mime) => (MediaRecorder as any).isTypeSupported?.(mime));
      if (supportedMime) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime });
        setRecordedMime(supportedMime);
      } else {
        mediaRecorder = new MediaRecorder(stream);
        setRecordedMime(mediaRecorder.mimeType || 'audio/webm');
      }
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      elapsedBaseRef.current = 0;
      setElapsedSeconds(0);

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMime || 'audio/webm' });
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

  const playAudio = (sourceBlob?: Blob | null) => {
    const blobToPlay = sourceBlob ?? audioBlob;
    if (blobToPlay && !isPlaying) {
      const audioUrl = URL.createObjectURL(blobToPlay);
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

  const uploadAttachmentFile = async (file: File, folder: 'receipt' | 'photo' | 'audios') => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('folder', folder);

    const uploadRes = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      },
    );
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData?.error || 'Erro ao enviar arquivo');
    }
    return { name: file.name, url: uploadData.url, path: uploadData.path };
  };

  const persistAttachments = async (next: { receipt: any | null; photos: any[] }) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attachments: next,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.evaluation) {
        setEvaluation(data.evaluation);
      }
    } catch {
      // não bloqueia; os arquivos já subiram para o storage
    }
  };

  const handleCompleteEvaluation = async (blobOverride?: Blob | null) => {
    const blobToSend = blobOverride ?? audioBlob;
    const effectiveReceipt = receiptAttachment ?? evaluation?.attachments?.receipt ?? null;
    const effectivePhotos = photoAttachments.length ? photoAttachments : (evaluation?.attachments?.photos ?? []);
    const nextErrors: { general?: string; receipt?: string; audio?: string } = {};
    if (!blobToSend) nextErrors.audio = 'Por favor, grave o áudio da avaliação.';
    if (attachmentsUploading) nextErrors.general = 'Aguarde o envio dos anexos terminar.';
    if (!effectiveReceipt) nextErrors.receipt = 'Por favor, anexe o comprovante de consumo.';
    if (Object.keys(nextErrors).length > 0) {
      setCompletionErrors(nextErrors);
      return;
    }

    try {
      setCompletionErrors({});
      setIsCompleting(true);
      const finalBlob = blobToSend;
      const mimeToUse = finalBlob.type || recordedMime || 'audio/mp4';
      setRecordedMime(mimeToUse);
      // Upload audio
      const formData = new FormData();
      const ext = mimeToUse.includes('mp4') || mimeToUse.includes('m4a')
        ? 'm4a'
        : 'webm';
      formData.append('file', finalBlob, `evaluation-audio.${ext}`);
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

      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadData?.error || 'Erro ao enviar áudio');
      }
      if (!uploadData?.path || !uploadData?.url) {
        throw new Error('Erro ao enviar áudio: resposta inválida do servidor');
      }

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
            attachments: {
              receipt: effectiveReceipt,
              photos: effectivePhotos,
            },
            completedAt: new Date().toISOString(),
          }),
        }
      );

      const updateData = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        throw new Error(updateData?.error || 'Erro ao concluir avaliação');
      }

      // Recarrega dados e deixa a UI mostrar o passo concluído
      await loadEvaluationData();
      setCurrentStep(5); // passo "completed"
    } catch (error) {
      console.error('Error completing evaluation:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao concluir avaliação';
      setCompletionErrors({ general: message });
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
    { number: 2, title: 'Voucher', icon: ScanQrCode },
    { number: 3, title: 'Formulário', icon: FilePenLine },
    { number: 4, title: 'Concluir', icon: CircleCheckBig },
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    try {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return `R$ ${value}`;
    }
  };

  return (
    <Layout user={user} currentPage={isEvaluator ? 'my-evaluations' : 'evaluations'} onNavigate={onNavigate} onLogout={onLogout}>
      <div
        className={`max-w-4xl mx-auto evaluation-detail-page text-foreground ${isDark ? 'evaluation-dark' : 'evaluation-light'}`}
      >
        {/* Header */}
        <div className="mb-2 sm:mb-3">
          <button
            onClick={() => onNavigate(isEvaluator ? 'my-evaluations' : 'evaluations')}
            className="inline-flex items-center gap-2 text-primary hover:bg-primary/10 rounded-lg px-2 py-2 -ml-2 mb-2"
          >
            ← Voltar
          </button>
        </div>

        {/* Resumo rápido para administradores/gerentes (exibido somente enquanto não concluída) */}
        {!isEvaluator && evaluation.status !== 'completed' && (
          <div className="mb-6 sm:mb-8 bg-card border border-border rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-4">
              {evaluation.visitData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <div className="sm:col-span-3 rounded-lg border border-border bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Vendedores</p>
                    <p className="text-base font-semibold text-foreground">{vendorsLabel || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="text-base font-semibold text-foreground">{evaluation.visitData.startTime || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Término</p>
                    <p className="text-base font-semibold text-foreground">{evaluation.visitData.endTime || '—'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Dados da visita não informados.</div>
              )}

              <div className="flex items-center gap-2 flex-shrink-0 justify-start sm:justify-end">
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
                    Questionário:{' '}
                    {evaluation.stage === 'survey_submitted' || evaluation.surveyResponseId || evaluation.surveyData?.answers?.length
                      ? 'enviado'
                      : 'pendente'}
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
            </div>
          </div>
        )}

        {/* Progress Steps (for evaluators) */}
        {isEvaluator && evaluation.status !== 'completed' && (
          <div className="mb-2 sm:mb-3 bg-card border border-border rounded-lg shadow-md p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;
                return (
                  <div
                    key={step.number}
                    className={`
                      flex flex-col items-center justify-center flex-1 rounded-xl px-2 py-2 transition-colors border border-transparent
                      ${isActive
                        ? 'bg-gray-100 text-blue-700 dark:bg-slate-800 dark:text-primary'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-200'}
                    `}
                  >
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center mb-2
                        ${isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-blue-600 text-white dark:bg-primary'
                            : 'bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-200'}
                      `}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="text-xs sm:text-sm text-center">{step.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Instructions */}
        {isEvaluator && currentStep === 1 && (
          <div className="bg-card border border-border rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-foreground mb-1">Instruções Iniciais</h3>
              <div className="bg-white/50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3 p-2 rounded-lg">
                  <Building2 className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Loja</p>
                    <p className="font-semibold text-foreground">{company.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg">
                  <CalendarDays className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data / Período</p>
                    <p className="font-semibold text-foreground">
                      {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')} - {evaluation.period || '—'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!company.address) return;
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`;
                    window.open(url, '_blank');
                  }}
                  className="flex items-start gap-3 text-left hover:bg-gray-100 dark:hover:bg-slate-700/60 rounded-lg p-2 transition-colors"
                >
                  <MapPinHouse className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-medium text-foreground leading-relaxed">{company.address || '—'}</p>
                  </div>
                </button>
                {company.phone && (
                  <button
                    type="button"
                    onClick={() => window.open(`tel:${company.phone}`, '_self')}
                    className="flex items-start gap-3 text-left hover:bg-blue-100 dark:hover:bg-primary/15 rounded-lg p-2 transition-colors"
                  >
                    <Phone className="w-5 h-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-semibold text-foreground">{company.phone}</p>
                    </div>
                  </button>
                )}
                {company.instagram && (
                  <button
                    type="button"
                    onClick={() => {
                      const handle = company.instagram.replace('@', '').trim();
                      const url = `https://instagram.com/${handle}`;
                      window.open(url, '_blank');
                    }}
                    className="flex items-start gap-3 text-left hover:bg-blue-100 dark:hover:bg-primary/15 rounded-lg p-2 transition-colors"
                  >
                    <Instagram className="w-5 h-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Instagram</p>
                      <p className="font-semibold text-foreground">@{company.instagram.replace('@', '').trim()}</p>
                    </div>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg divide-y divide-gray-200 dark:divide-border">
                <button
                  type="button"
                  onClick={() => {
                    if (company.standardPdfUrl) {
                      window.open(company.standardPdfUrl, '_blank');
                    } else {
                      alert('Padrão de atendimento não disponível.');
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-foreground font-medium">Padrão de atendimento</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-muted text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookOpenText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-foreground font-medium">Instruções</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {startVisitError && (
              <p className="text-sm text-red-600 dark:text-red-200">{startVisitError}</p>
            )}

            <button
              onClick={async () => {
                if (!evaluationId) return;
                setStartVisitError('');
                setStartingVisit(true);
                try {
                  const res = await fetch(
                    `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${evaluationId}`,
                    {
                      method: 'PUT',
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        status: 'in_progress',
                        startedAt: new Date().toISOString(),
                      }),
                    }
                  );
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(data?.error || 'Erro ao iniciar visita');
                  }
                  if (data?.evaluation) {
                    setEvaluation(data.evaluation);
                  } else {
                    setEvaluation((prev: any) => (prev ? { ...prev, status: 'in_progress' } : prev));
                  }
                  setCurrentStep(2);
                } catch (err: any) {
                  const message =
                    err instanceof Error ? err.message : 'Erro ao iniciar visita';
                  setStartVisitError(message);
                } finally {
                  setStartingVisit(false);
                }
              }}
              disabled={startingVisit}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
            >
              {startingVisit ? 'Iniciando...' : 'Iniciar Visita →'}
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div
              className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-200"
              style={{ borderRadius: '12px' }}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center font-semibold">
                      {company.name?.[0] || 'L'}
                    </div>
                  )}
                  <p className="text-lg font-semibold text-gray-900">{company.name}</p>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(
                    parseNumber(
                      evaluation.voucherValue ?? evaluation.visitData?.voucherValue ?? company?.voucherValue
                    )
                  )}
                </p>
              </div>

              <img src={bannerImg} alt="Banner da loja" className="w-full h-40 sm:h-52 object-cover" />

              <div className="px-4 sm:px-6 py-6 bg-white">
                <div className="flex justify-center mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(evaluation.voucherCode || '')}`}
                    alt="QR code do voucher"
                    className="w-56 h-56"
                  />
                </div>
                <div
                  className="text-center text-lg text-gray-900 tracking-[0.2em] mb-4"
                  style={{ wordBreak: 'break-all', fontFamily: 'OCRA, monospace' }}
                >
                  {evaluation.voucherCode}
                </div>
                <div className="space-y-2 text-center text-gray-700 text-sm">
                  <p className="font-medium">Aguardando a validação do gerente...</p>
                  <p>Apresente este QR code para o gerente ler e validar o voucher.</p>
                </div>
              </div>
            </div>

            {isManager && !evaluation.voucherValidated && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700 mb-2">
                    <strong>Avaliador:</strong> {formatFullName(evaluator?.name, evaluator?.lastName)}
                  </p>
                  <p className="text-gray-700">
                    <strong>Código do Voucher:</strong>{' '}
                    <span className="font-mono text-2xl" style={{ wordBreak: 'break-all' }}>
                      {evaluation.voucherCode}
                    </span>
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-gray-700 mb-2">Nota</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setManagerRating(rating)}
                          className={`p-2 rounded-lg transition-colors ${
                            managerRating >= rating ? 'text-yellow-500' : 'text-gray-300'
                          }`}
                        >
                          <Star
                            className="w-7 h-7"
                            fill={managerRating >= rating ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-gray-700">Observações</label>
                  <textarea
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Comportamento, postura, pontualidade..."
                  />
                </div>

                <button
                  onClick={handleValidate}
                  disabled={validationLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {validationLoading ? 'Validando...' : 'Validar Voucher'}
                </button>
              </div>
            )}

            {evaluation.voucherValidated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-green-800 font-medium">
                    Voucher validado
                  </p>
                  {evaluation.managerRating && (
                    <p className="text-green-700 text-sm">
                      Nota do gerente: {evaluation.managerRating}/5
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Form */}
        {isEvaluator && currentStep === 3 && (
          <div className="bg-card border border-border rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-foreground mb-4">Preencher Formulário</h3>
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
                  <p className="text-muted-foreground">
                    Preencha o formulário de avaliação no SurveyMonkey
                  </p>
                  <a
                    href={company.surveyMonkeyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors w-full sm:w-auto"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Abrir Formulário
                  </a>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Formulário não disponível para esta empresa
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Audio */}
        {isEvaluator && currentStep === 4 && evaluation.status !== 'completed' && (
          <div className="bg-card border border-border rounded-lg shadow-md p-4 sm:p-6 space-y-4">
            <h4 className="text-foreground">Concluir Avaliação</h4>

            {attachmentsError && (
              <p className="text-sm text-red-600 dark:text-red-200">{attachmentsError}</p>
            )}
            {completionErrors.general && (
              <p className="text-sm text-red-600 dark:text-red-200">{completionErrors.general}</p>
            )}

            <div className="space-y-4">
              <div
                className={`rounded-lg border bg-card/70 p-4 space-y-2 ${
                  completionErrors.receipt ? 'border-red-500' : 'border-border'
                }`}
              >
                <h5 className="text-foreground font-medium">Comprovante de consumo (obrigatório)</h5>
                {!receiptAttachment ? (
                  <label className="block w-full">
                    <span className="text-sm text-muted-foreground mb-2 block">
                      Clique para anexar o comprovante (imagem ou PDF)
                    </span>
                    <div className="w-full h-24 rounded-md border-2 border-dashed border-border bg-muted/40 hover:bg-muted/60 text-muted-foreground flex flex-col items-center justify-center gap-2 text-sm cursor-pointer">
                      <span className="font-medium text-foreground">+ Selecionar arquivo</span>
                      <span className="text-xs text-muted-foreground">Formatos aceitos: imagem ou PDF</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      disabled={attachmentsUploading || isCompleting}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAttachmentsError('');
                        clearCompletionError('receipt');
                        setAttachmentsUploading(true);
                        try {
                          const uploaded = await uploadAttachmentFile(file, 'receipt');
                          setReceiptAttachment(uploaded);
                          await persistAttachments({
                            receipt: uploaded,
                            photos: photoAttachments.length ? photoAttachments : (evaluation.attachments?.photos ?? []),
                          });
                        } catch (err: any) {
                          setAttachmentsError(err?.message || 'Erro ao enviar comprovante');
                        } finally {
                          setAttachmentsUploading(false);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2">
                    <span className="text-sm text-foreground truncate">{receiptAttachment.name}</span>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={async () => {
                        setReceiptAttachment(null);
                        clearCompletionError('receipt');
                        await persistAttachments({
                          receipt: null,
                          photos: photoAttachments.length ? photoAttachments : (evaluation.attachments?.photos ?? []),
                        });
                      }}
                    >
                      Remover
                    </button>
                  </div>
                )}
                {completionErrors.receipt && (
                  <p className="text-sm text-red-600 dark:text-red-200">{completionErrors.receipt}</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card/70 p-4 space-y-2">
                <h5 className="text-foreground font-medium">Fotos do local (opcional)</h5>
                <label className="block w-full">
                  <span className="text-sm text-muted-foreground mb-2 block">
                    Clique para selecionar uma ou mais fotos
                  </span>
                  <div className="w-full h-24 rounded-md border-2 border-dashed border-border bg-muted/40 hover:bg-muted/60 text-muted-foreground flex flex-col items-center justify-center gap-2 text-sm cursor-pointer">
                    <span className="font-medium text-foreground">+ Selecionar fotos</span>
                    <span className="text-xs text-muted-foreground">Você pode escolher múltiplas imagens</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={attachmentsUploading || isCompleting}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setAttachmentsError('');
                      setAttachmentsUploading(true);
                      try {
                        const uploadedAll: any[] = [];
                        for (const f of files) {
                          const up = await uploadAttachmentFile(f, 'photo');
                          uploadedAll.push(up);
                        }
                        const basePhotos = photoAttachments.length
                          ? photoAttachments
                          : (evaluation.attachments?.photos ?? []);
                        const nextPhotos = [...basePhotos, ...uploadedAll];
                        setPhotoAttachments(nextPhotos);
                        await persistAttachments({
                          receipt: receiptAttachment ?? evaluation.attachments?.receipt ?? null,
                          photos: nextPhotos,
                        });
                      } catch (err: any) {
                        setAttachmentsError(err?.message || 'Erro ao enviar fotos');
                      } finally {
                        setAttachmentsUploading(false);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </label>
                {photoAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {photoAttachments.map((p: any, idx: number) => (
                      <div
                        key={`${p.path || p.url || p.name}-${idx}`}
                        className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2"
                      >
                        <span className="text-sm text-foreground truncate">{p.name}</span>
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={async () => {
                            const next = photoAttachments.filter((_, i) => i !== idx);
                            setPhotoAttachments(next);
                            await persistAttachments({
                              receipt: receiptAttachment ?? evaluation.attachments?.receipt ?? null,
                              photos: next,
                            });
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`rounded-lg border bg-card/70 p-4 space-y-3 ${
                completionErrors.audio ? 'border-red-500' : 'border-border'
              }`}
            >
              <h5 className="text-foreground font-medium">Áudio da avaliação (obrigatório)</h5>
              <AudioRecorder
                onAudioReady={(blob) => {
                  setAudioBlob(blob);
                  setRecordedMime(blob.type || 'audio/mp4');
                  clearCompletionError('audio');
                }}
                onClear={() => {
                  setAudioBlob(null);
                  clearCompletionError('audio');
                }}
              />
              {completionErrors.audio && (
                <p className="text-sm text-red-600 dark:text-red-200">{completionErrors.audio}</p>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => handleCompleteEvaluation()}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition disabled:opacity-50 w-full sm:w-2/3 md:w-1/2 text-center font-medium"
                disabled={isCompleting || attachmentsUploading}
              >
                {isCompleting ? 'Enviando...' : 'Concluir Avaliação'}
              </button>
            </div>
          </div>
        )}

        {(isCompleting || attachmentsUploading) && (
          <div className="fixed inset-0 z-50 backdrop-blur-sm bg-black/50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3 border border-gray-200 dark:border-slate-700">
              <div className="w-6 h-6 border-2 border-gray-300 dark:border-slate-500 border-t-blue-600 rounded-full animate-spin" />
              <div className="text-sm text-gray-800 dark:text-slate-100">
                {attachmentsUploading ? 'Enviando arquivo...' : 'Enviando sua avaliação...'}
              </div>
            </div>
          </div>
        )}

        {/* Completed */}
        {isEvaluator && (evaluation.status === 'completed' || currentStep === 5) && (
          <div className="bg-card border border-border rounded-lg shadow-md p-6 sm:p-8 text-center space-y-4">
            <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/15">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-foreground text-xl font-semibold">Obrigado!</h3>
              <p className="text-muted-foreground">
                Sua avaliação foi enviada com sucesso.
              </p>
              <p className="text-muted-foreground">
                Você já pode fechar esta página.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => onNavigate('my-evaluations')}
                className="w-full sm:w-auto px-5 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
              >
                Voltar para Minhas Avaliações
              </button>
            </div>
          </div>
        )}

        {(!isEvaluator) && (evaluation.status === 'completed' || currentStep === 5) && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-gray-900 mb-1">
                Avaliação Concluída em{' '}
                {new Date(evaluation.completedAt || evaluation.updatedAt || Date.now()).toLocaleDateString('pt-BR')}
              </h3>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center gap-4">
                {company?.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company?.name || 'Empresa'}
                    className="w-12 h-12 rounded-full object-cover border border-border bg-muted"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center font-semibold text-foreground">
                    {String(company?.name || 'E').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-lg font-semibold text-foreground truncate">
                    {company?.name || '—'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vendedores: <span className="text-foreground">{vendorsLabel || '—'}</span>
                  </p>
                </div>
              </div>
            </div>

            {evaluation.aiAnalysis ? (
              <div className="bg-blue-50 rounded-lg p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h4 className="text-gray-900">Análise por IA</h4>
                  {isAdmin && (
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
	                        src={servirHeaderSrc}
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
	                          <Bar
                              dataKey="value"
                              fill="#f59e0b"
                              stroke="#f59e0b"
                              fillOpacity={0.72}
                              radius={[4, 4, 0, 0]}
                              label={renderGoldBarLabel}
                            />
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
                    className="mt-3 text-sm hover:underline"
                    style={{ color: '#0f172a' }}
                  >
                    {showAiDetails ? "Ocultar detalhes da análise" : "Ver detalhes da análise"}
                  </button>
                  {showAiDetails && (
                    <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 text-sm text-gray-700">
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
                              <div key={k} className="border border-border rounded-md p-3 bg-muted">
                                <div className="font-semibold text-gray-800">{k}</div>
                                <ul className="list-disc list-inside ml-3 text-muted-foreground">
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
                  {isAdmin && (
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
                <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-foreground mb-0">Respostas do questionário</h4>
                    {evaluation.surveyData?.answers?.length > 0 && (
                      <button
                        onClick={() => setShowAnswers((v) => !v)}
                        className="text-sm text-primary hover:underline"
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
                              <h5 className="font-semibold text-foreground">{section.title}</h5>
                              <div className="space-y-3">
                                {section.questions.map((q: any) => {
                                  const ans = evaluation.surveyData.answers.find((a: any) => a.questionId === q.id);
                                  if (!ans) return null;
                                  return (
                                    <div key={q.id} className="border border-border rounded-lg p-3 bg-card/70">
                                      <p className="text-sm font-medium text-foreground">{q.title}</p>
                                      <p className="text-sm text-muted-foreground mt-1" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
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
                              <div key={ans.questionId || idx} className="border border-border rounded-lg p-3 bg-card/70">
                                <p className="text-sm font-medium text-foreground">Pergunta {idx + 1}</p>
                                <p className="text-sm text-muted-foreground mt-1" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                  {renderAnswerValue(null, ans.value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm mt-2">Questionário não respondido.</p>
                    )
                  ) : (
                    <p className="text-muted-foreground text-sm mt-2">
                      Clique em &quot;Exibir respostas&quot; para ver o detalhamento do questionário.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-foreground mb-0">Anexos</h4>
                      <button
                        type="button"
                        onClick={() => setAttachmentsOpen(true)}
                        disabled={!evaluation.attachments?.receipt && !evaluation.attachments?.photos?.length}
                        className="text-sm text-primary hover:underline disabled:opacity-60"
                      >
                        Ver anexos
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {evaluation.attachments?.receipt ? 'Com comprovante' : 'Sem comprovante'} •{' '}
                      {evaluation.attachments?.photos?.length ? `${evaluation.attachments.photos.length} foto(s)` : 'Nenhuma foto'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                    <h4 className="text-foreground mb-3">Áudio</h4>
                    {evaluation.audioUrl ? (
                      <div className="space-y-2">
                        <audio
                          key={`${resolvedAudioSrc.src || evaluation.audioUrl}-${resolvedAudioSrc.type || ''}`}
                          controls
                          preload="auto"
                          className="w-full"
                          controlsList="nodownload"
                        >
                          <source
                            src={resolvedAudioSrc.src || evaluation.audioUrl}
                            type={resolvedAudioSrc.type || inferMimeFromUrl(evaluation.audioUrl)}
                          />
                          Seu navegador não conseguiu reproduzir o áudio.
                        </audio>
                        {audioError && (
                          <p className="text-sm text-red-600 dark:text-red-200">
                            {audioError}
                            {audioDebugUrl ? (
                              <>
                                {' '}
                                (<a href={audioDebugUrl} target="_blank" rel="noreferrer" className="underline">
                                  tentar link direto
                                </a>)
                              </>
                            ) : null}
                          </p>
                        )}
                        {audioSupportError && (
                          <p className="text-sm text-orange-600 dark:text-orange-200">
                            {audioSupportError}{' '}
                            {audioDebugUrl ? (
                              <a href={audioDebugUrl} target="_blank" rel="noreferrer" className="underline">
                                abrir áudio
                              </a>
                            ) : null}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Áudio não disponível.</p>
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

      {instructionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-2xl p-4 sm:p-6 relative">
            <button
              onClick={() => setInstructionsOpen(false)}
              className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              aria-label="Fechar instruções"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Instruções da visita</h3>
              <p className="text-sm text-muted-foreground">
                Siga estas orientações ao realizar a visita e ao usar o voucher.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Apresente-se como cliente comum, sem revelar que é avaliador.</li>
                <li>Utilize o voucher conforme combinado com o gerente e aguarde a validação.</li>
                <li>Preencha o formulário logo após a visita, enquanto as informações estão frescas.</li>
                <li>Grave o áudio de feedback com clareza, em ambiente silencioso.</li>
                {evaluation.notes && <li>Observações específicas: {evaluation.notes}</li>}
              </ul>
              <div className="flex justify-end">
                <button
                  onClick={() => setInstructionsOpen(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
