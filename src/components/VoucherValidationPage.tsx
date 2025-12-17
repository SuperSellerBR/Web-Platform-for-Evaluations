import { useEffect, useRef, useState } from 'react';
import { Layout } from './Layout';
import { CheckCircle, QrCode, Star, StopCircle, Camera, X, FilePenLine, Mic, BrainCog } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import type { IBrowserCodeReader, IScannerControls } from '@zxing/browser';
import { WalletCardItem, WalletCardStack } from './WalletCardStack';
import { formatFullName } from '../utils/name';
import { useTheme } from '../utils/theme';

interface VoucherValidationPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

type LookupResult = {
  evaluation: any;
  company?: any;
  evaluator?: any;
};

export function VoucherValidationPage({
  user,
  accessToken,
  onNavigate,
  onLogout,
}: VoucherValidationPageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [voucherCode, setVoucherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [managerRating, setManagerRating] = useState(5);
  const [scanError, setScanError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<IBrowserCodeReader | null>(null);
  const decodeControlsRef = useRef<IScannerControls | null>(null);
  const lastErrorRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const fetchEvaluation = async (code: string) => {
    setError('');
    setLoading(true);
    setLookup(null);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/by-voucher/${code}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Voucher não encontrado');
        return;
      }

      const data = await response.json();
      setLookup(data);
      setManagerRating(5);
      setManagerNotes('');
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    await fetchEvaluation(voucherCode.trim().toUpperCase());
  };

  const handleValidate = async () => {
    if (!lookup?.evaluation?.id) return;
    const trimmedNotes = managerNotes.trim();
    if (managerRating <= 3 && !trimmedNotes) {
      setError('Para notas de 3 ou menos, preencha as observações antes de validar.');
      return;
    }
    setValidationLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations/${lookup.evaluation.id}/validate-voucher`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            managerRating,
            managerNotes,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Erro ao validar voucher');
        return;
      }

      const data = await response.json();
      setLookup({
        ...lookup,
        evaluation: data.evaluation,
      });
    } catch (err) {
      console.error(err);
      setError('Erro ao validar voucher');
    } finally {
      setValidationLoading(false);
    }
  };

  const stopScanning = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      decodeControlsRef.current?.stop();
    } catch (_) {
      // ignore
    }
    decodeControlsRef.current = null;
    try {
      zxingReaderRef.current?.reset();
    } catch (_) {
      // ignore
    }
    zxingReaderRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanError('');
    setScanning(false);
    setScannerOpen(false);
  };

  const startScanning = async () => {
    if (typeof window === 'undefined') return;

    try {
      setScanError('');
      setScannerOpen(true);
      lastErrorRef.current = 0;
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        setScanError('Câmera não disponível neste dispositivo/navegador.');
        setScannerOpen(false);
        return;
      }

      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setScanning(true);

      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200 });
      zxingReaderRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current as HTMLVideoElement,
        async (result, err) => {
          if (result) {
            const text = result.getText();
            setVoucherCode(text);
            stopScanning();
            await fetchEvaluation(text);
          } else if (err) {
            const name = err.name || '';
            if (name.includes('NotFoundException') || name.includes('ChecksumException')) {
              // silêncio em leituras sem resultado
              return;
            }
            const now = Date.now();
            if (now - lastErrorRef.current > 1000) {
              console.error('ZXing scan error', err);
              setScanError('Erro ao ler QR code. Tente novamente.');
              lastErrorRef.current = now;
            }
          }
        }
      );
      decodeControlsRef.current = controls;
    } catch (err: any) {
      console.error(err);
      const msg = err?.message
        ? `Erro ao acessar a câmera: ${err.message}`
        : 'Erro ao acessar a câmera. Verifique permissões.';
      setScanError(msg);
      stopScanning();
    }
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between text-sm text-muted-foreground">
      <span className="text-muted-foreground/90">{label}</span>
      <span className="font-medium text-foreground" style={{ overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </div>
  );

  const parseNumber = (value: any) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  };

  const buildCardItem = (data: LookupResult): WalletCardItem => {
    const { evaluation, company, evaluator } = data;
    const voucherDone = !!evaluation.voucherValidated;
    const surveyDone =
      evaluation.stage === 'survey_submitted' ||
      !!evaluation.surveyResponseId ||
      !!evaluation.surveyData?.answers?.length;
    const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
    const aiDone = !!evaluation.aiAnalysis;

    return {
      id: String(evaluation.id),
      companyName: company?.name || 'Empresa',
      logoUrl: company?.logoUrl,
      dateLabel: new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR'),
      voucherCode: evaluation.voucherCode,
      voucherValue: parseNumber(
        evaluation.voucherValue ?? evaluation.visitData?.voucherValue ?? company?.voucherValue
      ),
      evaluatorName: formatFullName(evaluator?.name, evaluator?.lastName) || '',
      accentSeed: company?.name || company?.id || String(evaluation.id),
      companyDisplay: company?.name || 'Empresa',
      statuses: [
        { key: 'voucher', label: `Voucher: ${voucherDone ? 'validado' : 'pendente'}`, done: voucherDone, Icon: QrCode },
        { key: 'survey', label: `Questionário: ${surveyDone ? 'enviado' : 'pendente'}`, done: surveyDone, Icon: FilePenLine },
        { key: 'audio', label: `Áudio: ${audioDone ? 'enviado' : 'pendente'}`, done: audioDone, Icon: Mic },
        { key: 'ai', label: `IA: ${aiDone ? 'processada' : 'pendente'}`, done: aiDone, Icon: BrainCog },
      ],
    };
  };

  return (
    <>
      <Layout
        user={user}
        currentPage="voucher-validation"
        onNavigate={onNavigate}
        onLogout={() => {
          stopScanning();
          onLogout();
        }}
      >
      <div className={`max-w-5xl mx-auto text-foreground ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="mb-6 sm:mb-8 flex flex-col gap-2 sm:gap-3">
          <div>
            <h2 className="text-foreground mb-2">Validar Voucher</h2>
            <p className="text-muted-foreground">
              Leia o QR code ou digite o voucher para validar e avaliar o avaliador.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1 bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Código do Voucher</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startScanning}
                    className="flex items-center justify-center px-3 py-3 border border-border bg-input text-foreground rounded-lg hover:bg-muted transition-colors"
                    disabled={scanning}
                    aria-label="Ler QR code"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary/50 uppercase"
                    placeholder="Ex: 74461E28"
                    required
                  />
                </div>
              </div>
              {scanError && (
                <p className="text-sm text-red-600 dark:text-red-200">{scanError}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span>Buscando</span>
                    <span className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:-0.05s]" />
                      <span className="h-2 w-2 rounded-full bg-white animate-bounce" />
                    </span>
                  </span>
                ) : (
                  'Buscar Voucher'
                )}
              </button>
              <p className="text-xs text-muted-foreground">
                Certifique-se de que o avaliador tirou uma foto do recibo ou da comanda de consumo.
              </p>
              <p className="text-xs text-muted-foreground">
                Caso a nota do avaliador seja menor ou igual a 3, o campo observações deverá obrigatoriamente ser preenchido antes da validação. Faça-o com discrição.
              </p>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-100 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6 space-y-6">
            {!lookup && (
              <div className="text-center text-muted-foreground">
                <QrCode className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                Informe ou leia o voucher para visualizar a avaliação.
              </div>
            )}

            {lookup && (
              <>
                <WalletCardStack
                  items={[buildCardItem(lookup)]}
                  onOpen={() => {}}
                />

                {lookup.evaluation.voucherValidated ? (
                  <div className="bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-200" />
                    <div>
                      <p className="text-green-800 dark:text-green-100 font-medium">
                        Voucher já validado
                      </p>
                      {lookup.evaluation.managerRating && (
                        <p className="text-green-700 dark:text-green-100 text-sm">
                          Nota: {lookup.evaluation.managerRating}/5
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-foreground mb-2">Avalie o avaliador</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setManagerRating(rating)}
                            className={`p-2 rounded-lg transition-colors ${
                              managerRating >= rating
                                ? 'text-yellow-500 dark:text-amber-300'
                                : 'text-muted-foreground'
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

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Obrigatório se a nota for menor ou igual a 3.
                      </p>
                      <textarea
                        value={managerNotes}
                        onChange={(e) => setManagerNotes(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
                        required={managerRating <= 3}
                        rows={3}
                        placeholder="Comportamento, postura, pontualidade..."
                      />
                    </div>

                    <button
                      onClick={handleValidate}
                      disabled={validationLoading}
                      className="w-full bg-green-600 text-white dark:bg-green-500 dark:hover:bg-green-400 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {validationLoading ? 'Validando...' : 'Validar Voucher'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </Layout>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg p-4 sm:p-6 relative">
            <button
              onClick={stopScanning}
              className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              aria-label="Fechar leitor de QR code"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Ler QR code</h3>
              <p className="text-sm text-muted-foreground">Aponte a câmera para o QR code do voucher.</p>
              <div className="relative aspect-video rounded-lg border border-border overflow-hidden bg-black/80">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/40">
                    Iniciando câmera...
                  </div>
                )}
              </div>
              {scanError && <p className="text-sm text-red-600 dark:text-red-200">{scanError}</p>}
              <div className="flex justify-end">
                <button
                  onClick={stopScanning}
                  className="flex items-center gap-2 px-4 py-2 border border-border bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <StopCircle className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
