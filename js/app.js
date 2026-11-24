/* ==========================================================================
   FinFlow — Core Interactive Application Controller (With Debts & Installments)
   ========================================================================== */

(function () {
  let state = StorageManager.load();
  if (!Array.isArray(state.debts)) state.debts = [];
  let activePeriod = "all"; // "all" or "YYYY-MM"
  let toastTimer = null;

  /* ---------- Sync Built-in Currencies & Auto-Migrate IQD to Thousands Unit ---------- */
  function syncBuiltinCurrencies() {
    let changed = false;

    Object.keys(state.currencies || {}).forEach((code) => {
      if (state.currencies[code] && state.currencies[code].builtin && !APP_CONFIG.defaultCurrencies[code]) {
        delete state.currencies[code];
        delete state.rates[code];
        changed = true;
      }
    });

    Object.keys(APP_CONFIG.defaultCurrencies).forEach((code) => {
      const targetMeta = APP_CONFIG.defaultCurrencies[code];
      const currentMeta = state.currencies[code];
      if (
        !currentMeta ||
        currentMeta.symbolAr !== targetMeta.symbolAr ||
        currentMeta.decimals !== targetMeta.decimals ||
        JSON.stringify(currentMeta.stepPresets) !== JSON.stringify(targetMeta.stepPresets)
      ) {
        state.currencies[code] = JSON.parse(JSON.stringify(targetMeta));
        changed = true;
      }
    });

    if (typeof state.rates.IQD === "number" && state.rates.IQD >= 100) {
      state.rates.IQD = Number((state.rates.IQD / 1000).toFixed(4));
      changed = true;
    }

    if (!state.currencies[state.currency]) {
      state.currency = APP_CONFIG.defaults.currency || "IQD";
      changed = true;
    }
    if (changed) StorageManager.save(state);
  }
  syncBuiltinCurrencies();

  /* ---------- Utilities ---------- */
  function persistAndRender(toastKey = null) {
    StorageManager.save(state);
    renderAll();
    if (toastKey) showToast(toastKey);
  }

  function showToast(keyOrText) {
    const el = document.getElementById("toastNotification");
    if (!el) return;
    const dict = I18N[state.lang] || I18N.ar;
    el.textContent = dict[keyOrText] || keyOrText;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(amountUSD) {
    return CurrencyEngine.format(amountUSD, state.currency, state.rates, state.lang, state.currencies);
  }

  function getActiveSymbol() {
    const meta = CurrencyEngine.getMeta(state.currency, state.currencies);
    return state.lang === "ar" ? (meta.symbolAr || state.currency) : (meta.symbolEn || state.currency);
  }

  function toLocalInputVal(amountUSD) {
    const meta = CurrencyEngine.getMeta(state.currency, state.currencies);
    const local = CurrencyEngine.fromUSD(amountUSD, state.currency, state.rates);
    return meta.decimals === 0 ? Math.round(local) : Number(local.toFixed(meta.decimals));
  }

  function hexToRgba(hex, alpha) {
    const clean = (hex || "#b88e3c").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return `rgba(184, 142, 60, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function lightenHex(hex, amount = 45) {
    const clean = (hex || "#b88e3c").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    if (isNaN(num)) return "#d9b873";
    const r = Math.min(255, ((num >> 16) & 255) + amount);
    const g = Math.min(255, ((num >> 8) & 255) + amount);
    const b = Math.min(255, (num & 255) + amount);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function getCategoriesByType(type) {
    return (state.categories || []).filter((c) => c.type === type);
  }

  function findCategory(catId) {
    return (state.categories || []).find((c) => c.id === catId) || null;
  }

  function getCatDisplay(catId) {
    const cat = findCategory(catId);
    if (cat) return getCategoryLabel(cat, state.lang);
    return catId;
  }

  function getAvailableMonths() {
    const set = new Set();
    const currentYM = getTodayISO(0).slice(0, 7);
    set.add(currentYM);
    state.transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) set.add(tx.date.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  function getScopedTransactions() {
    if (activePeriod === "all") return state.transactions;
    return state.transactions.filter((tx) => (tx.date || "").startsWith(activePeriod));
  }

  /* ---------- Appearance & Theme Application ---------- */
  function applyVisualSettings() {
    document.documentElement.setAttribute("data-theme", state.theme);
    document.documentElement.setAttribute("data-compact", state.settings.compactMode ? "true" : "false");

    const preset = APP_CONFIG.accentPresets.find((p) => p.id === state.settings.accentId);
    const primary = preset ? preset.primary : (state.settings.customAccent || "#b88e3c");
    const light = preset ? preset.light : lightenHex(primary, 48);

    const root = document.documentElement.style;
    root.setProperty("--gold-primary", primary);
    root.setProperty("--gold-light", light);
    root.setProperty("--gold-glow", hexToRgba(primary, 0.25));
    root.setProperty("--glass-border-gold", hexToRgba(primary, 0.36));

    const w = state.settings.widgets || {};
    const toggleVis = (id, visible) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden-widget", visible === false);
    };
    toggleVis("widget-kpi", w.kpi);
    toggleVis("widget-quickAdd", w.quickAdd);
    toggleVis("widget-donut", w.donut);
    toggleVis("widget-recent", w.recent);
    toggleVis("widget-budgetWatch", w.budgetWatch);
  }

  /* ---------- Dynamic Selects (Currencies, Categories, Months) ---------- */
  function populateCurrencySelect() {
    const sel = document.getElementById("currencySelect");
    const currs = state.currencies || DEFAULT_CURRENCIES;
    sel.innerHTML = Object.values(currs)
      .map((c) => {
        const name = state.lang === "ar" ? (c.nameAr || c.nameEn || c.code) : (c.nameEn || c.nameAr || c.code);
        const sym = state.lang === "ar" ? (c.symbolAr || c.code) : (c.symbolEn || c.code);
        return `<option value="${escapeHTML(c.code)}">${escapeHTML(c.code)} — ${escapeHTML(sym)} (${escapeHTML(name)})</option>`;
      })
      .join("");
    if (!currs[state.currency]) state.currency = "IQD";
    sel.value = state.currency;
  }

  function populatePeriodSelects() {
    const dict = I18N[state.lang] || I18N.ar;
    const months = getAvailableMonths();
    const optionsHTML =
      `<option value="all">${dict.filterAllMonths}</option>` +
      months.map((m) => `<option value="${m}">${m}</option>`).join("");

    const ribbonSel = document.getElementById("periodSelect");
    ribbonSel.innerHTML = optionsHTML;
    ribbonSel.value = activePeriod;

    const txMonthSel = document.getElementById("txMonthFilter");
    const prevTxMonth = txMonthSel.value || "all";
    txMonthSel.innerHTML = optionsHTML;
    txMonthSel.value = months.includes(prevTxMonth) || prevTxMonth === "all" ? prevTxMonth : "all";
  }

  function populateCategorySelects() {
    const dict = I18N[state.lang] || I18N.ar;
    const txType = document.querySelector('input[name="txType"]:checked')?.value || "expense";
    const quickCat = document.getElementById("quickCategory");
    const prevQuick = quickCat.value;
    const activeCats = getCategoriesByType(txType);

    quickCat.innerHTML = activeCats
      .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(getCategoryLabel(c, state.lang))}</option>`)
      .join("");
    if (activeCats.some((c) => c.id === prevQuick)) quickCat.value = prevQuick;

    const filterCat = document.getElementById("txCategoryFilter");
    const prevFilter = filterCat.value || "all";
    filterCat.innerHTML =
      `<option value="all">${dict.filterAllCats}</option>` +
      state.categories
        .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(getCategoryLabel(c, state.lang))}</option>`)
        .join("");
    filterCat.value = state.categories.some((c) => c.id === prevFilter) ? prevFilter : "all";
  }

  function populateEditTxCategorySelect(type, selectedCatId) {
    const sel = document.getElementById("editTxCategory");
    const cats = getCategoriesByType(type);
    sel.innerHTML = cats
      .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(getCategoryLabel(c, state.lang))}</option>`)
      .join("");
    if (selectedCatId && cats.some((c) => c.id === selectedCatId)) {
      sel.value = selectedCatId;
    }
  }

  /* ---------- Header & Ribbon ---------- */
  function renderHeaderAndRibbon() {
    document.getElementById("themeIcon").textContent = state.theme === "dark" ? "☀" : "☾";

    const rateDisplay = document.getElementById("activeRateDisplay");
    const targetCode = state.currency === "USD" ? "IQD" : state.currency;
    const targetMeta = CurrencyEngine.getMeta(targetCode, state.currencies);
    const sym = state.lang === "ar" ? (targetMeta.symbolAr || targetCode) : (targetMeta.symbolEn || targetCode);
    const rateVal = state.rates[targetCode] || 1;
    rateDisplay.textContent = `1 USD = ${rateVal.toLocaleString()} ${sym}`;

    const dateEl = document.getElementById("currentDateDisplay");
    const locale = state.lang === "ar" ? "ar-IQ" : "en-US";
    dateEl.textContent = new Date().toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const dict = I18N[state.lang] || I18N.ar;
    const activeSym = getActiveSymbol();
    document.getElementById("quickAmountLabel").textContent = `${dict.amount} (${activeSym})`;
    const debtTotalLbl = document.getElementById("debtTotalLabel");
    if (debtTotalLbl) debtTotalLbl.textContent = `${dict.debtTotalLabel} (${activeSym})`;
  }

  /* ---------- Metrics Computation ---------- */
  function computeMetrics() {
    const scoped = getScopedTransactions();
    let totalIncomeUSD = 0;
    let totalExpenseUSD = 0;
    const expenseByCat = {};

    getCategoriesByType("expense").forEach((c) => (expenseByCat[c.id] = 0));

    scoped.forEach((tx) => {
      if (tx.type === "income") {
        totalIncomeUSD += tx.amountUSD;
      } else {
        totalExpenseUSD += tx.amountUSD;
        expenseByCat[tx.category] = (expenseByCat[tx.category] || 0) + tx.amountUSD;
      }
    });

    const netUSD = totalIncomeUSD - totalExpenseUSD;
    const savingsRate = totalIncomeUSD > 0 ? Math.max(0, Math.round((netUSD / totalIncomeUSD) * 100)) : 0;

    return { totalIncomeUSD, totalExpenseUSD, netUSD, savingsRate, expenseByCat, scoped };
  }

  /* ---------- Tab 1: Dashboard ---------- */
  function renderDashboard(metrics) {
    const dict = I18N[state.lang] || I18N.ar;
    document.getElementById("kpiNetBalance").textContent = formatMoney(metrics.netUSD);
    document.getElementById("kpiIncome").textContent = formatMoney(metrics.totalIncomeUSD);
    document.getElementById("kpiExpenses").textContent = formatMoney(metrics.totalExpenseUSD);
    document.getElementById("kpiSavingsRate").textContent = `${metrics.savingsRate}%`;

    renderExpenseDonut(document.getElementById("donutChartMount"), metrics.expenseByCat, state);

    const recentLimit = Math.max(1, Number(state.settings.recentTxCount) || 5);
    const recentContainer = document.getElementById("recentTransactionsList");
    const sorted = [...metrics.scoped].sort((a, b) => b.date.localeCompare(a.date)).slice(0, recentLimit);

    if (sorted.length === 0) {
      recentContainer.innerHTML = `<p class="muted-text">${dict.noTransactionsFound}</p>`;
    } else {
      recentContainer.innerHTML = sorted
        .map((tx) => {
          const sign = tx.type === "income" ? "+" : "-";
          const cls = tx.type === "income" ? "positive-text" : "negative-text";
          return `
            <div class="tx-item">
              <div class="tx-meta">
                <span class="tx-title">${escapeHTML(tx.title)}</span>
                <span class="tx-sub">${escapeHTML(getCatDisplay(tx.category))} • ${tx.date}</span>
                ${tx.note ? `<span class="tx-note-preview">${escapeHTML(tx.note)}</span>` : ""}
              </div>
              <div class="tx-right-cluster">
                <strong class="classical-num ${cls}">${sign}${formatMoney(tx.amountUSD)}</strong>
                <button type="button" class="edit-btn" data-edit-tx="${tx.id}" title="${dict.editBtn}">✎</button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    const watchLimit = Math.max(1, Number(state.settings.budgetWatchCount) || 4);
    const warnPct = Number(state.settings.warnThresholdPct) || 75;
    const watchContainer = document.getElementById("dashboardBudgetWatch");
    const expenseCats = getCategoriesByType("expense").slice(0, watchLimit);

    watchContainer.innerHTML = expenseCats
      .map((cat) => {
        const spent = metrics.expenseByCat[cat.id] || 0;
        const limit = state.budgetsUSD[cat.id] || 100;
        const rawPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        const pct = Math.min(100, rawPct);
        const barClass = rawPct >= 100 ? "status-over" : rawPct >= warnPct ? "status-warn" : "status-safe";
        return `
          <div class="budget-card">
            <div class="budget-top">
              <strong>${escapeHTML(getCategoryLabel(cat, state.lang))}</strong>
              <span class="classical-num">${rawPct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${barClass}" style="width:${pct}%"></div>
            </div>
            <div class="tx-sub classical-num">${dict.spentOf} ${formatMoney(spent)} ${dict.outOf} ${formatMoney(limit)}</div>
          </div>
        `;
      })
      .join("");
  }

  /* ---------- Tab 2: Transactions Table ---------- */
  function renderTransactionsTable() {
    const dict = I18N[state.lang] || I18N.ar;
    const q = document.getElementById("txSearchInput").value.trim().toLowerCase();
    const typeF = document.getElementById("txTypeFilter").value;
    const catF = document.getElementById("txCategoryFilter").value;
    const monthF = document.getElementById("txMonthFilter").value;

    const filtered = [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((tx) => {
        if (typeF !== "all" && tx.type !== typeF) return false;
        if (catF !== "all" && tx.category !== catF) return false;
        if (monthF !== "all" && !(tx.date || "").startsWith(monthF)) return false;
        if (q) {
          const hay = `${tx.title} ${tx.note || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    const tbody = document.getElementById("transactionsTableBody");
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">${dict.noTransactionsFound}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((tx) => {
        const isInc = tx.type === "income";
        const sign = isInc ? "+" : "-";
        const cls = isInc ? "positive-text" : "negative-text";
        const catObj = findCategory(tx.category);
        const dotColor = (catObj && catObj.color) || "var(--gold-primary)";
        return `
          <tr>
            <td class="classical-num">${escapeHTML(tx.date)}</td>
            <td>
              <strong>${escapeHTML(tx.title)}</strong>
              ${tx.note ? `<div class="tx-note-preview">${escapeHTML(tx.note)}</div>` : ""}
            </td>
            <td>
              <span class="cat-pill">
                <span class="cat-dot" style="background:${dotColor}"></span>
                ${escapeHTML(getCatDisplay(tx.category))}
              </span>
            </td>
            <td>${isInc ? dict.income : dict.expense}</td>
            <td class="classical-num ${cls}"><strong>${sign}${formatMoney(tx.amountUSD)}</strong></td>
            <td>
              <div class="row-actions">
                <button type="button" class="edit-btn" data-edit-tx="${tx.id}" title="${dict.editBtn}">✎</button>
                <button type="button" class="dup-btn" data-dup-tx="${tx.id}" title="${dict.duplicateBtn}">⧉</button>
                <button type="button" class="del-btn" data-delete-tx="${tx.id}" title="${dict.deleteBtn}">✕</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /* ---------- Tab 3: Budgets ---------- */
  function renderBudgets(metrics) {
    const dict = I18N[state.lang] || I18N.ar;
    const grid = document.getElementById("budgetsGrid");
    const warnPct = Number(state.settings.warnThresholdPct) || 75;
    const expenseCats = getCategoriesByType("expense");

    grid.innerHTML = expenseCats
      .map((cat) => {
        const spentUSD = metrics.expenseByCat[cat.id] || 0;
        const limitUSD = state.budgetsUSD[cat.id] || 100;
        const rawPct = limitUSD > 0 ? Math.round((spentUSD / limitUSD) * 100) : 0;
        const barWidth = Math.min(100, rawPct);
        const barClass = rawPct >= 100 ? "status-over" : rawPct >= warnPct ? "status-warn" : "status-safe";
        const inputVal = toLocalInputVal(limitUSD);

        return `
          <div class="budget-card">
            <div class="budget-top">
              <h3 class="classical-heading" style="font-size:1.06rem;">${escapeHTML(getCategoryLabel(cat, state.lang))}</h3>
              <span class="cat-pill classical-num">${rawPct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${barClass}" style="width:${barWidth}%"></div>
            </div>
            <div class="tx-sub classical-num">
              ${dict.spentOf} <strong>${formatMoney(spentUSD)}</strong> ${dict.outOf} <strong>${formatMoney(limitUSD)}</strong>
            </div>
            <div class="budget-limit-editor">
              <input type="number" step="any" min="0.01" value="${inputVal}" data-budget-input="${escapeHTML(cat.id)}" />
              <button type="button" class="chip-btn" data-save-budget="${escapeHTML(cat.id)}">${dict.updateLimit}</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /* ---------- Tab 4: Savings Goals ---------- */
  function renderSavingsGoals() {
    const dict = I18N[state.lang] || I18N.ar;
    const grid = document.getElementById("savingsGoalsGrid");
    const meta = CurrencyEngine.getMeta(state.currency, state.currencies);
    const presets = Array.isArray(meta.stepPresets) && meta.stepPresets.length ? meta.stepPresets : [10, 50];

    if (state.goals.length === 0) {
      grid.innerHTML = `<div class="glass-panel card-block"><p class="muted-text">${dict.noGoalsYet}</p></div>`;
      return;
    }

    grid.innerHTML = state.goals
      .map((g) => {
        const pct = g.targetUSD > 0 ? Math.min(100, Math.round((g.savedUSD / g.targetUSD) * 100)) : 0;
        const presetButtons = presets
          .map((amt) => {
            const label = CurrencyEngine.formatLocalRaw(amt, state.currency, state.lang, state.currencies);
            return `<button type="button" class="chip-btn" data-deposit-goal="${g.id}" data-deposit-local="${amt}">+${label}</button>`;
          })
          .join("");

        return `
          <article class="glass-panel goal-card">
            <div class="budget-top">
              <h3 class="classical-heading" style="font-size:1.1rem;">${escapeHTML(g.name)}</h3>
              <div class="row-actions">
                <button type="button" class="edit-btn" data-edit-goal="${g.id}" title="${dict.editBtn}">✎</button>
                <button type="button" class="del-btn" data-delete-goal="${g.id}" title="${dict.deleteBtn}">✕</button>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-fill status-safe" style="width:${pct}%"></div>
            </div>
            <div class="budget-top tx-sub classical-num">
              <span>${dict.savedLabel} <strong>${formatMoney(g.savedUSD)}</strong> (${pct}%)</span>
              <span>${dict.targetLabel} <strong>${formatMoney(g.targetUSD)}</strong></span>
            </div>
            <div class="goal-quick-actions">
              ${presetButtons}
            </div>
            <div class="budget-limit-editor">
              <input type="number" step="any" min="0.01" placeholder="${dict.customDepositPlaceholder}" data-custom-goal-input="${g.id}" />
              <button type="button" class="chip-btn" data-custom-goal-btn="${g.id}" data-goal-op="add">${dict.addBtn}</button>
              <button type="button" class="chip-btn chip-withdraw" data-custom-goal-btn="${g.id}" data-goal-op="sub">${dict.withdrawBtn}</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  /* ---------- Tab 5: Debts & Installments ---------- */
  function renderDebts() {
    const dict = I18N[state.lang] || I18N.ar;
    const list = state.debts || [];

    // Summary totals
    let oweRemainingUSD = 0;
    let owedRemainingUSD = 0;
    let activeInstallmentsUSD = 0;

    list.forEach((d) => {
      const rem = Math.max(0, (d.totalUSD || 0) - (d.paidUSD || 0));
      if (d.kind === "owed") {
        owedRemainingUSD += rem;
      } else {
        oweRemainingUSD += rem;
        if (rem > 0.0001 && d.installmentUSD > 0) {
          activeInstallmentsUSD += Math.min(rem, d.installmentUSD);
        }
      }
    });

    document.getElementById("debtTotalOwe").textContent = formatMoney(oweRemainingUSD);
    document.getElementById("debtTotalOwed").textContent = formatMoney(owedRemainingUSD);
    document.getElementById("debtTotalInstallments").textContent = formatMoney(activeInstallmentsUSD);

    const filter = document.getElementById("debtFilterSelect").value || "all";
    const filtered = list.filter((d) => {
      const rem = Math.max(0, (d.totalUSD || 0) - (d.paidUSD || 0));
      const settled = rem <= 0.0001;
      if (filter === "settled") return settled;
      if (filter === "all") return true;
      return d.kind === filter;
    });

    const grid = document.getElementById("debtsGrid");
    if (filtered.length === 0) {
      grid.innerHTML = `<p class="muted-text">${dict.noDebtsYet}</p>`;
      return;
    }

    grid.innerHTML = filtered
      .map((d) => {
        const total = d.totalUSD || 0;
        const paid = Math.min(total, Math.max(0, d.paidUSD || 0));
        const rem = Math.max(0, total - paid);
        const settled = rem <= 0.0001;
        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

        const kindMap = {
          owe: { label: dict.debtKindOwe, cls: "debt-badge-owe" },
          owed: { label: dict.debtKindOwed, cls: "debt-badge-owed" },
          installment: { label: dict.debtKindInstallment, cls: "debt-badge-installment" }
        };
        const km = kindMap[d.kind] || kindMap.owe;
        const barClass = settled ? "status-safe" : d.kind === "owed" ? "status-safe" : "status-warn";

        const instCountLeft = !settled && d.installmentUSD > 0 ? Math.ceil(rem / d.installmentUSD) : 0;
        const payInstBtn =
          !settled && d.installmentUSD > 0
            ? `<button type="button" class="chip-btn" data-pay-inst="${d.id}">${dict.debtPayInstBtn} (${formatMoney(Math.min(rem, d.installmentUSD))})</button>`
            : "";
        const settleAllBtn = !settled
          ? `<button type="button" class="chip-btn" data-settle-debt="${d.id}">${dict.debtSettleAllBtn}</button>`
          : "";

        return `
          <article class="budget-card">
            <div class="budget-top">
              <div class="chip-row">
                <span class="cat-pill ${km.cls}">${km.label}</span>
                ${settled ? `<span class="cat-pill debt-badge-settled">${dict.debtSettledBadge}</span>` : ""}
              </div>
              <div class="row-actions">
                <button type="button" class="edit-btn" data-edit-debt="${d.id}" title="${dict.editBtn}">✎</button>
                <button type="button" class="del-btn" data-delete-debt="${d.id}" title="${dict.deleteBtn}">✕</button>
              </div>
            </div>

            <h3 class="classical-heading" style="font-size:1.08rem;">${escapeHTML(d.title)}</h3>
            ${d.note ? `<div class="tx-note-preview">${escapeHTML(d.note)}</div>` : ""}

            <div class="progress-track">
              <div class="progress-fill ${barClass}" style="width:${pct}%"></div>
            </div>

            <div class="budget-top tx-sub classical-num">
              <span>${dict.debtPaidShort} <strong>${formatMoney(paid)}</strong> (${pct}%)</span>
              <span>${dict.debtRemainingShort} <strong>${formatMoney(rem)}</strong></span>
            </div>
            <div class="budget-top tx-sub classical-num">
              <span>${dict.debtTotalShort} <strong>${formatMoney(total)}</strong></span>
              ${d.dueDate ? `<span>${dict.debtDuePrefix} <strong>${escapeHTML(d.dueDate)}</strong></span>` : ""}
            </div>
            ${
              instCountLeft > 0
                ? `<div class="tx-sub classical-num">${dict.debtInstShort}: <strong>${formatMoney(d.installmentUSD)}</strong> • ${dict.debtInstRemaining} <strong>${instCountLeft}</strong></div>`
                : ""
            }

            <div class="goal-quick-actions">
              ${payInstBtn}
              ${settleAllBtn}
            </div>

            <div class="budget-limit-editor">
              <input type="number" step="any" min="0.01" placeholder="${dict.customDepositPlaceholder}" data-custom-debt-input="${d.id}" />
              <button type="button" class="chip-btn" data-custom-debt-btn="${d.id}" data-debt-op="add">${dict.debtPayBtn}</button>
              <button type="button" class="chip-btn chip-withdraw" data-custom-debt-btn="${d.id}" data-debt-op="sub">${dict.debtUndoBtn}</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  /* ---------- Tab 6: Editable Income Split Rule ---------- */
  function renderRuleSplit(metrics) {
    const dict = I18N[state.lang] || I18N.ar;
    const split = state.settings.ruleSplit || { needs: 50, wants: 30, savings: 20 };

    document.getElementById("ruleNeedsInput").value = split.needs;
    document.getElementById("ruleWantsInput").value = split.wants;
    document.getElementById("ruleSavingsInput").value = split.savings;
    updateRuleSumBadge();

    document.getElementById("rulePresetsBar").innerHTML = APP_CONFIG.rulePresets
      .map(
        (p) =>
          `<button type="button" class="chip-btn" data-rule-preset="${p.needs},${p.wants},${p.savings}">${p.label}</button>`
      )
      .join("");

    const income = metrics.totalIncomeUSD;
    const needsCats = getCategoriesByType("expense").filter((c) => c.bucket !== "wants");
    const wantsCats = getCategoriesByType("expense").filter((c) => c.bucket === "wants");

    const needsActual = needsCats.reduce((s, c) => s + (metrics.expenseByCat[c.id] || 0), 0);
    const wantsActual = wantsCats.reduce((s, c) => s + (metrics.expenseByCat[c.id] || 0), 0);
    const savingsActual = Math.max(0, metrics.netUSD);

    const buckets = [
      {
        title: `${dict.needsTitle} (${split.needs}%)`,
        desc: dict.needsDesc,
        targetPct: split.needs / 100,
        actualUSD: needsActual,
        cats: needsCats
      },
      {
        title: `${dict.wantsTitle} (${split.wants}%)`,
        desc: dict.wantsDesc,
        targetPct: split.wants / 100,
        actualUSD: wantsActual,
        cats: wantsCats
      },
      {
        title: `${dict.savingsBucketTitle} (${split.savings}%)`,
        desc: dict.savingsBucketDesc,
        targetPct: split.savings / 100,
        actualUSD: savingsActual,
        cats: []
      }
    ];

    document.getElementById("rule503020Container").innerHTML = buckets
      .map((b) => {
        const targetUSD = income * b.targetPct;
        const actualPctOfIncome = income > 0 ? Math.round((b.actualUSD / income) * 100) : 0;
        const fillWidth = targetUSD > 0 ? Math.min(100, Math.round((b.actualUSD / targetUSD) * 100)) : 0;
        const catBadges = b.cats.length
          ? `<div class="chip-row">${b.cats
              .map(
                (c) =>
                  `<span class="cat-pill"><span class="cat-dot" style="background:${c.color}"></span>${escapeHTML(getCategoryLabel(c, state.lang))}</span>`
              )
              .join("")}</div>`
          : "";

        return `
          <div class="rule-bucket">
            <span class="rule-pct-badge classical-num">${actualPctOfIncome}% / ${Math.round(b.targetPct * 100)}%</span>
            <h3 class="classical-heading" style="font-size:1.1rem;">${b.title}</h3>
            <p class="section-desc">${b.desc}</p>
            <div class="progress-track">
              <div class="progress-fill status-safe" style="width:${fillWidth}%"></div>
            </div>
            <div class="tx-sub classical-num">
              <div>${dict.recommended} <strong>${formatMoney(targetUSD)}</strong></div>
              <div>${dict.actual} <strong>${formatMoney(b.actualUSD)}</strong></div>
            </div>
            ${catBadges}
          </div>
        `;
      })
      .join("");
  }

  function updateRuleSumBadge() {
    const n = Number(document.getElementById("ruleNeedsInput").value) || 0;
    const w = Number(document.getElementById("ruleWantsInput").value) || 0;
    const s = Number(document.getElementById("ruleSavingsInput").value) || 0;
    const sum = n + w + s;
    const badge = document.getElementById("ruleSumBadge");
    const dict = I18N[state.lang] || I18N.ar;
    badge.textContent = `${dict.ruleSumLabel} ${sum}%`;
    badge.style.color = sum === 100 ? "var(--emerald)" : "var(--crimson)";
  }

  /* ---------- Tab 7: Customize Studio ---------- */
  function renderCustomizeTab() {
    const dict = I18N[state.lang] || I18N.ar;

    document.getElementById("brandNameInput").value = state.brand.name || "FinFlow";
    document.getElementById("brandEmblemInput").value = state.brand.emblem || "FF";
    document.getElementById("brandSubArInput").value = state.brand.subtitleAr || "";
    document.getElementById("brandSubEnInput").value = state.brand.subtitleEn || "";
    document.getElementById("customAccentPicker").value = state.settings.customAccent || "#b88e3c";
    document.getElementById("compactModeToggle").checked = Boolean(state.settings.compactMode);

    document.getElementById("accentSwatches").innerHTML = APP_CONFIG.accentPresets
      .map((p) => {
        const active = state.settings.accentId === p.id ? "active" : "";
        const label = state.lang === "ar" ? p.nameAr : p.nameEn;
        return `<button type="button" class="accent-swatch ${active}" data-accent-preset="${p.id}" style="background:${p.primary}" title="${escapeHTML(label)}"></button>`;
      })
      .join("");

    const w = state.settings.widgets || {};
    document.getElementById("toggleWidgetKpi").checked = w.kpi !== false;
    document.getElementById("toggleWidgetQuickAdd").checked = w.quickAdd !== false;
    document.getElementById("toggleWidgetDonut").checked = w.donut !== false;
    document.getElementById("toggleWidgetRecent").checked = w.recent !== false;
    document.getElementById("toggleWidgetBudgetWatch").checked = w.budgetWatch !== false;
    document.getElementById("warnThresholdInput").value = state.settings.warnThresholdPct || 75;
    document.getElementById("recentCountInput").value = state.settings.recentTxCount || 5;
    document.getElementById("budgetWatchCountInput").value = state.settings.budgetWatchCount || 4;

    document.getElementById("categoriesManageList").innerHTML = state.categories
      .map((c) => {
        const typeLabel = c.type === "income" ? dict.income : dict.expense;
        const bucketLabel =
          c.type === "income"
            ? ""
            : c.bucket === "wants"
            ? ` • ${dict.bucketWants}`
            : ` • ${dict.bucketNeeds}`;
        return `
          <div class="manage-cat-card">
            <div class="manage-cat-info">
              <div class="manage-cat-badge" style="background:${c.color}">${escapeHTML(c.icon || "•")}</div>
              <div class="tx-meta">
                <span class="tx-title">${escapeHTML(state.lang === "ar" ? c.nameAr : c.nameEn)}</span>
                <span class="tx-sub">${typeLabel}${bucketLabel}</span>
              </div>
            </div>
            <div class="row-actions">
              <button type="button" class="edit-btn" data-edit-cat="${escapeHTML(c.id)}" title="${dict.editBtn}">✎</button>
              <button type="button" class="del-btn" data-delete-cat="${escapeHTML(c.id)}" title="${dict.deleteBtn}">✕</button>
            </div>
          </div>
        `;
      })
      .join("");

    const customCurrs = Object.values(state.currencies || {}).filter((c) => !c.builtin);
    document.getElementById("customCurrenciesList").innerHTML = customCurrs
      .map(
        (c) => `
        <span class="cat-pill">
          ${escapeHTML(c.code)} (${escapeHTML(c.symbolAr)}) • 1 USD = ${state.rates[c.code] || 1}
          <button type="button" class="icon-btn-subtle" data-delete-curr="${escapeHTML(c.code)}" title="${dict.deleteBtn}">✕</button>
        </span>
      `
      )
      .join("");
  }

  /* ---------- Master Render ---------- */
  function renderAll() {
    applyVisualSettings();
    applyLanguage(state.lang, state.brand);
    populateCurrencySelect();
    populatePeriodSelects();
    renderHeaderAndRibbon();
    populateCategorySelects();
    const metrics = computeMetrics();
    renderDashboard(metrics);
    renderTransactionsTable();
    renderBudgets(metrics);
    renderSavingsGoals();
    renderDebts();
    renderRuleSplit(metrics);
    renderCustomizeTab();
  }

  /* ---------- Modals ---------- */
  function switchTab(tabId) {
    document.querySelectorAll(".nav-pill").forEach((btn) => {
      const active = btn.getAttribute("data-tab") === tabId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".tab-view").forEach((view) => {
      view.classList.toggle("active", view.id === `tab-${tabId}`);
    });
  }

  function openRateModal() {
    const list = document.getElementById("rateInputsList");
    const currs = state.currencies || DEFAULT_CURRENCIES;
    list.innerHTML = Object.keys(currs)
      .filter((code) => code !== "USD")
      .map((code) => {
        const meta = currs[code];
        const sym = state.lang === "ar" ? (meta.symbolAr || code) : (meta.symbolEn || code);
        const val = state.rates[code] || 1;
        return `
          <div class="field-group">
            <label for="rate_${escapeHTML(code)}">1 USD → ${escapeHTML(code)} (${escapeHTML(sym)})</label>
            <input type="number" id="rate_${escapeHTML(code)}" name="${escapeHTML(code)}" step="any" min="0.0001" value="${val}" required />
          </div>
        `;
      })
      .join("");
    document.getElementById("rateModal").classList.remove("hidden");
  }

  function openEditTxModal(txId) {
    const tx = state.transactions.find((t) => t.id === txId);
    if (!tx) return;
    const dict = I18N[state.lang] || I18N.ar;
    const activeSym = getActiveSymbol();
    document.getElementById("editTxId").value = tx.id;
    document.getElementById("editTxType").value = tx.type;
    document.getElementById("editTxDate").value = tx.date;
    document.getElementById("editTxTitle").value = tx.title;
    document.getElementById("editTxAmount").value = toLocalInputVal(tx.amountUSD);
    document.getElementById("editTxAmountLabel").textContent = `${dict.amount} (${activeSym})`;
    document.getElementById("editTxNote").value = tx.note || "";
    populateEditTxCategorySelect(tx.type, tx.category);
    document.getElementById("editTxModal").classList.remove("hidden");
  }

  function openEditGoalModal(goalId) {
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;
    const dict = I18N[state.lang] || I18N.ar;
    const activeSym = getActiveSymbol();
    document.getElementById("editGoalId").value = goal.id;
    document.getElementById("editGoalName").value = goal.name;
    document.getElementById("editGoalTarget").value = toLocalInputVal(goal.targetUSD);
    document.getElementById("editGoalSaved").value = toLocalInputVal(goal.savedUSD);
    document.getElementById("editGoalTargetLabel").textContent = `${dict.targetAmount} (${activeSym})`;
    document.getElementById("editGoalSavedLabel").textContent = `${dict.currentSavedLabel} (${activeSym})`;
    document.getElementById("editGoalModal").classList.remove("hidden");
  }

  function openEditDebtModal(debtId) {
    const d = (state.debts || []).find((x) => x.id === debtId);
    if (!d) return;
    const dict = I18N[state.lang] || I18N.ar;
    const activeSym = getActiveSymbol();
    document.getElementById("editDebtId").value = d.id;
    document.getElementById("editDebtKind").value = d.kind || "owe";
    document.getElementById("editDebtDue").value = d.dueDate || "";
    document.getElementById("editDebtTitle").value = d.title || "";
    document.getElementById("editDebtTotal").value = toLocalInputVal(d.totalUSD || 0);
    document.getElementById("editDebtPaid").value = toLocalInputVal(d.paidUSD || 0);
    document.getElementById("editDebtInst").value = d.installmentUSD > 0 ? toLocalInputVal(d.installmentUSD) : "";
    document.getElementById("editDebtNote").value = d.note || "";
    document.getElementById("editDebtTotalLabel").textContent = `${dict.debtTotalLabel} (${activeSym})`;
    document.getElementById("editDebtPaidLabel").textContent = `${dict.debtPaidShort} (${activeSym})`;
    document.getElementById("editDebtInstLabel").textContent = `${dict.debtInstShort} (${activeSym})`;
    document.getElementById("editDebtModal").classList.remove("hidden");
  }

  function openEditCatModal(catId) {
    const cat = findCategory(catId);
    if (!cat) return;
    document.getElementById("editCatId").value = cat.id;
    document.getElementById("editCatNameAr").value = cat.nameAr || "";
    document.getElementById("editCatNameEn").value = cat.nameEn || "";
    document.getElementById("editCatIcon").value = cat.icon || "📌";
    document.getElementById("editCatColor").value = cat.color || "#b88e3c";
    document.getElementById("editCatType").value = cat.type || "expense";
    document.getElementById("editCatBucket").value = cat.type === "income" ? "none" : (cat.bucket || "needs");
    document.getElementById("editCatModal").classList.remove("hidden");
  }

  /* ---------- Inline Two-Tap Confirmation Helper ---------- */
  function requireInlineConfirm(buttonEl) {
    if (buttonEl.dataset.confirmArmed === "true") {
      buttonEl.dataset.confirmArmed = "false";
      return true;
    }
    const originalText = buttonEl.textContent;
    buttonEl.dataset.confirmArmed = "true";
    buttonEl.textContent = state.lang === "ar" ? "اضغط مرة أخرى للتأكيد" : "Tap again to confirm";
    setTimeout(() => {
      if (buttonEl.dataset.confirmArmed === "true") {
        buttonEl.dataset.confirmArmed = "false";
        buttonEl.textContent = originalText;
      }
    }, 3500);
    return false;
  }

  /* ---------- Data Actions (JSON / CSV / Clear / Reset) ---------- */
  function handleDataAction(action, buttonEl) {
    if (action === "exportJson") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      downloadBlob(blob, `FinFlow-Backup-${getTodayISO(0)}.json`);
    } else if (action === "exportCsv") {
      const headers = ["Date", "Title", "Type", "Category", `Amount (${state.currency})`, "Amount (USD)", "Note"];
      const rows = state.transactions.map((tx) => {
        const localAmt = toLocalInputVal(tx.amountUSD);
        return [
          tx.date,
          tx.title,
          tx.type,
          getCatDisplay(tx.category),
          localAmt,
          Number(tx.amountUSD.toFixed(2)),
          tx.note || ""
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",");
      });
      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `FinFlow-Ledger-${getTodayISO(0)}.csv`);
    } else if (action === "clearLedger") {
      if (buttonEl && !requireInlineConfirm(buttonEl)) return;
      state = getEmptyLedgerState(state);
      document.getElementById("backupModal").classList.add("hidden");
      persistAndRender("toastCleared");
    } else if (action === "resetDemo") {
      if (buttonEl && !requireInlineConfirm(buttonEl)) return;
      state = getDefaultState();
      activePeriod = "all";
      document.getElementById("backupModal").classList.add("hidden");
      persistAndRender("toastSaved");
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Event Bindings ---------- */
  function bindEvents() {
    document.getElementById("quickDate").value = getTodayISO(0);

    document.querySelectorAll(".nav-pill").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });
    document.querySelectorAll("[data-jump-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-jump-tab")));
    });

    document.getElementById("periodSelect").addEventListener("change", (e) => {
      activePeriod = e.target.value;
      renderAll();
    });

    document.getElementById("currencySelect").addEventListener("change", (e) => {
      state.currency = e.target.value;
      persistAndRender();
    });
    document.getElementById("langToggleBtn").addEventListener("click", () => {
      state.lang = state.lang === "ar" ? "en" : "ar";
      persistAndRender();
    });
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      persistAndRender();
    });

    document.querySelectorAll('input[name="txType"]').forEach((radio) => {
      radio.addEventListener("change", populateCategorySelects);
    });

    document.getElementById("quickTxForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="txType"]:checked').value;
      const title = document.getElementById("quickTitle").value.trim();
      const localAmount = parseFloat(document.getElementById("quickAmount").value);
      const category = document.getElementById("quickCategory").value;
      const date = document.getElementById("quickDate").value;
      const note = document.getElementById("quickNote").value.trim();

      if (!title || isNaN(localAmount) || localAmount <= 0) return;

      state.transactions.unshift({
        id: "tx-" + Date.now(),
        type,
        title,
        amountUSD: CurrencyEngine.toUSD(localAmount, state.currency, state.rates),
        category,
        date,
        note
      });

      document.getElementById("quickTitle").value = "";
      document.getElementById("quickAmount").value = "";
      document.getElementById("quickNote").value = "";
      persistAndRender("toastAdded");
    });

    ["txSearchInput", "txTypeFilter", "txCategoryFilter", "txMonthFilter"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderTransactionsTable);
      document.getElementById(id).addEventListener("change", renderTransactionsTable);
    });

    document.getElementById("debtFilterSelect").addEventListener("change", renderDebts);

    document.getElementById("newDebtForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const kind = document.getElementById("debtKindInput").value;
      const title = document.getElementById("debtTitleInput").value.trim();
      const totalLocal = parseFloat(document.getElementById("debtTotalInput").value);
      const paidLocal = parseFloat(document.getElementById("debtPaidInput").value) || 0;
      const instLocal = parseFloat(document.getElementById("debtInstInput").value) || 0;
      const dueDate = document.getElementById("debtDueInput").value || "";
      const note = document.getElementById("debtNoteInput").value.trim();

      if (!title || isNaN(totalLocal) || totalLocal <= 0) return;

      state.debts.unshift({
        id: "debt-" + Date.now(),
        kind,
        title,
        totalUSD: CurrencyEngine.toUSD(totalLocal, state.currency, state.rates),
        paidUSD: CurrencyEngine.toUSD(Math.max(0, paidLocal), state.currency, state.rates),
        installmentUSD: instLocal > 0 ? CurrencyEngine.toUSD(instLocal, state.currency, state.rates) : 0,
        dueDate,
        note
      });

      e.target.reset();
      document.getElementById("debtPaidInput").value = "0";
      persistAndRender("toastAdded");
    });

    document.getElementById("editDebtForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("editDebtId").value;
      const d = (state.debts || []).find((x) => x.id === id);
      const totalLocal = parseFloat(document.getElementById("editDebtTotal").value);
      const paidLocal = parseFloat(document.getElementById("editDebtPaid").value);
      const instLocal = parseFloat(document.getElementById("editDebtInst").value) || 0;
      if (!d || isNaN(totalLocal) || totalLocal <= 0 || isNaN(paidLocal) || paidLocal < 0) return;

      d.kind = document.getElementById("editDebtKind").value;
      d.dueDate = document.getElementById("editDebtDue").value || "";
      d.title = document.getElementById("editDebtTitle").value.trim();
      d.totalUSD = CurrencyEngine.toUSD(totalLocal, state.currency, state.rates);
      d.paidUSD = CurrencyEngine.toUSD(Math.max(0, paidLocal), state.currency, state.rates);
      d.installmentUSD = instLocal > 0 ? CurrencyEngine.toUSD(instLocal, state.currency, state.rates) : 0;
      d.note = document.getElementById("editDebtNote").value.trim();

      document.getElementById("editDebtModal").classList.add("hidden");
      persistAndRender("toastSaved");
    });

    document.getElementById("editTxType").addEventListener("change", (e) => {
      populateEditTxCategorySelect(e.target.value, null);
    });

    document.getElementById("editTxForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("editTxId").value;
      const tx = state.transactions.find((t) => t.id === id);
      const localAmt = parseFloat(document.getElementById("editTxAmount").value);
      if (!tx || isNaN(localAmt) || localAmt <= 0) return;

      tx.type = document.getElementById("editTxType").value;
      tx.date = document.getElementById("editTxDate").value;
      tx.title = document.getElementById("editTxTitle").value.trim();
      tx.amountUSD = CurrencyEngine.toUSD(localAmt, state.currency, state.rates);
      tx.category = document.getElementById("editTxCategory").value;
      tx.note = document.getElementById("editTxNote").value.trim();

      document.getElementById("editTxModal").classList.add("hidden");
      persistAndRender("toastSaved");
    });

    document.getElementById("editGoalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("editGoalId").value;
      const goal = state.goals.find((g) => g.id === id);
      const targetLocal = parseFloat(document.getElementById("editGoalTarget").value);
      const savedLocal = parseFloat(document.getElementById("editGoalSaved").value);
      if (!goal || isNaN(targetLocal) || targetLocal <= 0 || isNaN(savedLocal) || savedLocal < 0) return;

      goal.name = document.getElementById("editGoalName").value.trim();
      goal.targetUSD = CurrencyEngine.toUSD(targetLocal, state.currency, state.rates);
      goal.savedUSD = CurrencyEngine.toUSD(savedLocal, state.currency, state.rates);

      document.getElementById("editGoalModal").classList.add("hidden");
      persistAndRender("toastSaved");
    });

    document.getElementById("editCatForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("editCatId").value;
      const cat = findCategory(id);
      if (!cat) return;

      cat.nameAr = document.getElementById("editCatNameAr").value.trim() || cat.nameAr;
      cat.nameEn = document.getElementById("editCatNameEn").value.trim() || cat.nameEn;
      cat.icon = document.getElementById("editCatIcon").value.trim() || "📌";
      cat.color = document.getElementById("editCatColor").value || "#b88e3c";
      cat.type = document.getElementById("editCatType").value;
      cat.bucket = cat.type === "income" ? "none" : document.getElementById("editCatBucket").value;

      document.getElementById("editCatModal").classList.add("hidden");
      persistAndRender("toastSaved");
    });

    document.getElementById("newGoalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("goalNameInput").value.trim();
      const targetLocal = parseFloat(document.getElementById("goalTargetInput").value);
      const initialLocal = parseFloat(document.getElementById("goalInitialInput").value) || 0;
      if (!name || isNaN(targetLocal) || targetLocal <= 0) return;

      state.goals.push({
        id: "g-" + Date.now(),
        name,
        targetUSD: CurrencyEngine.toUSD(targetLocal, state.currency, state.rates),
        savedUSD: CurrencyEngine.toUSD(Math.max(0, initialLocal), state.currency, state.rates)
      });

      e.target.reset();
      document.getElementById("goalInitialInput").value = "0";
      persistAndRender("toastAdded");
    });

    ["ruleNeedsInput", "ruleWantsInput", "ruleSavingsInput"].forEach((id) => {
      document.getElementById(id).addEventListener("input", updateRuleSumBadge);
    });
    document.getElementById("ruleSplitForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const needs = Number(document.getElementById("ruleNeedsInput").value) || 0;
      const wants = Number(document.getElementById("ruleWantsInput").value) || 0;
      const savings = Number(document.getElementById("ruleSavingsInput").value) || 0;
      if (needs + wants + savings !== 100) {
        showToast("ruleSumError");
        return;
      }
      state.settings.ruleSplit = { needs, wants, savings };
      persistAndRender("toastSaved");
    });

    document.getElementById("customAccentPicker").addEventListener("input", (e) => {
      state.settings.accentId = "custom";
      state.settings.customAccent = e.target.value;
      applyVisualSettings();
    });
    document.getElementById("brandForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.brand.name = document.getElementById("brandNameInput").value.trim() || "FinFlow";
      state.brand.emblem = document.getElementById("brandEmblemInput").value.trim().toUpperCase() || "FF";
      state.brand.subtitleAr = document.getElementById("brandSubArInput").value.trim();
      state.brand.subtitleEn = document.getElementById("brandSubEnInput").value.trim();
      state.settings.compactMode = document.getElementById("compactModeToggle").checked;
      persistAndRender("toastSaved");
    });

    document.getElementById("layoutForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.settings.widgets = {
        kpi: document.getElementById("toggleWidgetKpi").checked,
        quickAdd: document.getElementById("toggleWidgetQuickAdd").checked,
        donut: document.getElementById("toggleWidgetDonut").checked,
        recent: document.getElementById("toggleWidgetRecent").checked,
        budgetWatch: document.getElementById("toggleWidgetBudgetWatch").checked
      };
      state.settings.warnThresholdPct = Math.min(99, Math.max(30, Number(document.getElementById("warnThresholdInput").value) || 75));
      state.settings.recentTxCount = Math.min(20, Math.max(1, Number(document.getElementById("recentCountInput").value) || 5));
      state.settings.budgetWatchCount = Math.min(12, Math.max(1, Number(document.getElementById("budgetWatchCountInput").value) || 4));
      persistAndRender("toastSaved");
    });

    document.getElementById("addCategoryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const nameAr = document.getElementById("newCatNameAr").value.trim();
      const nameEn = document.getElementById("newCatNameEn").value.trim();
      const icon = document.getElementById("newCatIcon").value.trim() || "📌";
      const color = document.getElementById("newCatColor").value || "#23487a";
      const type = document.getElementById("newCatType").value;
      const bucket = type === "income" ? "none" : document.getElementById("newCatBucket").value;

      if (!nameAr && !nameEn) return;
      const id = "cat-" + Date.now();
      state.categories.push({ id, type, bucket, icon, color, nameAr: nameAr || nameEn, nameEn: nameEn || nameAr });
      if (type === "expense") state.budgetsUSD[id] = 100;

      e.target.reset();
      document.getElementById("newCatIcon").value = "📌";
      document.getElementById("newCatColor").value = "#23487a";
      persistAndRender("toastAdded");
    });

    document.getElementById("addCurrencyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const code = document.getElementById("newCurrCode").value.trim().toUpperCase();
      const symbol = document.getElementById("newCurrSymbol").value.trim() || code;
      const name = document.getElementById("newCurrName").value.trim() || code;
      const rate = parseFloat(document.getElementById("newCurrRate").value);
      const decimals = parseInt(document.getElementById("newCurrDecimals").value, 10);

      if (!/^[A-Z]{2,4}$/.test(code) || isNaN(rate) || rate <= 0) {
        showToast("invalidCurrencyMsg");
        return;
      }

      const stepBase = decimals === 0 ? [Math.round(rate * 10), Math.round(rate * 50)] : [25, 100];
      state.currencies[code] = {
        code,
        nameAr: name,
        nameEn: name,
        symbolAr: symbol,
        symbolEn: symbol,
        decimals,
        stepPresets: stepBase,
        builtin: false
      };
      state.rates[code] = rate;
      e.target.reset();
      persistAndRender("toastAdded");
    });

    document.getElementById("openRateModalBtn").addEventListener("click", openRateModal);
    document.getElementById("customizeOpenRatesBtn").addEventListener("click", openRateModal);
    document.getElementById("exchangeRateForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      for (const [code, val] of formData.entries()) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) state.rates[code] = num;
      }
      document.getElementById("rateModal").classList.add("hidden");
      persistAndRender("toastSaved");
    });
    document.getElementById("resetRatesBtn").addEventListener("click", () => {
      state.rates = { ...state.rates, ...DEFAULT_EXCHANGE_RATES };
      openRateModal();
      persistAndRender("toastSaved");
    });

    document.getElementById("openBackupModalBtn").addEventListener("click", () => {
      document.getElementById("backupModal").classList.remove("hidden");
    });
    document.querySelectorAll(".import-json-trigger").forEach((input) => {
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (imported && Array.isArray(imported.transactions)) {
              state = mergeWithDefaults(imported);
              syncBuiltinCurrencies();
              document.getElementById("backupModal").classList.add("hidden");
              persistAndRender("toastImported");
            } else {
              showToast("invalidJsonMsg");
            }
          } catch (err) {
            showToast("invalidJsonMsg");
          }
          e.target.value = "";
        };
        reader.readAsText(file);
      });
    });

    document.body.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      const editTxId = target.getAttribute("data-edit-tx");
      if (editTxId) {
        openEditTxModal(editTxId);
        return;
      }

      const dupTxId = target.getAttribute("data-dup-tx");
      if (dupTxId) {
        const orig = state.transactions.find((t) => t.id === dupTxId);
        if (orig) {
          state.transactions.unshift({ ...orig, id: "tx-" + Date.now(), date: getTodayISO(0) });
          persistAndRender("toastAdded");
        }
        return;
      }

      const delTxId = target.getAttribute("data-delete-tx");
      if (delTxId) {
        state.transactions = state.transactions.filter((t) => t.id !== delTxId);
        persistAndRender("toastDeleted");
        return;
      }

      const saveBudgetCat = target.getAttribute("data-save-budget");
      if (saveBudgetCat) {
        const input = document.querySelector(`[data-budget-input="${saveBudgetCat}"]`);
        const localVal = parseFloat(input.value);
        if (!isNaN(localVal) && localVal > 0) {
          state.budgetsUSD[saveBudgetCat] = CurrencyEngine.toUSD(localVal, state.currency, state.rates);
          persistAndRender("toastSaved");
        }
        return;
      }

      const depGoalId = target.getAttribute("data-deposit-goal");
      if (depGoalId) {
        const localAmt = parseFloat(target.getAttribute("data-deposit-local"));
        const goal = state.goals.find((g) => g.id === depGoalId);
        if (goal && !isNaN(localAmt)) {
          goal.savedUSD += CurrencyEngine.toUSD(localAmt, state.currency, state.rates);
          persistAndRender("toastSaved");
        }
        return;
      }

      const customGoalBtnId = target.getAttribute("data-custom-goal-btn");
      if (customGoalBtnId) {
        const input = document.querySelector(`[data-custom-goal-input="${customGoalBtnId}"]`);
        const op = target.getAttribute("data-goal-op") || "add";
        const localAmt = parseFloat(input.value);
        const goal = state.goals.find((g) => g.id === customGoalBtnId);
        if (goal && !isNaN(localAmt) && localAmt > 0) {
          const deltaUSD = CurrencyEngine.toUSD(localAmt, state.currency, state.rates);
          goal.savedUSD = op === "sub" ? Math.max(0, goal.savedUSD - deltaUSD) : goal.savedUSD + deltaUSD;
          persistAndRender("toastSaved");
        }
        return;
      }

      const editGoalId = target.getAttribute("data-edit-goal");
      if (editGoalId) {
        openEditGoalModal(editGoalId);
        return;
      }

      const delGoalId = target.getAttribute("data-delete-goal");
      if (delGoalId) {
        state.goals = state.goals.filter((g) => g.id !== delGoalId);
        persistAndRender("toastDeleted");
        return;
      }

      // Debts & Installments actions
      const payInstId = target.getAttribute("data-pay-inst");
      if (payInstId) {
        const d = state.debts.find((x) => x.id === payInstId);
        if (d && d.installmentUSD > 0) {
          d.paidUSD = Math.min(d.totalUSD, (d.paidUSD || 0) + d.installmentUSD);
          persistAndRender("toastSaved");
        }
        return;
      }

      const settleDebtId = target.getAttribute("data-settle-debt");
      if (settleDebtId) {
        const d = state.debts.find((x) => x.id === settleDebtId);
        if (d) {
          d.paidUSD = d.totalUSD;
          persistAndRender("toastSaved");
        }
        return;
      }

      const customDebtBtnId = target.getAttribute("data-custom-debt-btn");
      if (customDebtBtnId) {
        const input = document.querySelector(`[data-custom-debt-input="${customDebtBtnId}"]`);
        const op = target.getAttribute("data-debt-op") || "add";
        const localAmt = parseFloat(input.value);
        const d = state.debts.find((x) => x.id === customDebtBtnId);
        if (d && !isNaN(localAmt) && localAmt > 0) {
          const deltaUSD = CurrencyEngine.toUSD(localAmt, state.currency, state.rates);
          d.paidUSD = op === "sub" ? Math.max(0, (d.paidUSD || 0) - deltaUSD) : Math.min(d.totalUSD, (d.paidUSD || 0) + deltaUSD);
          persistAndRender("toastSaved");
        }
        return;
      }

      const editDebtId = target.getAttribute("data-edit-debt");
      if (editDebtId) {
        openEditDebtModal(editDebtId);
        return;
      }

      const delDebtId = target.getAttribute("data-delete-debt");
      if (delDebtId) {
        state.debts = state.debts.filter((x) => x.id !== delDebtId);
        persistAndRender("toastDeleted");
        return;
      }

      const rulePreset = target.getAttribute("data-rule-preset");
      if (rulePreset) {
        const [n, w, s] = rulePreset.split(",").map(Number);
        state.settings.ruleSplit = { needs: n, wants: w, savings: s };
        persistAndRender("toastSaved");
        return;
      }

      const accentPreset = target.getAttribute("data-accent-preset");
      if (accentPreset) {
        state.settings.accentId = accentPreset;
        persistAndRender("toastSaved");
        return;
      }

      const editCatId = target.getAttribute("data-edit-cat");
      if (editCatId) {
        openEditCatModal(editCatId);
        return;
      }

      const delCatId = target.getAttribute("data-delete-cat");
      if (delCatId) {
        state.categories = state.categories.filter((c) => c.id !== delCatId);
        delete state.budgetsUSD[delCatId];
        persistAndRender("toastDeleted");
        return;
      }

      const delCurrCode = target.getAttribute("data-delete-curr");
      if (delCurrCode) {
        delete state.currencies[delCurrCode];
        delete state.rates[delCurrCode];
        if (state.currency === delCurrCode) state.currency = "IQD";
        persistAndRender("toastDeleted");
        return;
      }

      const dataAction = target.getAttribute("data-data-action");
      if (dataAction) {
        handleDataAction(dataAction, target);
        return;
      }

      const closeModalId = target.getAttribute("data-close-modal");
      if (closeModalId) {
        document.getElementById(closeModalId).classList.add("hidden");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    renderAll();
  });
})();