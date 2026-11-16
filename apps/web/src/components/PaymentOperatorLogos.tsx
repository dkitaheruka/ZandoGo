import { Banknote } from 'lucide-react';

export type PaymentMethodCodeType =
  | 'MOBILE_MONEY_MPESA'
  | 'MOBILE_MONEY_AIRTEL'
  | 'MOBILE_MONEY_ORANGE'
  | 'MOBILE_MONEY_MTN'
  | 'CARD_STRIPE'
  | 'CASH_ON_DELIVERY';

export type StorePaymentMethodType =
  | 'MPESA'
  | 'AIRTEL_MONEY'
  | 'ORANGE_MONEY'
  | 'MTN_MOMO'
  | 'CARD';

export interface OperatorMetaItem {
  code: PaymentMethodCodeType;
  storeCode?: StorePaymentMethodType;
  label: string;
  shortLabel: string;
  prefixes: string;
  accentBg: string;
  accentText: string;
  borderClass: string;
}

export const OPERATOR_META: Record<PaymentMethodCodeType, OperatorMetaItem> = {
  MOBILE_MONEY_MPESA: {
    code: 'MOBILE_MONEY_MPESA',
    storeCode: 'MPESA',
    label: 'M-Pesa Vodacom',
    shortLabel: 'Vodacom M-Pesa',
    prefixes: '081 / 082 / 083',
    accentBg: 'bg-[#E60000]/10',
    accentText: 'text-[#B90000]',
    borderClass: 'border-[#E60000]/35',
  },
  MOBILE_MONEY_AIRTEL: {
    code: 'MOBILE_MONEY_AIRTEL',
    storeCode: 'AIRTEL_MONEY',
    label: 'Airtel Money',
    shortLabel: 'Airtel Money',
    prefixes: '097 / 098 / 099',
    accentBg: 'bg-[#E40000]/10',
    accentText: 'text-[#C40000]',
    borderClass: 'border-[#E40000]/35',
  },
  MOBILE_MONEY_ORANGE: {
    code: 'MOBILE_MONEY_ORANGE',
    storeCode: 'ORANGE_MONEY',
    label: 'Orange Money',
    shortLabel: 'Orange Money',
    prefixes: '080 / 084 / 085 / 089',
    accentBg: 'bg-[#FF7900]/12',
    accentText: 'text-[#C75A00]',
    borderClass: 'border-[#FF7900]/40',
  },
  MOBILE_MONEY_MTN: {
    code: 'MOBILE_MONEY_MTN',
    storeCode: 'MTN_MOMO',
    label: 'MTN MoMo',
    shortLabel: 'MTN MoMo',
    prefixes: '088 / +250 / +256',
    accentBg: 'bg-[#FFCC00]/20',
    accentText: 'text-[#004F71]',
    borderClass: 'border-[#FFCC00]/70',
  },
  CARD_STRIPE: {
    code: 'CARD_STRIPE',
    storeCode: 'CARD',
    label: 'Carte Visa / Mastercard',
    shortLabel: 'Visa / Mastercard',
    prefixes: 'USD & CDF',
    accentBg: 'bg-[#1A1F71]/10',
    accentText: 'text-[#1A1F71]',
    borderClass: 'border-[#1A1F71]/30',
  },
  CASH_ON_DELIVERY: {
    code: 'CASH_ON_DELIVERY',
    label: 'Espèces à la livraison',
    shortLabel: 'Espèces à la remise',
    prefixes: 'Remise OTP',
    accentBg: 'bg-seve/10',
    accentText: 'text-seve',
    borderClass: 'border-seve/35',
  },
};

export function detectOperatorFromPhone(
  phone: string,
): 'MOBILE_MONEY_MPESA' | 'MOBILE_MONEY_AIRTEL' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_MTN' | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+250') || digits.startsWith('250') || digits.startsWith('+256') || digits.startsWith('256')) {
    return 'MOBILE_MONEY_MTN';
  }

  let local = digits;
  if (local.startsWith('+243')) local = local.slice(4);
  else if (local.startsWith('243')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);

  if (local.length < 2) return null;
  const p2 = local.slice(0, 2);

  if (p2 === '81' || p2 === '82' || p2 === '83') return 'MOBILE_MONEY_MPESA';
  if (p2 === '97' || p2 === '98' || p2 === '99') return 'MOBILE_MONEY_AIRTEL';
  if (p2 === '80' || p2 === '84' || p2 === '85' || p2 === '89') return 'MOBILE_MONEY_ORANGE';
  if (p2 === '88') return 'MOBILE_MONEY_MTN';
  return null;
}

export function detectStoreOperatorFromPhone(
  phone: string,
): 'MPESA' | 'AIRTEL_MONEY' | 'ORANGE_MONEY' | 'MTN_MOMO' | null {
  const detected = detectOperatorFromPhone(phone);
  if (!detected) return null;
  if (detected === 'MOBILE_MONEY_MPESA') return 'MPESA';
  if (detected === 'MOBILE_MONEY_AIRTEL') return 'AIRTEL_MONEY';
  if (detected === 'MOBILE_MONEY_ORANGE') return 'ORANGE_MONEY';
  return 'MTN_MOMO';
}

export function mapStoreMethodToPaymentCode(method: string): PaymentMethodCodeType {
  if (method === 'AIRTEL_MONEY' || method === 'MOBILE_MONEY_AIRTEL') return 'MOBILE_MONEY_AIRTEL';
  if (method === 'ORANGE_MONEY' || method === 'MOBILE_MONEY_ORANGE') return 'MOBILE_MONEY_ORANGE';
  if (method === 'MTN_MOMO' || method === 'MOBILE_MONEY_MTN') return 'MOBILE_MONEY_MTN';
  if (method === 'CARD' || method === 'CARD_STRIPE') return 'CARD_STRIPE';
  if (method === 'CASH_ON_DELIVERY') return 'CASH_ON_DELIVERY';
  return 'MOBILE_MONEY_MPESA';
}

export function OperatorLogo({
  operator,
  size = 'md',
}: {
  operator: PaymentMethodCodeType | StorePaymentMethodType | string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const code = mapStoreMethodToPaymentCode(operator);
  const dim =
    size === 'sm' ? 'w-7 h-5' : size === 'lg' ? 'w-11 h-8' : 'w-9 h-6';

  if (code === 'MOBILE_MONEY_MPESA') {
    return (
      <svg viewBox="0 0 44 28" className={`${dim} shrink-0`} aria-label="Vodacom M-Pesa">
        <rect width="44" height="28" rx="5" fill="#E60000" />
        <circle cx="13" cy="14" r="7.5" fill="#FFFFFF" />
        <path d="M13 8.5c2.2 0 4 1.8 4 4.2 0 2.5-1.9 4.8-4.2 4.8-1.4 0-2.5-.8-2.8-1.9 1.6.3 3.2-.8 3.2-2.7 0-1.6-.9-2.7-2.2-3.2.5-.7 1.2-1.2 2-1.2z" fill="#E60000" />
        <rect x="22" y="7" width="18" height="14" rx="3" fill="#00A651" />
        <text x="31" y="16.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.8" fontWeight="800" fontFamily="sans-serif">
          M-P
        </text>
      </svg>
    );
  }

  if (code === 'MOBILE_MONEY_AIRTEL') {
    return (
      <svg viewBox="0 0 44 28" className={`${dim} shrink-0`} aria-label="Airtel Money">
        <rect width="44" height="28" rx="5" fill="#E40000" />
        <path
          d="M14 21c-2.8 0-4.8-1.7-4.8-4.3 0-3.5 3.6-6.9 9.7-8.7 2.5-.7 5.2-.7 6.3.7 1 1.2-.2 3-2.5 3.8-2.6.9-5.8.6-7 2.6-.7 1.1.1 2.2 1.6 2.2 1.8 0 3.7-1 5.2-2.4l1.2 2.4C21.6 19.6 18 21 14 21z"
          fill="#FFFFFF"
        />
        <text x="33.5" y="17.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.4" fontWeight="800" fontFamily="sans-serif">
          airtel
        </text>
      </svg>
    );
  }

  if (code === 'MOBILE_MONEY_ORANGE') {
    return (
      <svg viewBox="0 0 44 28" className={`${dim} shrink-0`} aria-label="Orange Money">
        <rect width="44" height="28" rx="5" fill="#181818" />
        <rect x="3" y="4" width="20" height="20" rx="3" fill="#FF7900" />
        <path d="M8 11h7l-2.2-2.2M18 17h-7l2.2 2.2" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="33" y="16.5" textAnchor="middle" fill="#FF7900" fontSize="7" fontWeight="800" fontFamily="sans-serif">
          OM
        </text>
      </svg>
    );
  }

  if (code === 'MOBILE_MONEY_MTN') {
    return (
      <svg viewBox="0 0 44 28" className={`${dim} shrink-0`} aria-label="MTN MoMo">
        <rect width="44" height="28" rx="5" fill="#FFCC00" />
        <ellipse cx="22" cy="14" rx="17.5" ry="9" fill="#004F71" />
        <text x="22" y="16.4" textAnchor="middle" fill="#FFCC00" fontSize="7.4" fontWeight="900" fontFamily="sans-serif">
          MTN MoMo
        </text>
      </svg>
    );
  }

  if (code === 'CARD_STRIPE') {
    return (
      <svg viewBox="0 0 44 28" className={`${dim} shrink-0`} aria-label="Visa / Mastercard">
        <rect width="44" height="28" rx="5" fill="#1A1F71" />
        <circle cx="27" cy="14" r="6" fill="#EB001B" />
        <circle cx="33.5" cy="14" r="6" fill="#F79E1B" fillOpacity="0.9" />
        <text x="12" y="16.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.6" fontWeight="800" fontStyle="italic" fontFamily="sans-serif">
          VISA
        </text>
      </svg>
    );
  }

  return (
    <span className={`${dim} rounded bg-seve/15 border border-seve/30 text-seve inline-flex items-center justify-center shrink-0`}>
      <Banknote className="w-4 h-4" />
    </span>
  );
}

export function PaymentOperatorBadge({
  operator,
  refCode,
}: {
  operator?: string | null;
  refCode?: string | null;
}) {
  const code = mapStoreMethodToPaymentCode(operator || 'MOBILE_MONEY_MPESA');
  const meta = OPERATOR_META[code];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-semibold ${meta.accentBg} ${meta.accentText} ${meta.borderClass}`}
    >
      <OperatorLogo operator={code} size="sm" />
      <span>{meta.shortLabel}</span>
      {refCode && <span className="font-mono text-[10px] opacity-80">· {refCode}</span>}
    </span>
  );
}

export function PaymentOperatorStrip({
  compact = false,
  dark = false,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  const operators: PaymentMethodCodeType[] = [
    'MOBILE_MONEY_AIRTEL',
    'MOBILE_MONEY_MPESA',
    'MOBILE_MONEY_ORANGE',
    'MOBILE_MONEY_MTN',
    'CARD_STRIPE',
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {operators.map((op) => {
        const meta = OPERATOR_META[op];
        return (
          <div
            key={op}
            className={`inline-flex items-center gap-1.5 rounded-card border px-2 py-1 ${
              dark
                ? 'bg-brume/8 border-brume/15 text-brume/90'
                : 'bg-white border-encre/15 text-encre'
            }`}
            title={`${meta.label} (${meta.prefixes})`}
          >
            <OperatorLogo operator={op} size="sm" />
            {!compact && (
              <span className="text-[11px] font-display font-semibold whitespace-nowrap">
                {meta.shortLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PaymentMethodSelector({
  value,
  onChange,
  includeCash = false,
  autoDetectedCode = null,
  columns = 2,
}: {
  value: PaymentMethodCodeType;
  onChange: (code: PaymentMethodCodeType) => void;
  includeCash?: boolean;
  autoDetectedCode?: PaymentMethodCodeType | null;
  columns?: 2 | 3;
}) {
  const options: PaymentMethodCodeType[] = includeCash
    ? [
        'MOBILE_MONEY_MPESA',
        'MOBILE_MONEY_AIRTEL',
        'MOBILE_MONEY_ORANGE',
        'MOBILE_MONEY_MTN',
        'CARD_STRIPE',
        'CASH_ON_DELIVERY',
      ]
    : [
        'MOBILE_MONEY_MPESA',
        'MOBILE_MONEY_AIRTEL',
        'MOBILE_MONEY_ORANGE',
        'MOBILE_MONEY_MTN',
        'CARD_STRIPE',
      ];

  return (
    <div className={`grid grid-cols-1 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
      {options.map((code) => {
        const meta = OPERATOR_META[code];
        const active = value === code;
        const isDetected = autoDetectedCode === code;

        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={`flex items-center gap-2.5 p-3 rounded-card border text-left transition ${
              active
                ? 'border-seve bg-seve/10 ring-1 ring-seve/30 shadow-xs'
                : 'border-encre/15 bg-white hover:border-encre/30'
            }`}
          >
            <OperatorLogo operator={code} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-display font-bold text-encre truncate">{meta.label}</p>
                {isDetected && (
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-safran/25 text-nuit">
                    Détecté
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-encre/60 truncate">{meta.prefixes}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
