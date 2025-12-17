export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function formatCnpj(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base12 = cnpj.slice(0, 12);
  const digit1 = calcDigit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const base13 = base12 + String(digit1);
  const digit2 = calcDigit(base13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj === base12 + String(digit1) + String(digit2);
}

function formatBrazilPhone(area?: string, number?: string): string {
  const ddd = onlyDigits(area || "");
  const digits = onlyDigits(number || "");
  if (!ddd && !digits) return "";

  const formattedNumber =
    digits.length === 8
      ? digits.replace(/^(\d{4})(\d{4})$/, "$1-$2")
      : digits.length === 9
        ? digits.replace(/^(\d{5})(\d{4})$/, "$1-$2")
        : digits;

  if (!ddd) return formattedNumber;
  return `(${ddd}) ${formattedNumber}`.trim();
}

function formatCep(value?: string): string {
  const digits = onlyDigits(value || "");
  if (digits.length !== 8) return value || "";
  return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export type CnpjaOffice = {
  taxId?: string;
  alias?: string;
  company?: {
    name?: string;
  };
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    details?: string;
    zip?: string;
  };
  phones?: Array<{
    area?: string;
    number?: string;
  }>;
  emails?: Array<{
    address?: string;
  }>;
};

export async function fetchCnpjaOffice(
  cnpj: string,
  opts?: { signal?: AbortSignal },
): Promise<CnpjaOffice> {
  const digits = onlyDigits(cnpj);
  const url = `https://open.cnpja.com/office/${encodeURIComponent(digits)}`;
  const res = await fetch(url, { method: "GET", signal: opts?.signal });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body ? ` (${body.slice(0, 180)})` : "";
    throw new Error(`Falha ao consultar CNPJa: HTTP ${res.status}${detail}`);
  }

  return (await res.json()) as CnpjaOffice;
}

export function officeToCompanyFields(office: CnpjaOffice): {
  cnpj?: string;
  name?: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
} {
  const cnpj = office.taxId ? formatCnpj(office.taxId) : undefined;
  const legalName = office.company?.name || undefined;
  const name = office.alias || legalName || undefined;

  const street = (office.address?.street || "").trim();
  const number = (office.address?.number || "").trim();
  const details = (office.address?.details || "").trim();
  const district = (office.address?.district || "").trim();
  const city = (office.address?.city || "").trim();
  const state = (office.address?.state || "").trim();
  const zip = formatCep(office.address?.zip || "");

  const addressParts: string[] = [];
  const streetLine = [street, number].filter(Boolean).join(", ");
  if (streetLine) addressParts.push(streetLine);
  if (details) addressParts.push(details);

  const localityLeft = [district, city].filter(Boolean).join(" - ");
  const localityRight = [state, zip].filter(Boolean).join(", ");
  const locality = [localityLeft, localityRight].filter(Boolean).join(" / ");
  if (locality) addressParts.push(locality);

  const address = addressParts.join(" | ") || undefined;

  const firstPhone = office.phones?.[0];
  const phone = formatBrazilPhone(firstPhone?.area, firstPhone?.number) || undefined;

  const email = (office.emails?.[0]?.address || "").trim() || undefined;

  return { cnpj, name, legalName, address, phone, email };
}

