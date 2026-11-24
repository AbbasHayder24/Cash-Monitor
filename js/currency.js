/* ==========================================================================
   FinFlow — Dynamic Multi-Currency Engine (Supports Custom Currencies)
   ========================================================================== */

const DEFAULT_EXCHANGE_RATES = { ...APP_CONFIG.defaultRates };
const DEFAULT_CURRENCIES = JSON.parse(JSON.stringify(APP_CONFIG.defaultCurrencies));

const CurrencyEngine = {
  getMeta(currencyCode, customCurrencies = null) {
    const pool = customCurrencies || DEFAULT_CURRENCIES;
    return pool[currencyCode] || DEFAULT_CURRENCIES[currencyCode] || DEFAULT_CURRENCIES.USD;
  },

  fromUSD(amountUSD, targetCurrency, rates) {
    const rate = rates[targetCurrency] || 1;
    return amountUSD * rate;
  },

  toUSD(localAmount, sourceCurrency, rates) {
    const rate = rates[sourceCurrency] || 1;
    return localAmount / rate;
  },

  format(amountUSD, currencyCode, rates, lang = "ar", customCurrencies = null) {
    const meta = this.getMeta(currencyCode, customCurrencies);
    const decimals = typeof meta.decimals === "number" ? meta.decimals : 2;
    const converted = this.fromUSD(amountUSD, currencyCode, rates);
    const formattedNum = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(decimals === 0 ? Math.round(converted) : converted);

    const symbol = lang === "ar" ? (meta.symbolAr || meta.code) : (meta.symbolEn || meta.code);
    if (currencyCode === "USD" || currencyCode === "EUR" || currencyCode === "GBP") {
      return `${symbol}${formattedNum}`;
    }
    return `${formattedNum} ${symbol}`;
  },

  formatLocalRaw(localAmount, currencyCode, lang = "ar", customCurrencies = null) {
    const meta = this.getMeta(currencyCode, customCurrencies);
    const decimals = typeof meta.decimals === "number" ? meta.decimals : 2;
    const formattedNum = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(decimals === 0 ? Math.round(localAmount) : localAmount);
    const symbol = lang === "ar" ? (meta.symbolAr || meta.code) : (meta.symbolEn || meta.code);
    return `${formattedNum} ${symbol}`;
  }
};
