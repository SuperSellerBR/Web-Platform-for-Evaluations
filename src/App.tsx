import { Suspense, lazy, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';

const LoginPage = lazy(() => import('./components/LoginPage').then((m) => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const CompaniesPage = lazy(() => import('./components/CompaniesPage').then((m) => ({ default: m.CompaniesPage })));
const PartnersPage = lazy(() => import('./components/PartnersPage').then((m) => ({ default: m.PartnersPage })));
const EvaluatorsPage = lazy(() => import('./components/EvaluatorsPage').then((m) => ({ default: m.EvaluatorsPage })));
const EvaluationsPage = lazy(() => import('./components/EvaluationsPage').then((m) => ({ default: m.EvaluationsPage })));
const SchedulePage = lazy(() => import('./components/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const MyEvaluationsPage = lazy(() => import('./components/MyEvaluationsPage').then((m) => ({ default: m.MyEvaluationsPage })));
const EvaluationDetailPage = lazy(() =>
  import('./components/EvaluationDetailPage').then((m) => ({ default: m.EvaluationDetailPage }))
);
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const VoucherValidationPage = lazy(() =>
  import('./components/VoucherValidationPage').then((m) => ({ default: m.VoucherValidationPage }))
);
const QuestEditorPage = lazy(() => import('./components/QuestEditorPage').then((m) => ({ default: m.QuestEditorPage })));
const ProfilePage = lazy(() => import('./components/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

type Page = 
  | 'login' 
  | 'dashboard' 
  | 'companies' 
  | 'partners' 
  | 'evaluators' 
  | 'evaluations'
  | 'schedule'
  | 'my-evaluations'
  | 'profile'
  | 'evaluation-detail'
  | 'voucher-validation'
  | 'settings'
  | 'quest-editor'
  | 'analytics';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  partnerId?: string;
  evaluatorId?: string;
  companyId?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session && !error) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/auth/me`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setAccessToken(session.access_token);
          const role = (data.user?.role || '').toString().trim().toLowerCase();
          const isEvaluator = role === 'evaluator' && !!data.user?.evaluatorId;
          setCurrentPage(isEvaluator ? 'my-evaluations' : 'dashboard');
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const publicHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      };

      // First, try to sign in
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/auth/signin`,
        {
          method: 'POST',
          headers: publicHeaders,
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setAccessToken(data.accessToken);
        const role = (data.user?.role || '').toString().trim().toLowerCase();
        const isEvaluator = role === 'evaluator' && !!data.user?.evaluatorId;
        setCurrentPage(isEvaluator ? 'my-evaluations' : 'dashboard');
        return { success: true };
      } else {
        // If login fails AND credentials are admin@sistema.com/admin123, try to create first admin user
        if (email === 'admin@sistema.com' && password === 'admin123') {
          console.log('Attempting to create initial admin user...');
          
          const signupResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/auth/signup`,
            {
              method: 'POST',
              headers: publicHeaders,
              body: JSON.stringify({ 
                email, 
                password,
                name: 'Administrador',
                role: 'admin',
                cpf: '',
              }),
            }
          );

          const signupData = await signupResponse.json();
          
          if (signupResponse.ok && signupData.success) {
            // Now try to login again
            return handleLogin(email, password);
          }
        }
        
        return { success: false, error: data.error || 'Email ou senha incorretos' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erro ao fazer login. Verifique sua conexão.' };
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    setCurrentPage('login');
  };

  const navigateTo = (page: Page, id?: string) => {
    setCurrentPage(page);
    setSelectedId(id || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        }
      >
        <LoginPage onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <div className="min-h-screen bg-background text-foreground">
        {currentPage === 'profile' && (
          <ProfilePage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}
        {currentPage === 'dashboard' && (
          <Dashboard user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'companies' && (
          <CompaniesPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'partners' && (
          <PartnersPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'evaluators' && (
          <EvaluatorsPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'evaluations' && (
          <EvaluationsPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'schedule' && (
          <SchedulePage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'my-evaluations' && (
          <MyEvaluationsPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'evaluation-detail' && selectedId && (
          <EvaluationDetailPage
            evaluationId={selectedId}
            user={user}
            accessToken={accessToken}
            onNavigate={navigateTo}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'voucher-validation' && (
          <VoucherValidationPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'settings' && (
          <SettingsPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'quest-editor' && (
          <QuestEditorPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}

        {currentPage === 'analytics' && (
          <AnalyticsPage user={user} accessToken={accessToken} onNavigate={navigateTo} onLogout={handleLogout} />
        )}
      </div>
    </Suspense>
  );
}
