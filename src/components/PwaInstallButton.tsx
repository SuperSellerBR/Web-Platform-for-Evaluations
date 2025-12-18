import { useEffect, useMemo, useState } from 'react';
import { Check, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

type InstallOutcome = 'accepted' | 'dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOS;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true
  );
}

type PwaInstallButtonVariant = 'icon' | 'button';

interface PwaInstallButtonProps {
  variant?: PwaInstallButtonVariant;
  className?: string;
}

export function PwaInstallButton({ variant = 'icon', className }: PwaInstallButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dialogOpen, setDialogOpen] = useState(false);
  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    setInstalled(isStandalone());
    setInstallPrompt(((window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | null) || null);

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      (window as any).__pwaInstallPrompt = event;
      setInstallPrompt(event);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      (window as any).__pwaInstallPrompt = null;
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const label = ios ? 'Adicionar à Tela de Início' : 'Instalar app';

  if (installed) {
    if (variant === 'icon') return null;
    return (
      <Button type="button" variant="secondary" disabled className={className}>
        <Check className="w-4 h-4" />
        Instalado
      </Button>
    );
  }

  const onInstallClick = async () => {
    if (!installPrompt) {
      setDialogOpen(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
    } finally {
      setInstallPrompt(null);
    }
  };

  const onClick = ios ? () => setDialogOpen(true) : onInstallClick;

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={onClick}
          className={`p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors ${className || ''}`}
          title={label}
          aria-label={label}
        >
          <Download className="w-5 h-5" />
        </button>
      ) : (
        <Button type="button" onClick={onClick} className={className}>
          <Download className="w-4 h-4" />
          {label}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar o app</DialogTitle>
            <DialogDescription>
              A instalação depende do navegador e exige ação manual.
            </DialogDescription>
          </DialogHeader>

          {ios ? (
            <div className="text-sm text-foreground space-y-2">
              <p>No iPhone/iPad (Safari):</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Toque em Compartilhar (quadrado com seta para cima).</li>
                <li>Escolha “Adicionar à Tela de Início”.</li>
                <li>Confirme em “Adicionar”.</li>
              </ol>
            </div>
          ) : (
            <div className="text-sm text-foreground space-y-2">
              <p>No Chrome/Edge:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Abra o menu do navegador (⋮).</li>
                <li>Selecione “Instalar app” / “Adicionar à tela inicial”.</li>
              </ol>
              <p className="text-muted-foreground">
                Se a opção não aparecer, recarregue a página e use por alguns segundos.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
