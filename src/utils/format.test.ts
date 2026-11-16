import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPersianDigits,
  toEnglishDigits,
  formatToman,
  formatUsdCents,
  calculateVariantPrice,
  maskGiftCode,
} from './format';
import {
  encryptCode,
  decryptCode,
  hashPassword,
  verifyPassword,
  hashCodeFingerprint,
} from '../server/crypto';

test('toPersianDigits and toEnglishDigits convert accurately', () => {
  assert.equal(toPersianDigits('12345', true), '۱۲۳۴۵');
  assert.equal(toPersianDigits('12345', false), '12345');
  assert.equal(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(toEnglishDigits('٠٩١٢٣٤٥٦٧٨٩'), '09123456789');
});

test('formatToman and formatUsdCents format integers without decimals', () => {
  assert.equal(formatToman(1250000, false, true), '1,250,000 تومان');
  assert.equal(formatToman(1250000, true, false), '۱,۲۵۰,۰۰۰');
  assert.equal(formatUsdCents(2500, false), '$25');
  assert.equal(formatUsdCents(999, false), '$9.99');
});

test('calculateVariantPrice computes dynamic price with priority hierarchy and rounding', () => {
  // 10 USD (1000 cents) * 70,000 Toman * (1 + 10%) = 770,000 Toman
  const res1 = calculateVariantPrice({
    pricingMode: 'dynamic',
    fixedPriceToman: 0,
    usdPriceCents: 1000,
    globalUsdRate: 70000,
    globalMarginPercent: 10,
    roundingStepToman: 1000,
  });
  assert.equal(res1.basePriceToman, 770000);
  assert.equal(res1.finalPriceToman, 770000);
  assert.equal(res1.isDiscountActive, false);

  // Override with category rate 80,000 and 10% discount
  const res2 = calculateVariantPrice({
    pricingMode: 'dynamic',
    fixedPriceToman: 0,
    usdPriceCents: 1000,
    globalUsdRate: 70000,
    categoryUsdRate: 80000,
    globalMarginPercent: 0,
    roundingStepToman: 1000,
    discountPercent: 10,
  });
  assert.equal(res2.basePriceToman, 800000);
  assert.equal(res2.finalPriceToman, 720000);
  assert.equal(res2.discountAmountToman, 80000);
  assert.equal(res2.isDiscountActive, true);
});

test('AES-256-GCM gift code encryption and masking work properly', () => {
  const raw = 'GPLAY-ABCD-EFGH-9876';
  const encrypted = encryptCode(raw);
  assert.notEqual(encrypted, raw);
  const decrypted = decryptCode(encrypted);
  assert.equal(decrypted, raw);
  assert.equal(maskGiftCode(raw), '****-****-9876');
  assert.equal(hashCodeFingerprint(1, 'gplay-abcd'), hashCodeFingerprint(1, 'GPLAY-ABCD '));
});

test('scrypt password hashing and verification work properly', () => {
  const pass = 'StrongPass!2026';
  const hash = hashPassword(pass);
  assert.equal(verifyPassword(pass, hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
});
