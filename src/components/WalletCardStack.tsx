import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCog, FilePenLine, Mic, QrCode } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { getCardBaseGradient } from '../utils/cardBaseColor';
import { useTheme } from '../utils/theme';

export type WalletCardItem = {
  id: string;
  companyName: string;
  logoUrl?: string;
  dateLabel: string;
  voucherCode?: string;
  voucherValue?: number | null;
  evaluatorName?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  metrics?: Array<{ key: string; label: string; value: string }>;
  accentSeed?: string;
  baseColor?: string;
  maskedId?: string;
  companyDisplay?: string;
  statuses?: Array<{ key: string; label: string; done: boolean; Icon: any }>;
};

interface WalletCardStackProps {
  items: WalletCardItem[];
  onOpen: (id: string) => void;
}

const BRAND_COLORS = [
  '#0b5132',
  '#0c364c',
  '#4f1b6b',
  '#9c2f2f',
  '#264653',
  '#2b3a67',
  '#b36b00',
  '#2a2a2a',
];

const hashToIndex = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % BRAND_COLORS.length;
};

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return null;
  }
};

const uppercaseName = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    return text.toLocaleUpperCase('pt-BR');
  } catch {
    return text.toUpperCase();
  }
};

export function WalletCardStack({ items, onOpen }: WalletCardStackProps) {
  if (!items.length) return null;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6 w-full">
      {items.map((item) => {
        const accent = BRAND_COLORS[hashToIndex(item.accentSeed || item.companyName || item.id)];
        const accentGradient = `linear-gradient(135deg, ${accent}, ${accent}dd)`;
        const currency = formatCurrency(item.voucherValue);
        const baseGradient = getCardBaseGradient(item.baseColor);

        return (
          <WalletCard
            key={item.id}
            item={item}
            accentGradient={accentGradient}
            baseGradient={baseGradient}
            isDark={isDark}
            onOpen={() => onOpen(item.id)}
            currency={currency}
          />
        );
      })}
    </div>
  );
}

function WalletCard(props: {
  item: WalletCardItem;
  accentGradient: string;
  baseGradient: string;
  isDark: boolean;
  onOpen: () => void;
  currency: string | null;
}) {
  const { item, accentGradient, baseGradient, isDark, onOpen, currency } = props;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dims = useMemo(() => {
    const w = width || 320;
    const h = w * 0.625;
    return {
      w,
      h,
      pad: w * 0.05,
      radius: h * 0.06,
      frame: h * 0.04,
      logoH: w * 0.12,
      marginTop: w * 0.03,
      dateSize: h * 0.042,
      voucherSize: h * 0.048,
      voucherSpacing: h * 0.02,
      valueSize: h * 0.05,
      valueMargin: h * 0.02,
      labelSize: h * 0.03,
      nameSize: h * 0.05,
      cpfSize: h * 0.04,
      iconSize: w * 0.06,
      iconGap: w * 0.03,
      footerH: h * 0.14,
    };
  }, [width]);

  const cardShadow = isDark
    ? '0 34px 90px -36px rgba(0,0,0,0.95), 0 18px 34px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.18), 0 0 36px rgba(255,255,255,0.10)'
    : '0 20px 36px -18px rgba(0,0,0,0.32), 0 10px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)';

  const cardFilter = isDark
    ? 'drop-shadow(0 22px 44px rgba(0,0,0,0.9)) drop-shadow(0 0 34px rgba(255,255,255,0.14))'
    : 'drop-shadow(0 12px 24px rgba(0,0,0,0.2))';

  const secondaryLabel = item.secondaryLabel || 'Avaliador';
  const secondaryValue = item.secondaryValue || item.evaluatorName || '-';
  const metrics = (item.metrics || []).filter((m) => m?.key && m?.label && m?.value);
  const companyDisplayText = uppercaseName(item.companyDisplay || item.companyName);
  const secondaryValueText = uppercaseName(secondaryValue || '-');
  const companyInitial = uppercaseName(item.companyName || '?').slice(0, 1) || '?';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full transition-all duration-300 ease-out text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      <div ref={cardRef} className="mx-auto" style={{ width: '100%', aspectRatio: '16 / 10', maxWidth: '100%' }}>
        <div className="relative" style={{ height: dims.h, padding: dims.frame }}>
          {isDark ? (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                padding: dims.frame,
                borderRadius: dims.radius,
                transform: `translateY(${dims.frame * 0.55}px)`,
                filter: 'blur(18px)',
                background:
                  'radial-gradient(80% 110% at 50% 35%, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 55%, transparent 72%)',
                opacity: 0.95,
              }}
            />
          ) : null}
          <div
            className="relative z-10 overflow-hidden shadow-[0_26px_40px_-18px_rgba(15,23,42,0.65),0_12px_20px_rgba(0,0,0,0.25)]"
	            style={{
	              height: '100%',
	              borderRadius: dims.radius,
	              background: '#2f2f2f',
	              boxShadow: cardShadow,
	              filter: cardFilter,
	            }}
	          >
            <div
              className="absolute inset-0"
	              style={{
	                padding: dims.pad,
	                borderRadius: dims.radius - 4,
	                background: baseGradient,
	              }}
	            >
	              <div className="absolute inset-0 pointer-events-none">
	                <div
	                  className="w-full h-full opacity-20"
	                  style={{ background: 'radial-gradient(120% 120% at 20% 20%, rgba(255,255,255,0.8), transparent 55%)' }}
	                />
	                <div
	                  className="w-full h-full opacity-14"
	                  style={{ background: 'linear-gradient(135deg, transparent 60%, rgba(0,0,0,0.16) 100%)' }}
	                />
	              </div>

              {/* Logo */}
              <div
                style={{
                  position: 'absolute',
                  top: dims.marginTop,
                  left: dims.marginTop,
                  height: dims.logoH,
                  width: 'auto',
                }}
              >
                {item.logoUrl ? (
                  <img src={item.logoUrl} alt={item.companyName} style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
                ) : (
                  <div
                    style={{
                      height: dims.logoH,
                      width: dims.logoH,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: accentGradient,
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: dims.logoH * 0.35,
                      textTransform: 'uppercase',
                    }}
                  >
                    {companyInitial}
                  </div>
                )}
              </div>

              {/* Date and Voucher */}
              <div
                style={{
                  position: 'absolute',
                  top: dims.marginTop,
                  right: dims.marginTop,
                  textAlign: 'right',
                  fontFamily: 'OCRA, monospace',
                  letterSpacing: '0.2em',
                  fontSize: dims.dateSize,
                  color: '#2c2c2c',
                }}
              >
                {item.dateLabel}
                {item.voucherCode && (
                  <div
                    style={{
                      marginTop: dims.voucherSpacing,
                      fontSize: dims.voucherSize,
                      letterSpacing: '0.15em',
                    }}
                  >
                    {item.voucherCode}
                  </div>
                )}
              </div>

              {/* Value / Metrics */}
              {metrics.length ? (
                <div
                  style={{
                    position: 'absolute',
                    top: dims.h * 0.47,
                    right: dims.marginTop,
                    textAlign: 'right',
                    fontFamily: 'OCRA, monospace',
                    color: '#2c2c2c',
                  }}
                >
                  {metrics.map((metric, idx) => (
                    <div key={metric.key} style={{ marginTop: idx ? dims.h * 0.015 : 0 }}>
                      <div
                        style={{
                          fontSize: dims.labelSize,
                          opacity: 0.75,
                          letterSpacing: '0.12em',
                          marginBottom: dims.h * 0.004,
                        }}
                      >
                        {metric.label}
                      </div>
                      <div style={{ fontSize: dims.valueSize, letterSpacing: '0.15em', fontWeight: 600 }}>
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : currency ? (
                <div
                  style={{
                    position: 'absolute',
                    top: dims.h * 0.5,
                    right: dims.marginTop,
                    textAlign: 'right',
                    fontFamily: 'OCRA, monospace',
                    fontSize: dims.valueSize,
                    color: '#2c2c2c',
                  }}
                >
                  {currency}
                </div>
              ) : null}

              {/* Footer - names */}
              <div
                style={{
                  position: 'absolute',
                  bottom: dims.pad * 2.2,
                  left: dims.pad,
                  right: dims.pad,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: dims.labelSize,
                      opacity: 0.7,
                      marginBottom: dims.h * 0.003,
                      color: '#2c2c2c',
                    }}
                  >
                    Empresa
                  </div>
                  <div
                    style={{
                      fontFamily: 'OCRA, monospace',
                      fontSize: dims.nameSize,
                      letterSpacing: '0.15em',
                      marginBottom: dims.h * 0.006,
                      color: '#2c2c2c',
                      fontWeight: 600,
                    }}
                  >
                    {companyDisplayText || uppercaseName(item.companyName)}
                  </div>

                  <div
                    style={{
                      fontSize: dims.labelSize,
                      opacity: 0.7,
                      marginBottom: dims.h * 0.003,
                      color: '#2c2c2c',
                    }}
                  >
                    {secondaryLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: 'OCRA, monospace',
                      fontSize: dims.nameSize,
                      letterSpacing: '0.15em',
                      marginBottom: dims.h * 0.005,
                      color: '#2c2c2c',
                      fontWeight: 600,
                    }}
                  >
                    {secondaryValueText}
                  </div>
                  {item.maskedId && (
                    <div
                      style={{
                        fontFamily: 'OCRA, monospace',
                        fontSize: dims.cpfSize,
                        letterSpacing: '0.25em',
                        opacity: 0.85,
                        color: '#2c2c2c',
                      }}
                    >
                      {item.maskedId}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - icons aligned to bottom */}
              {item.statuses?.length ? (
                <div
                  style={{
                    position: 'absolute',
                    bottom: dims.pad * 0.6,
                    right: dims.pad,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: dims.iconGap,
                    height: dims.footerH,
                  }}
                >
                  {item.statuses.map((status) => (
                    <Tooltip key={status.key}>
                      <TooltipTrigger asChild>
                        <div
                          style={{
                            height: dims.iconSize,
                            width: dims.iconSize,
                            borderRadius: '50%',
                            border: '1.5px solid rgba(60,60,60,0.6)',
                            background: 'rgba(255,255,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: status.done ? 0.9 : 0.6,
                          }}
                        >
                          <status.Icon
                            style={{
                              width: dims.iconSize * 0.55,
                              height: dims.iconSize * 0.55,
                              strokeWidth: 2,
                              color: status.done ? '#16a34a' : '#3a3a3a',
                            }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>
                        {status.label}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
