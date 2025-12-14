import { useEffect, useState } from 'react';
import { Layout } from './Layout';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { projectId } from '../utils/supabase/info';

interface SchedulePageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function SchedulePage({ user, accessToken, onNavigate, onLogout }: SchedulePageProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [evaluators, setEvaluators] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [matchedEvaluators, setMatchedEvaluators] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [allowRepeats, setAllowRepeats] = useState(true); // For testing

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    companyId: '',
    evaluatorId: '',
    date: '',
    period: 'manhã',
    notes: '',
    surveyId: '',
  });

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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/match-evaluators/${companyId}?allowRepeats=${allowRepeats}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );
      const data = await response.json();
      setMatchedEvaluators(data.evaluators || []);
    } catch (error) {
      console.error('Error loading matched evaluators:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/evaluations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            scheduledDate: formData.date,
          }),
        }
      );

      if (response.ok) {
        alert('Avaliação agendada com sucesso!');
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
    setFormData({
      ...formData,
      date: date.toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setFormData({
      companyId: '',
      evaluatorId: '',
      date: '',
      period: 'manhã',
      notes: '',
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
    return evaluations.filter(evaluation => {
      const evalDate = new Date(evaluation.scheduledDate);
      return evalDate.toDateString() === date.toDateString();
    });
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

  return (
    <Layout user={user} currentPage="schedule" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-gray-900 mb-2">Agendar Avaliação</h2>
          <p className="text-gray-600">Selecione uma data no calendário para criar uma nova avaliação</p>
        </div>

        {/* Settings */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowRepeats}
              onChange={(e) => setAllowRepeats(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">
              Permitir avaliadores que já avaliaram a empresa (modo de teste)
            </span>
          </label>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h3 className="text-gray-900 capitalize">{monthName}</h3>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Week days */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-gray-600 text-xs sm:text-sm py-2">
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
              const isToday = day.toDateString() === new Date().toDateString();
              const isPast = day < new Date() && !isToday;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => !isPast && openModal(day)}
                  disabled={isPast}
                  className={`
                    aspect-square p-2 rounded-lg border transition-colors
                    ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    ${isPast ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-blue-50'}
                    ${dayEvaluations.length > 0 ? 'bg-green-50' : ''}
                  `}
                >
                  <div className="text-xs sm:text-sm">{day.getDate()}</div>
                  {dayEvaluations.length > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      {dayEvaluations.length} aval.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-50 border border-blue-500 rounded"></div>
            <span>Hoje</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-gray-200 rounded"></div>
            <span>Com avaliações</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
              <h3 className="text-gray-900">
                Agendar Avaliação - {selectedDate.toLocaleDateString('pt-BR')}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Empresa</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value, evaluatorId: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

              {formData.companyId && (
                <div>
                  <label className="block text-gray-700 mb-2">
                    Avaliador (ordenado por pontuação e aderência)
                  </label>
                  <select
                    value={formData.evaluatorId}
                    onChange={(e) => setFormData({ ...formData, evaluatorId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione um avaliador</option>
                    {matchedEvaluators.map(evaluator => (
                      <option key={evaluator.id} value={evaluator.id}>
                        {evaluator.name} (Pontuação: {evaluator.matchScore})
                      </option>
                    ))}
                  </select>
                  {matchedEvaluators.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      Nenhum avaliador disponível para esta empresa
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2">Questionário</label>
                <select
                  value={formData.surveyId}
                  onChange={(e) => setFormData({ ...formData, surveyId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione</option>
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.title}
                    </option>
                  ))}
                </select>
                {surveys.length === 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    Nenhum questionário criado. Crie um em Questionários.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Período</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="manhã">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Instruções especiais para o avaliador..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Agendando...' : 'Agendar Avaliação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
