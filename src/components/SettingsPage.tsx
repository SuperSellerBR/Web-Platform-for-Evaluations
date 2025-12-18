import { useEffect, useMemo, useState } from 'react';
import { Layout } from './Layout';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../utils/theme';
import { PwaInstallButton } from './PwaInstallButton';

const ALLOW_REPEATS_KEY = 'schedule:allowRepeats';
const readAllowRepeats = () => {
  const stored = localStorage.getItem(ALLOW_REPEATS_KEY);
  return stored === null ? true : stored === 'true';
};

interface SettingsPageProps {
  user: any;
  accessToken: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export function SettingsPage({ user, onNavigate, onLogout }: SettingsPageProps) {
  const [allowRepeats, setAllowRepeats] = useState(true);
  const [open, setOpen] = useState(true);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const role = (user?.role || '').toString().trim().toLowerCase();
  const isPartner = ['parceiro', 'partner', 'gerente', 'manager', 'vendedor', 'seller'].includes(role);
  const isEvaluator = role === 'evaluator' && !!user?.evaluatorId;
  const showAllowRepeats = useMemo(() => !(isPartner || isEvaluator), [isPartner, isEvaluator]);

  useEffect(() => {
    setAllowRepeats(readAllowRepeats());
  }, []);

  const handleToggle = (value: boolean) => {
    setAllowRepeats(value);
    localStorage.setItem(ALLOW_REPEATS_KEY, value ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('allowRepeatsChanged', { detail: value }));
  };

  return (
    <Layout user={user} currentPage="settings" onNavigate={onNavigate} onLogout={onLogout}>
      <div className={`max-w-5xl mx-auto ${isDark ? 'evaluation-dark' : ''}`}>
        <div className="mb-6 sm:mb-8">
          <h2 className="text-foreground mb-2">Configurações</h2>
          <p className="text-muted-foreground">Ajuste preferências da plataforma</p>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border">
              <p className="text-foreground font-medium">Aparência</p>
              <p className="text-sm text-muted-foreground">
                Escolha como o tema é aplicado (atual: {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'})
              </p>
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'system', label: 'Sistema', description: 'Segue tema do dispositivo' },
                  { value: 'light', label: 'Claro', description: 'Fixa tema claro' },
                  { value: 'dark', label: 'Escuro', description: 'Fixa tema escuro' },
                ].map((option) => {
                  const isActive = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                      className={`
                        min-w-[8rem] px-4 py-2 rounded-lg border text-left transition-colors
                        ${isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-muted text-foreground'}
                      `}
                      aria-pressed={isActive}
                    >
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border flex items-center gap-3">
              <div>
                <p className="text-foreground font-medium">Instalar aplicativo</p>
                <p className="text-sm text-muted-foreground">
                  Adicione à tela inicial para abrir em tela cheia e acessar mais rápido.
                </p>
              </div>
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                No iPhone/iPad você verá as instruções; no Chrome/Edge aparece o diálogo de instalação quando disponível.
              </p>
              <PwaInstallButton variant="button" className="sm:self-end" />
            </div>
          </div>

          {showAllowRepeats && (
            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 text-left"
              >
                <div>
                  <p className="text-foreground">Atribuição de avaliadores</p>
                  <p className="text-muted-foreground text-sm">Permitir repetição de avaliadores por empresa</p>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
                />
              </button>
              {open && (
                <div className="border-t border-border px-4 py-3 sm:px-6 sm:py-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowRepeats}
                      onChange={(e) => handleToggle(e.target.checked)}
                      className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-foreground">
                      Permitir avaliadores que já avaliaram a empresa (modo de teste)
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
