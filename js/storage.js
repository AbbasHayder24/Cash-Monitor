/* ==========================================================================
   FinFlow — LocalStorage Persistence, Migration & State Builders
   ========================================================================== */

const STORAGE_KEY = APP_CONFIG.storageKey;

function getTodayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getDefaultState() {
  return {
    lang: APP_CONFIG.defaults.lang,
    theme: APP_CONFIG.defaults.theme,
    currency: APP_CONFIG.defaults.currency,
    brand: cloneObj(APP_CONFIG.brand),
    settings: {
      accentId: APP_CONFIG.defaults.accentId,
      customAccent: APP_CONFIG.defaults.customAccent,
      compactMode: APP_CONFIG.defaults.compactMode,
      warnThresholdPct: APP_CONFIG.defaults.warnThresholdPct,
      recentTxCount: APP_CONFIG.defaults.recentTxCount,
      budgetWatchCount: APP_CONFIG.defaults.budgetWatchCount,
      ruleSplit: cloneObj(APP_CONFIG.defaults.ruleSplit),
      widgets: cloneObj(APP_CONFIG.defaults.widgets)
    },
    rates: cloneObj(APP_CONFIG.defaultRates),
    currencies: cloneObj(APP_CONFIG.defaultCurrencies),
    categories: cloneObj(APP_CONFIG.defaultCategories),
    transactions: APP_CONFIG.sampleTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      title: tx.title,
      amountUSD: tx.amountUSD,
      category: tx.category,
      date: getTodayISO(tx.offsetDays || 0),
      note: tx.note || ""
    })),
    budgetsUSD: cloneObj(APP_CONFIG.defaultBudgetsUSD),
    goals: cloneObj(APP_CONFIG.defaultGoals)
  };
}

function getEmptyLedgerState(currentState) {
  const base = currentState ? cloneObj(currentState) : getDefaultState();
  base.transactions = [];
  base.goals = [];
  return base;
}

function mergeWithDefaults(parsed) {
  const def = getDefaultState();
  const merged = {
    ...def,
    ...parsed,
    brand: { ...def.brand, ...(parsed.brand || {}) },
    settings: {
      ...def.settings,
      ...(parsed.settings || {}),
      ruleSplit: { ...def.settings.ruleSplit, ...(parsed.settings?.ruleSplit || {}) },
      widgets: { ...def.settings.widgets, ...(parsed.settings?.widgets || {}) }
    },
    rates: { ...def.rates, ...(parsed.rates || {}) },
    currencies: { ...def.currencies, ...(parsed.currencies || {}) },
    budgetsUSD: { ...def.budgetsUSD, ...(parsed.budgetsUSD || {}) },
    categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : def.categories,
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : def.transactions,
    goals: Array.isArray(parsed.goals) ? parsed.goals : def.goals
  };
  return merged;
}

const StorageManager = {
  load() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      // Automatic seamless migration from v1 data if present
      if (!raw && APP_CONFIG.legacyStorageKey) {
        raw = localStorage.getItem(APP_CONFIG.legacyStorageKey);
      }
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    } catch (err) {
      console.warn("Storage fallback:", err);
      return getDefaultState();
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save state:", err);
    }
  }
};
