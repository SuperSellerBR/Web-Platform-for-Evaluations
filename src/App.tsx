import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { CompaniesPage } from './components/CompaniesPage';
import { PartnersPage } from './components/PartnersPage';
import { EvaluatorsPage } from './components/EvaluatorsPage';
import { EvaluationsPage } from './components/EvaluationsPage';
import { SchedulePage } from './components/SchedulePage';
import { MyEvaluationsPage } from './components/MyEvaluationsPage';
import { EvaluationDetailPage } from './components/EvaluationDetailPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { VoucherValidationPage } from './components/VoucherValidationPage';
import { QuestEditorPage } from './components/QuestEditorPage';
import { ProfilePage } from './components/ProfilePage';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage === 'profile' && (
        <ProfilePage
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      {currentPage === 'dashboard' && (
        <Dashboard 
          user={user} 
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'companies' && (
        <CompaniesPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'partners' && (
        <PartnersPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'evaluators' && (
        <EvaluatorsPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'evaluations' && (
        <EvaluationsPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'schedule' && (
        <SchedulePage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
      
      {currentPage === 'my-evaluations' && (
        <MyEvaluationsPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
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
        <VoucherValidationPage
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'quest-editor' && (
        <QuestEditorPage
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'analytics' && (
        <AnalyticsPage 
          user={user}
          accessToken={accessToken}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
