import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

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
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Nenhuma empresa cadastrada</h3>
            <p className="text-gray-600 mb-6">
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

  const COLORS = ['#10b981', '#f59e0b'];

  // Calculate trends
  const completionRate = analytics?.totalEvaluations > 0
    ? ((analytics.completedCount / analytics.totalEvaluations) * 100).toFixed(1)
    : 0;

  return (
    <Layout user={user} currentPage="analytics" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-gray-900 mb-2">Relatórios e Análises</h2>
          <p className="text-gray-600">Visualize os resultados das avaliações</p>
        </div>

        {/* Company Selector */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <label className="block text-gray-700 mb-2">Selecione a Empresa</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : analytics && analytics.totalEvaluations > 0 ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600">Total de Avaliações</p>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">{analytics.totalEvaluations}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600">Concluídas</p>
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">{analytics.completedCount}</p>
                <p className="text-sm text-green-600 mt-1">
                  {completionRate}% de taxa de conclusão
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600">Avaliação Média</p>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">
                  {analytics.averageManagerRating?.toFixed(1) || '0.0'}
                </p>
                <p className="text-sm text-gray-600 mt-1">de 5.0</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600">Pendentes</p>
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-2xl sm:text-3xl text-gray-900">
                  {analytics.totalEvaluations - analytics.completedCount}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Period Distribution */}
              {periodData.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h3 className="text-gray-900 mb-4">Distribuição por Período</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avaliações" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Status Distribution */}
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-gray-900 mb-4">Status das Avaliações</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Evaluations */}
            {analytics.evaluations && analytics.evaluations.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-gray-900 mb-4">Avaliações Recentes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-700">Data</th>
                        <th className="text-left py-3 px-4 text-gray-700">Período</th>
                        <th className="text-left py-3 px-4 text-gray-700">Voucher</th>
                        <th className="text-left py-3 px-4 text-gray-700">Avaliação</th>
                        <th className="text-left py-3 px-4 text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.evaluations.slice(0, 10).map((evaluation: any) => (
                        <tr key={evaluation.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-700">
                            {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 text-gray-700 capitalize">
                            {evaluation.period}
                          </td>
                          <td className="py-3 px-4 text-gray-700 font-mono">
                            {evaluation.voucherCode}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {evaluation.managerRating ? (
                              <span>{evaluation.managerRating}/5 ⭐</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {evaluation.status === 'completed' ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                Concluída
                              </span>
                            ) : evaluation.status === 'in_progress' ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                                Em Andamento
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
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
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-gray-900 mb-4">Insights por IA</h3>
                <div className="space-y-4">
                  {analytics.evaluations
                    .filter((e: any) => e.aiAnalysis)
                    .slice(0, 3)
                    .map((evaluation: any) => (
                      <div key={evaluation.id} className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-gray-700">
                          {evaluation.aiAnalysis.summary}
                        </p>
                        {evaluation.aiAnalysis.overallScore && (
                          <p className="text-sm text-gray-600 mt-2">
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
          <div className="text-center py-10 sm:py-12 bg-white rounded-lg shadow-md">
            <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Sem dados disponíveis</h3>
            <p className="text-gray-600 mb-6">
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
