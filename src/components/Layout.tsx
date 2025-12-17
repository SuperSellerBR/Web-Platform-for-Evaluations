import { ReactNode, useEffect, useState } from 'react';
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
  SlidersHorizontal,
  FolderOpen,
  ChevronDown,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import logoUrl from '../../assets/logo.png';
import logoDarkUrl from '../../assets/logow.png';
import { useTheme } from '../utils/theme';
import { getFirstName } from '../utils/name';

interface LayoutProps {
  user: { id?: string; email?: string; name: string; lastName?: string; role?: string; evaluatorId?: string; avatarUrl?: string };
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: any) => void;
  onLogout: () => void;
}

type NavItem = { type: 'item'; id: string; label: string; icon: any };
type NavGroup = { type: 'group'; id: string; label: string; icon: any; children: NavItem[] };
type MenuEntry = NavItem | NavGroup;

export function Layout({ user, children, currentPage, onNavigate, onLogout }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === 'dark' ? logoDarkUrl : logoUrl;
  const avatarCacheKey =
    (user?.id && `app:avatar:${user.id}`) ||
    (user?.email && `app:avatar:${user.email}`) ||
    'app:avatar';
  const readCachedAvatar = () =>
    typeof window !== 'undefined' ? localStorage.getItem(avatarCacheKey) || '' : '';
  const [cachedAvatar, setCachedAvatar] = useState<string>(() => readCachedAvatar());
  const avatarUrl = user.avatarUrl || cachedAvatar;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === avatarCacheKey) {
        setCachedAvatar(e.newValue || '');
      }
    };
    const onAvatarChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.url !== undefined) {
        setCachedAvatar(detail.url || '');
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('avatarchange', onAvatarChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('avatarchange', onAvatarChange);
    };
  }, [avatarCacheKey]);

  const role = (user.role || '').toString().trim().toLowerCase();
  const isPartner = ['parceiro', 'partner', 'gerente', 'manager', 'vendedor', 'seller'].includes(role);
  const isSeller = role === 'vendedor' || role === 'seller';
  const isEvaluator = role === 'evaluator' && !!user.evaluatorId;
  const isAdmin = role === 'admin';
  const isManager = role === 'gerente' || role === 'manager';
  const canValidateVoucher = isManager || isAdmin;
  const headerName = getFirstName(user.name) || user.name || '?';
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

  const cadastroItems: NavItem[] = [
    ...(isPartner ? [] : [{ id: 'companies', label: 'Empresas', icon: Building2 }]),
    ...(isSeller ? [] : [{ id: 'partners', label: 'Equipe', icon: Users }]),
    ...(isPartner ? [] : [{ id: 'evaluators', label: 'Avaliadores', icon: UserCheck }]),
  ];

  const menuEntries: MenuEntry[] = isEvaluator
    ? [
        { type: 'item', id: 'my-evaluations', label: 'Minhas Avaliações', icon: ClipboardList },
        { type: 'item', id: 'settings', label: 'Configurações', icon: SlidersHorizontal },
        { type: 'item', id: 'profile', label: 'Perfil', icon: Users },
      ]
    : [
        { type: 'item', id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(cadastroItems.length
          ? [
              {
                type: 'group' as const,
                id: 'cadastros',
                label: 'Cadastros',
                icon: FolderOpen,
                children: cadastroItems,
              },
            ]
          : []),
        ...(isPartner ? [] : [{ type: 'item', id: 'schedule', label: 'Agendar Avaliação', icon: Calendar }]),
        { type: 'item', id: 'evaluations', label: 'Avaliações', icon: ClipboardList },
        ...(isAdmin ? [{ type: 'item', id: 'quest-editor', label: 'Criar Questionários', icon: FilePenLine }] : []),
        ...(canValidateVoucher
          ? [
              {
                type: 'item' as const,
                id: 'voucher-validation',
                label: 'Validar Voucher',
                icon: ScanQrCode,
              },
            ]
          : []),
        { type: 'item', id: 'analytics', label: 'Relatórios', icon: BarChart3 },
        { type: 'item', id: 'settings', label: 'Configurações', icon: SlidersHorizontal },
        { type: 'item', id: 'profile', label: 'Perfil', icon: Users },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ overflowX: 'hidden' }}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-muted active:bg-muted/80 rounded-lg"
              aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <img
              src={logoSrc}
              alt="Cliente Oculto"
              className="h-6 sm:h-7 w-auto max-w-[8.5rem] object-contain"
            />
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {user.name?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div className="text-right leading-tight min-w-0">
              <p className="text-foreground text-sm sm:text-base font-medium max-w-[10rem] truncate">
                {headerName}
              </p>
              <p className="text-xs text-muted-foreground hidden sm:block">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
            fixed lg:sticky top-0 left-0 h-screen bg-card border-r border-border w-64 z-30
            transition-transform duration-300 lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-full overflow-y-auto p-4 pt-20 lg:pt-4 pb-6">
            <nav className="space-y-1">
              {menuEntries.map((entry) => {
                if (entry.type === 'group') {
                  const Icon = entry.icon;
                  const isAnyChildActive = entry.children.some((child) => currentPage === child.id);
                  return (
                    <div key={entry.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setCadastrosOpen((prev) => !prev)}
                        className={`
                          w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors
                          ${isAnyChildActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}
                        `}
                        aria-expanded={cadastrosOpen}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <span>{entry.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${cadastrosOpen ? 'rotate-0' : '-rotate-90'}`}
                        />
                      </button>
                      {cadastrosOpen && (
                        <div className="pl-4 border-l border-border/70 space-y-1">
                          {entry.children.map((child) => {
                            const ChildIcon = child.icon;
                            const isActive = currentPage === child.id;
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  onNavigate(child.id);
                                  setSidebarOpen(false);
                                }}
                                className={`
                                  w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors
                                  ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted'}
                                `}
                              >
                                <ChildIcon className="w-4 h-4" />
                                <span>{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const Icon = entry.icon;
                const isActive = currentPage === entry.id;

                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      onNavigate(entry.id);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{entry.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
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
