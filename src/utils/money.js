function trimOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveCurrencyMinorUnitFactor(currency) {
  const normalizedCurrency = trimOrEmpty(currency).toUpperCase() || 'EUR';

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return 10 ** fractionDigits;
  } catch {
    return 100;
  }
}

function roundMoney(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

function normalizeStoredPaymentAmount(value, currency) {
  const normalizedCurrency = trimOrEmpty(currency).toUpperCase() || 'EUR';
  const minorUnitFactor = resolveCurrencyMinorUnitFactor(normalizedCurrency);

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return 0;
    }

    if (/[.,]/.test(trimmedValue)) {
      const normalizedValue = Number(trimmedValue.replace(',', '.'));
      return Number.isFinite(normalizedValue) ? roundMoney(normalizedValue) : 0;
    }

    const parsedInteger = Number(trimmedValue);
    if (!Number.isFinite(parsedInteger)) {
      return 0;
    }

    return roundMoney(minorUnitFactor > 1 ? parsedInteger / minorUnitFactor : parsedInteger);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundMoney(Number.isInteger(value) && minorUnitFactor > 1 ? value / minorUnitFactor : value);
  }

  return 0;
}

module.exports = {
  resolveCurrencyMinorUnitFactor,
  normalizeStoredPaymentAmount,
  roundMoney,
};
