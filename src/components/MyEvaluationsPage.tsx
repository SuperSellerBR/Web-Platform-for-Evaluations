import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { BrainCog, ClipboardList, FilePenLine, FileText, Mic, QrCode } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { WalletCardItem, WalletCardStack } from './WalletCardStack';

interface MyEvaluationsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string, id?: string) => void;
  onLogout: () => void;
}

function StatusIconButton(props: {
  done: boolean;
  aria: string;
  tooltip: string;
  Icon: any;
  open: boolean;
  onToggle: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { done, aria, tooltip, Icon, open, onToggle, onOpenChange } = props;

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center h-9 w-9 rounded-full border ${
            done ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
          aria-label={aria}
          data-no-nav
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
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

export function MyEvaluationsPage({ user, accessToken, onNavigate, onLogout }: MyEvaluationsPageProps) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTooltipOpen, setStatusTooltipOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!statusTooltipOpen) return;
    const t = window.setTimeout(() => setStatusTooltipOpen(null), 2000);
    return () => window.clearTimeout(t);
  }, [statusTooltipOpen]);

  useEffect(() => {
    if (user.evaluatorId) {
      loadEvaluations();
    }
  }, [user.evaluatorId]);

  const loadEvaluations = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` };

      const [evaluationsRes, companiesRes] = await Promise.all([
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations?evaluatorId=${user.evaluatorId}`,
          { headers }
        ),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`, { headers }),
      ]);

      const evaluationsData = await evaluationsRes.json();
      const companiesData = await companiesRes.json();

      setEvaluations(evaluationsData.evaluations || []);
      setCompanies(companiesData.companies || []);
    } catch (error) {
      console.error('Error loading evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompany = (companyId: string) => {
    return companies.find(c => c.id === companyId);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: { label: 'Pendente', color: 'bg-blue-100 text-blue-800' },
      in_progress: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
    };
    const badge = badges[status as keyof typeof badges] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return badge;
  };

  const parseNumber = (value: any) => {
    if (value === undefined || value === null) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  };

  const isInteractiveTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el || typeof (el as any).closest !== 'function') return false;
    return !!el.closest('button, a, input, select, textarea, [data-no-nav]');
  };

  const pendingEvaluations = evaluations
    .filter(e => e.status === 'scheduled' || e.status === 'in_progress')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const completedEvaluations = evaluations
    .filter(e => e.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.scheduledDate).getTime() - new Date(a.completedAt || a.updatedAt || a.scheduledDate).getTime());

  const walletItems: WalletCardItem[] = pendingEvaluations.map((evaluation) => {
    const company = getCompany(evaluation.companyId);
    const maskedId = user?.id ? `***** ${String(user.id).slice(-5)}` : undefined;
    const voucherDone = !!evaluation.voucherValidated;
    const surveyDone =
      evaluation.stage === 'survey_submitted' ||
      !!evaluation.surveyResponseId ||
      !!evaluation.surveyData?.answers?.length;
    const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
    const aiDone = !!evaluation.aiAnalysis;

    return {
      id: String(evaluation.id),
      companyName: company?.name || 'N/A',
      logoUrl: company?.logoUrl,
      dateLabel: new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR'),
      voucherCode: evaluation.voucherCode,
      voucherValue: parseNumber(company?.voucherValue ?? evaluation.voucherValue ?? evaluation.visitData?.voucherValue),
      evaluatorName: user.name,
      maskedId,
      accentSeed: company?.name || company?.id || String(evaluation.id),
      companyDisplay: company?.name || 'Empresa',
      statuses: [
        { key: 'voucher', label: `Voucher: ${voucherDone ? 'validado' : 'pendente'}`, done: voucherDone, Icon: QrCode },
        { key: 'survey', label: `Questionário: ${surveyDone ? 'enviado' : 'pendente'}`, done: surveyDone, Icon: FilePenLine },
        { key: 'audio', label: `Áudio: ${audioDone ? 'enviado' : 'pendente'}`, done: audioDone, Icon: Mic },
        { key: 'ai', label: `IA: ${aiDone ? 'processada' : 'pendente'}`, done: aiDone, Icon: BrainCog },
      ],
    };
  });

  return (
    <Layout user={user} currentPage="my-evaluations" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-gray-900 mb-2">Minhas Avaliações</h2>
          <p className="text-gray-600">Veja suas avaliações pendentes e concluídas</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhuma avaliação atribuída</h3>
            <p className="text-gray-600">Aguarde novas atribuições de avaliação</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Evaluations */}
            {pendingEvaluations.length > 0 && (
              <div>
                <h3 className="text-gray-900 mb-4">Pendentes ({pendingEvaluations.length})</h3>
                <WalletCardStack
                  items={walletItems}
                  onOpen={(id) => onNavigate('evaluation-detail', id)}
                />
              </div>
            )}

            {/* Completed Evaluations */}
            {completedEvaluations.length > 0 && (
              <div>
                <h3 className="text-gray-900 mb-4">Concluídas ({completedEvaluations.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedEvaluations.map((evaluation) => {
                    const company = getCompany(evaluation.companyId);
                    const voucherDone = !!evaluation.voucherValidated;
                    const surveyDone =
                      evaluation.stage === 'survey_submitted' ||
                      !!evaluation.surveyResponseId ||
                      !!evaluation.surveyData?.answers?.length;
                    const audioDone = !!(evaluation.audioPath || evaluation.audioUrl);
                    const aiDone = !!evaluation.aiAnalysis;
                    const baseTooltipId = String(evaluation.id);
                    const voucherLabel = `Voucher: ${voucherDone ? 'validado' : 'pendente'}`;
                    const surveyLabel = `Questionário: ${surveyDone ? 'enviado' : 'pendente'}`;
                    const audioLabel = `Áudio: ${audioDone ? 'enviado' : 'pendente'}`;
                    const aiLabel = `IA: ${aiDone ? 'processada' : 'pendente'}`;
                    
                    return (
                      <div
                        key={evaluation.id}
                        role="button"
                        tabIndex={0}
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
                        className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="bg-green-100 rounded-lg p-2 shrink-0">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-gray-900">{company?.name || 'N/A'}</h4>
                              <p className="text-sm text-gray-600">
                                {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusIconButton
                              done={voucherDone}
                              aria={voucherLabel}
                              tooltip={voucherLabel}
                              Icon={QrCode}
                              open={statusTooltipOpen === `${baseTooltipId}:voucher`}
                              onToggle={() =>
                                setStatusTooltipOpen((prev) =>
                                  prev === `${baseTooltipId}:voucher` ? null : `${baseTooltipId}:voucher`,
                                )
                              }
                              onOpenChange={(open) =>
                                setStatusTooltipOpen(open ? `${baseTooltipId}:voucher` : null)
                              }
                            />
                            <StatusIconButton
                              done={surveyDone}
                              aria={surveyLabel}
                              tooltip={surveyLabel}
                              Icon={FilePenLine}
                              open={statusTooltipOpen === `${baseTooltipId}:survey`}
                              onToggle={() =>
                                setStatusTooltipOpen((prev) =>
                                  prev === `${baseTooltipId}:survey` ? null : `${baseTooltipId}:survey`,
                                )
                              }
                              onOpenChange={(open) =>
                                setStatusTooltipOpen(open ? `${baseTooltipId}:survey` : null)
                              }
                            />
                            <StatusIconButton
                              done={audioDone}
                              aria={audioLabel}
                              tooltip={audioLabel}
                              Icon={Mic}
                              open={statusTooltipOpen === `${baseTooltipId}:audio`}
                              onToggle={() =>
                                setStatusTooltipOpen((prev) =>
                                  prev === `${baseTooltipId}:audio` ? null : `${baseTooltipId}:audio`,
                                )
                              }
                              onOpenChange={(open) =>
                                setStatusTooltipOpen(open ? `${baseTooltipId}:audio` : null)
                              }
                            />
                            <StatusIconButton
                              done={aiDone}
                              aria={aiLabel}
                              tooltip={aiLabel}
                              Icon={BrainCog}
                              open={statusTooltipOpen === `${baseTooltipId}:ai`}
                              onToggle={() =>
                                setStatusTooltipOpen((prev) =>
                                  prev === `${baseTooltipId}:ai` ? null : `${baseTooltipId}:ai`,
                                )
                              }
                              onOpenChange={(open) => setStatusTooltipOpen(open ? `${baseTooltipId}:ai` : null)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
