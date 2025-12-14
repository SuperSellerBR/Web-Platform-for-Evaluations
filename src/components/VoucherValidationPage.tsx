import { useEffect, useRef, useState } from 'react';
import { Layout } from './Layout';
import { CheckCircle, QrCode, Star, StopCircle, Camera } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

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
  const [voucherCode, setVoucherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [managerRating, setManagerRating] = useState(5);
  const [scanError, setScanError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setScanning(false);
  };

  const startScanning = async () => {
    if (typeof window === 'undefined') return;
    if (!(window as any).BarcodeDetector) {
      setScanError('Leitor indisponível neste navegador. Use a entrada manual.');
      return;
    }

    try {
      setScanError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      const detector = new (window as any).BarcodeDetector({
        formats: ['qr_code'],
      });

      const scan = async () => {
        if (!videoRef.current) return;
        try {
          const bitmap = await createImageBitmap(videoRef.current);
          const codes = await detector.detect(bitmap);
          bitmap.close();
          if (codes.length > 0) {
            const code = codes[0].rawValue;
            setVoucherCode(code);
            stopScanning();
            await fetchEvaluation(code);
            return;
          }
        } catch (err) {
          // ignore frame errors
        }
        animationRef.current = requestAnimationFrame(scan);
      };

      animationRef.current = requestAnimationFrame(scan);
    } catch (err) {
      console.error(err);
      setScanError('Erro ao acessar a câmera. Verifique permissões.');
      stopScanning();
    }
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between text-sm text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium" style={{ overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </div>
  );

  return (
    <Layout
      user={user}
      currentPage="voucher-validation"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-gray-900 mb-2">Validar Voucher</h2>
            <p className="text-gray-600">
              Leia o QR code ou digite o voucher para validar e avaliar o avaliador.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={startScanning}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
              disabled={scanning}
            >
              <Camera className="w-4 h-4" />
              {scanning ? 'Lendo...' : 'Ler QR code'}
            </button>
            {scanning && (
              <button
                onClick={stopScanning}
                className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
              >
                <StopCircle className="w-4 h-4" />
                Parar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Código do Voucher</label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  placeholder="Ex: 74461E28"
                  required
                />
              </div>
              {scanError && (
                <p className="text-sm text-red-600">{scanError}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar Voucher'}
              </button>
              {scanning && (
                <div className="mt-4">
                  <video ref={videoRef} className="w-full rounded-lg border border-gray-200" />
                  <p className="text-xs text-gray-500 mt-2">
                    Aponte a câmera para o QR code do voucher.
                  </p>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-6">
            {!lookup && (
              <div className="text-center text-gray-500">
                <QrCode className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                Informe ou leia o voucher para visualizar a avaliação.
              </div>
            )}

            {lookup && (
              <>
                <div className="space-y-3">
                  <h3 className="text-gray-900">Dados da Avaliação</h3>
                  <div className="space-y-2">
                    <DetailRow
                      label="Empresa"
                      value={lookup.company?.name || 'N/A'}
                    />
                    <DetailRow
                      label="Endereço"
                      value={lookup.company?.address || 'N/A'}
                    />
                    <DetailRow
                      label="Data"
                      value={new Date(lookup.evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                    />
                    <DetailRow
                      label="Período"
                      value={lookup.evaluation.period}
                    />
                    <DetailRow
                      label="Avaliador"
                      value={lookup.evaluator?.name || 'N/A'}
                    />
                    <DetailRow
                      label="Voucher"
                      value={lookup.evaluation.voucherCode}
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <QrCode className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-2">
                      QR code do voucher para conferência/validação.
                    </p>
                    <div className="inline-flex items-center justify-center bg-white p-3 rounded-lg border border-gray-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(lookup.evaluation.voucherCode)}`}
                        alt="QR code do voucher"
                        style={{ width: 160, height: 160 }}
                      />
                    </div>
                  </div>
                </div>

                {lookup.evaluation.voucherValidated ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="text-green-800 font-medium">
                        Voucher já validado
                      </p>
                      {lookup.evaluation.managerRating && (
                        <p className="text-green-700 text-sm">
                          Nota: {lookup.evaluation.managerRating}/5
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-700 mb-2">Avalie o avaliador</p>
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

                    <div>
                      <label className="block text-gray-700 mb-2">Observações</label>
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
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
