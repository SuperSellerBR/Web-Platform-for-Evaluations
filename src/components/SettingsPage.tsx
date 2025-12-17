import { useEffect, useMemo, useState } from 'react';
import { Layout } from './Layout';
import { ChevronRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTheme } from '../utils/theme';
import { projectId } from '../utils/supabase/info';

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

export function SettingsPage({ user, accessToken, onNavigate, onLogout }: SettingsPageProps) {
  const [allowRepeats, setAllowRepeats] = useState(true);
  const [open, setOpen] = useState(true);
  const [instaHandle, setInstaHandle] = useState('');
  const [instaUrl, setInstaUrl] = useState('');
  const [instaError, setInstaError] = useState('');
  const [instaLoading, setInstaLoading] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

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

  const getInstaAvatar = async () => {
    setInstaError('');
    setInstaUrl('');
    const handle = instaHandle.trim().replace(/^@/, '');
    if (!handle) {
      setInstaError('Informe um @ válido.');
      return;
    }
    setInstaLoading(true);
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-7946999d/instagram-avatar?handle=${encodeURIComponent(handle)}`;
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) {
        throw new Error('Não foi possível obter a foto.');
      }
      setInstaUrl(url);
    } catch (err: any) {
      setInstaError(err?.message || 'Falha ao buscar a foto.');
    } finally {
      setInstaLoading(false);
    }
  };

  return (
    <Layout user={user} currentPage="settings" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto">
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
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-foreground font-medium">Teste de avatar do Instagram</p>
                <p className="text-sm text-muted-foreground">Digite um @ para ver a foto retornada pela função</p>
              </div>
            </div>
            <div className="px-4 py-3 sm:px-6 sm:py-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={instaHandle}
                  onChange={(e) => setInstaHandle(e.target.value)}
                  placeholder="@usuario ou url do Instagram"
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-input-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={getInstaAvatar}
                  disabled={instaLoading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {instaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Buscar foto
                </button>
              </div>
              {instaError && <p className="text-sm text-destructive">{instaError}</p>}
              {instaUrl && !instaError && (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-border bg-muted">
                    <img
                      src={instaUrl}
                      alt="Avatar Instagram"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setInstaError('Não foi possível carregar a imagem retornada.')}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground break-all">
                    <p>URL usada:</p>
                    <p className="text-foreground">{instaUrl}</p>
                  </div>
                </div>
              )}
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
