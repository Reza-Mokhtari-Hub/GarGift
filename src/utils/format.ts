import * as jalaali from 'jalaali-js';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts English digits to Persian digits when usePersianDigits is true.
 */
export function toPersianDigits(input: string | number, usePersianDigits = true): string {
  const str = String(input ?? '');
  if (!usePersianDigits) return str;
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] || d);
}

/**
 * Converts any Persian or Arabic digits inside a string to English ASCII digits.
 */
export function toEnglishDigits(input: string): string {
  if (!input) return '';
  let result = input;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), String(i));
    result = result.replace(new RegExp(ARABIC_DIGITS[i], 'g'), String(i));
  }
  return result;
}

/**
 * Formats an integer Toman amount with thousand separators.
 */
export function formatToman(amount: number, usePersianDigits = true, withUnit = true): string {
  const safeInt = Math.round(Number(amount) || 0);
  const formatted = safeInt.toLocaleString('en-US');
  const digits = toPersianDigits(formatted, usePersianDigits);
  return withUnit ? `${digits} تومان` : digits;
}

/**
 * Formats USD in cents (e.g. 2500 -> $25 or $25.50).
 */
export function formatUsdCents(cents: number, usePersianDigits = false): string {
  const safeCents = Math.round(Number(cents) || 0);
  const dollars = safeCents / 100;
  const formatted = Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2);
  return `$${toPersianDigits(formatted, usePersianDigits)}`;
}

/**
 * Converts a UTC ISO string or Date to Jalali formatted date string (e.g. ۱۴۰۵/۰۸/۲۵ - ۱۴:۳۰)
 */
export function formatJalaliDate(
  isoOrDate: string | Date | null | undefined,
  includeTime = true,
  usePersianDigits = true
): string {
  if (!isoOrDate) return '—';
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return '—';

  const { jy, jm, jd } = jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );

  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${jy}/${pad(jm)}/${pad(jd)}`;

  if (!includeTime) {
    return toPersianDigits(datePart, usePersianDigits);
  }

  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return toPersianDigits(`${datePart} - ${timePart}`, usePersianDigits);
}

/**
 * Dynamic variant price calculator (Pure integer math).
 * Formula:
 *   price = (usdCents / 100) * usdRate * (1 + marginPercent / 100) + fixedFee
 *   rounded to nearest roundingStep (e.g., 1000 Toman)
 *   then apply active discount if applicable.
 */
export interface VariantPricingInput {
  pricingMode: 'fixed' | 'dynamic';
  fixedPriceToman: number;
  usdPriceCents: number;
  globalUsdRate: number;
  categoryUsdRate?: number | null;
  productUsdRate?: number | null;
  globalMarginPercent: number;
  categoryMarginPercent?: number | null;
  productMarginPercent?: number | null;
  fixedFeeToman?: number;
  roundingStepToman?: number;
  discountPercent?: number;
  discountAmountToman?: number;
  discountStartAt?: string | null;
  discountEndAt?: string | null;
  nowIso?: string;
}

export interface CalculatedPriceResult {
  basePriceToman: number;
  finalPriceToman: number;
  discountAmountToman: number;
  discountPercent: number;
  isDiscountActive: boolean;
  effectiveUsdRate: number;
  effectiveMarginPercent: number;
}

export function calculateVariantPrice(input: VariantPricingInput): CalculatedPriceResult {
  // Priority: product > category > global
  const effectiveUsdRate =
    input.productUsdRate && input.productUsdRate > 0
      ? input.productUsdRate
      : input.categoryUsdRate && input.categoryUsdRate > 0
      ? input.categoryUsdRate
      : input.globalUsdRate;

  const effectiveMarginPercent =
    input.productMarginPercent !== undefined && input.productMarginPercent !== null
      ? input.productMarginPercent
      : input.categoryMarginPercent !== undefined && input.categoryMarginPercent !== null
      ? input.categoryMarginPercent
      : input.globalMarginPercent;

  const roundingStep = Math.max(1, Math.round(input.roundingStepToman || 1000));
  const fixedFee = Math.round(input.fixedFeeToman || 0);

  let basePriceToman = Math.round(input.fixedPriceToman || 0);

  if (input.pricingMode === 'dynamic') {
    // usdPriceCents * effectiveUsdRate / 100 * (100 + effectiveMarginPercent) / 100 + fixedFee
    const rawToman =
      ((input.usdPriceCents * effectiveUsdRate) / 100) *
        (1 + effectiveMarginPercent / 100) +
      fixedFee;
    basePriceToman = Math.round(rawToman / roundingStep) * roundingStep;
  }

  basePriceToman = Math.max(0, basePriceToman);

  // Check if discount is active
  const now = input.nowIso ? new Date(input.nowIso).getTime() : Date.now();
  let withinSchedule = true;
  if (input.discountStartAt) {
    const startMs = new Date(input.discountStartAt).getTime();
    if (!Number.isNaN(startMs) && now < startMs) withinSchedule = false;
  }
  if (input.discountEndAt) {
    const endMs = new Date(input.discountEndAt).getTime();
    if (!Number.isNaN(endMs) && now > endMs) withinSchedule = false;
  }

  let discountAmount = 0;
  let discountPercent = 0;

  if (withinSchedule) {
    if (input.discountPercent && input.discountPercent > 0) {
      discountPercent = Math.min(99, Math.max(0, Math.round(input.discountPercent)));
      const rawDiscounted = basePriceToman * (1 - discountPercent / 100);
      const roundedFinal = Math.round(rawDiscounted / roundingStep) * roundingStep;
      discountAmount = Math.max(0, basePriceToman - roundedFinal);
    } else if (input.discountAmountToman && input.discountAmountToman > 0) {
      discountAmount = Math.min(basePriceToman, Math.round(input.discountAmountToman));
      discountPercent =
        basePriceToman > 0 ? Math.round((discountAmount / basePriceToman) * 100) : 0;
    }
  }

  const finalPriceToman = Math.max(0, basePriceToman - discountAmount);
  const isDiscountActive = discountAmount > 0 && finalPriceToman < basePriceToman;

  return {
    basePriceToman,
    finalPriceToman,
    discountAmountToman: discountAmount,
    discountPercent,
    isDiscountActive,
    effectiveUsdRate,
    effectiveMarginPercent,
  };
}

/**
 * Masks a gift card code so only the last 4 characters are visible.
 */
export function maskGiftCode(rawCode: string): string {
  const clean = (rawCode || '').trim();
  if (clean.length <= 4) return '****';
  const last4 = clean.slice(-4);
  return `****-****-${last4}`;
}
