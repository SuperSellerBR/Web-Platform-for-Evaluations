import { ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  UserCheck, 
  Calendar,
  ClipboardList,
  FilePenLine,
  ScanQrCode,
  BarChart3,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import logoUrl from '../../assets/logo.png';

interface LayoutProps {
  user: { name: string; role?: string; evaluatorId?: string };
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: any) => void;
  onLogout: () => void;
}

export function Layout({ user, children, currentPage, onNavigate, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = (user.role || '').toString().trim().toLowerCase();
  const isPartner = ['parceiro', 'partner', 'gerente', 'manager', 'vendedor', 'seller'].includes(role);
  const isSeller = role === 'vendedor' || role === 'seller';
  const isEvaluator = role === 'evaluator' && !!user.evaluatorId;
  const isAdmin = role === 'admin';
  const isManager = role === 'gerente' || role === 'manager';
  const canValidateVoucher = isManager || isAdmin;
  const roleLabel =
    isEvaluator
      ? 'Avaliador'
      : role === 'admin'
        ? 'Administrador'
        : role === 'gerente' || role === 'manager'
          ? 'Gerente'
          : role === 'vendedor' || role === 'seller'
            ? 'Vendedor'
            : role === 'empresa' || role === 'company'
              ? 'Empresa'
              : 'Parceiro';

  const menuItems = isEvaluator
    ? [
        { id: 'my-evaluations', label: 'Minhas Avaliações', icon: ClipboardList },
        { id: 'profile', label: 'Perfil', icon: Users },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(isPartner ? [] : [{ id: 'companies', label: 'Empresas', icon: Building2 }]),
        ...(isSeller ? [] : [{ id: 'partners', label: 'Equipe', icon: Users }]),
        ...(isPartner ? [] : [{ id: 'evaluators', label: 'Avaliadores', icon: UserCheck }]),
        ...(isPartner ? [] : [{ id: 'schedule', label: 'Agendar Avaliação', icon: Calendar }]),
        { id: 'evaluations', label: 'Avaliações', icon: ClipboardList },
        ...(isAdmin ? [{ id: 'quest-editor', label: 'Criar Questionários', icon: FilePenLine }] : []),
        ...(canValidateVoucher
          ? [
              {
                id: 'voucher-validation',
                label: 'Validar Voucher',
                icon: ScanQrCode,
              },
            ]
          : []),
        { id: 'analytics', label: 'Relatórios', icon: BarChart3 },
      ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ overflowX: 'hidden' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg"
              aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <img
              src={logoUrl}
              alt="Cliente Oculto"
              className="h-6 sm:h-7 w-auto max-w-[8.5rem] object-contain"
            />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right leading-tight min-w-0">
              <p className="text-gray-900 text-sm sm:text-base font-medium max-w-[10rem] truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-600 hidden sm:block">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`
            fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-gray-200 w-64 z-30
            transition-transform duration-300 lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-full overflow-y-auto p-4 pt-20 lg:pt-4 pb-6">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
