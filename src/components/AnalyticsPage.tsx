import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { useTheme } from '../utils/theme';

interface AnalyticsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function AnalyticsPage({ user, accessToken, onNavigate, onLogout }: AnalyticsPageProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadAnalytics(selectedCompany);
    }
  }, [selectedCompany]);

  const loadCompanies = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/companies`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      if (data.companies && data.companies.length > 0) {
        setCompanies(data.companies);
        setSelectedCompany(data.companies[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadAnalytics = async (companyId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/analytics/company/${companyId}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (companies.length === 0) {
    return (
      <Layout user={user} currentPage="analytics" onNavigate={onNavigate} onLogout={onLogout}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 bg-card text-card-foreground rounded-lg border border-border shadow-sm">
            <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Nenhuma empresa cadastrada</h3>
            <p className="text-muted-foreground mb-6">
              Cadastre empresas e realize avaliações para ver os relatórios
            </p>
            <button
              onClick={() => onNavigate('companies')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cadastrar Empresa
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const selectedCompanyData = companies.find(c => c.id === selectedCompany);

  // Prepare chart data
  const periodData = analytics?.byPeriod
    ? Object.entries(analytics.byPeriod).map(([period, count]) => ({
        period: period === 'manhã' ? 'Manhã' : period === 'tarde' ? 'Tarde' : 'Noite',
        avaliações: count,
      }))
    : [];

  const statusData = [
    { name: 'Concluídas', value: analytics?.completedCount || 0 },
    { name: 'Pendentes', value: (analytics?.totalEvaluations || 0) - (analytics?.completedCount || 0) },
  ];

  const COLORS = ['var(--color-chart-2)', 'var(--color-chart-4)'];
  const renderStatusLabel = ({ x, y, cx, name, percent }: any) => {
    const textAnchor = x > cx ? 'start' : 'end';
    return (
      <text
        x={x}
        y={y}
        fill="var(--color-foreground)"
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fontSize: 12 }}
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Calculate trends
  const completionRate = analytics?.totalEvaluations > 0
    ? ((analytics.completedCount / analytics.totalEvaluations) * 100).toFixed(1)
    : 0;

  return (
    <Layout user={user} currentPage="analytics" onNavigate={onNavigate} onLogout={onLogout}>
      <div className={`max-w-7xl mx-auto text-foreground ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="mb-6 sm:mb-8">
          <h2 className="text-foreground mb-2">Relatórios e Análises</h2>
          <p className="text-muted-foreground">Visualize os resultados das avaliações</p>
        </div>

        {/* Company Selector */}
        <div className="mb-6 bg-card text-card-foreground rounded-lg border border-border p-4 shadow-sm">
          <label className="block text-muted-foreground mb-2">Selecione a Empresa</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-input-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : analytics && analytics.totalEvaluations > 0 ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground">Total de Avaliações</p>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-foreground">{analytics.totalEvaluations}</p>
              </div>

              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground">Concluídas</p>
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-foreground">{analytics.completedCount}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {completionRate}% de taxa de conclusão
                </p>
              </div>

              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground">Avaliação Média</p>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-foreground">
                  {analytics.averageManagerRating?.toFixed(1) || '0.0'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">de 5.0</p>
              </div>

              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-muted-foreground">Pendentes</p>
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-foreground">
                  {analytics.totalEvaluations - analytics.completedCount}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Period Distribution */}
              {periodData.length > 0 && (
                <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                  <h3 className="text-foreground mb-4">Distribuição por Período</h3>
                  <ChartContainer config={{}} className="h-[300px] w-full aspect-auto">
                    <BarChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avaliações" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {/* Status Distribution */}
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <h3 className="text-foreground mb-4">Status das Avaliações</h3>
                <ChartContainer config={{}} className="h-[300px] w-full aspect-auto">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderStatusLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>

            {/* Recent Evaluations */}
            {analytics.evaluations && analytics.evaluations.length > 0 && (
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <h3 className="text-foreground mb-4">Avaliações Recentes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-muted-foreground">Data</th>
                        <th className="text-left py-3 px-4 text-muted-foreground">Período</th>
                        <th className="text-left py-3 px-4 text-muted-foreground">Voucher</th>
                        <th className="text-left py-3 px-4 text-muted-foreground">Avaliação</th>
                        <th className="text-left py-3 px-4 text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.evaluations.slice(0, 10).map((evaluation: any) => (
                        <tr key={evaluation.id} className="border-b border-border hover:bg-muted transition-colors">
                          <td className="py-3 px-4 text-foreground">
                            {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-foreground capitalize">
                            {evaluation.period}
                          </td>
                          <td className="py-3 px-4 text-foreground font-mono">
                            {evaluation.voucherCode}
                          </td>
                          <td className="py-3 px-4 text-foreground">
                            {evaluation.managerRating ? (
                              <span>{evaluation.managerRating}/5 ⭐</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {evaluation.status === 'completed' ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-100 rounded-full text-sm">
                                Concluída
                              </span>
                            ) : evaluation.status === 'in_progress' ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-100 rounded-full text-sm">
                                Em Andamento
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-100 rounded-full text-sm">
                                Agendada
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI Analysis Summary */}
            {analytics.evaluations.some((e: any) => e.aiAnalysis) && (
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4 sm:p-6">
                <h3 className="text-foreground mb-4">Insights por IA</h3>
                <div className="space-y-4">
                  {analytics.evaluations
                    .filter((e: any) => e.aiAnalysis)
                    .slice(0, 3)
                    .map((evaluation: any) => (
                      <div key={evaluation.id} className="bg-muted rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-foreground">
                          {evaluation.aiAnalysis.summary}
                        </p>
                        {evaluation.aiAnalysis.overallScore && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Pontuação: {evaluation.aiAnalysis.overallScore.toFixed(1)}/10
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 sm:py-12 bg-card text-card-foreground rounded-lg border border-border shadow-sm">
            <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-foreground mb-2">Sem dados disponíveis</h3>
            <p className="text-muted-foreground mb-6">
              Esta empresa ainda não possui avaliações realizadas
            </p>
            <button
              onClick={() => onNavigate('schedule')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
            >
              Agendar Avaliação
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
