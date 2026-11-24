/* ==========================================================================
   FinFlow — Custom SVG Donut Chart Renderer (Uses Dynamic Category Colors)
   ========================================================================== */

const FALLBACK_CHART_PALETTE = [
  "#b88e3c",
  "#1b6b50",
  "#23487a",
  "#9e2a3b",
  "#7c5295",
  "#c27803",
  "#0f766e",
  "#be123c"
];

function renderExpenseDonut(container, expensesByCategory, state) {
  const lang = state.lang;
  const dict = I18N[lang] || I18N.ar;

  // Sort once so SVG segments and legend colors always match 1-to-1
  const entries = Object.entries(expensesByCategory)
    .filter(([, val]) => val > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = `<p class="muted-text">${dict.noExpensesYet}</p>`;
    return;
  }

  const totalUSD = entries.reduce((sum, [, val]) => sum + val, 0);
  const size = 192;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const findCat = (catId) => (state.categories || []).find((c) => c.id === catId);

  let cumulativePercent = 0;
  const circlesSVG = entries
    .map(([catId, amountUSD], idx) => {
      const cat = findCat(catId);
      const color = (cat && cat.color) || FALLBACK_CHART_PALETTE[idx % FALLBACK_CHART_PALETTE.length];
      const pct = amountUSD / totalUSD;
      const dashArray = `${pct * circumference} ${circumference}`;
      const dashOffset = -cumulativePercent * circumference;
      cumulativePercent += pct;

      return `<circle
        cx="${size / 2}"
        cy="${size / 2}"
        r="${radius}"
        fill="transparent"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${dashArray}"
        stroke-dashoffset="${dashOffset}"
        stroke-linecap="butt"
        style="transition: stroke-dasharray 0.45s ease;"
      />`;
    })
    .join("");

  const totalFormatted = CurrencyEngine.format(totalUSD, state.currency, state.rates, lang, state.currencies);

  const legendHTML = entries
    .map(([catId, amountUSD], idx) => {
      const cat = findCat(catId);
      const color = (cat && cat.color) || FALLBACK_CHART_PALETTE[idx % FALLBACK_CHART_PALETTE.length];
      const pctLabel = Math.round((amountUSD / totalUSD) * 100);
      const catName = cat ? getCategoryLabel(cat, lang) : catId;
      const valStr = CurrencyEngine.format(amountUSD, state.currency, state.rates, lang, state.currencies);

      return `
        <div class="legend-item">
          <div class="legend-left">
            <span class="legend-swatch" style="background:${color}"></span>
            <span>${catName} (${pctLabel}%)</span>
          </div>
          <strong class="classical-num">${valStr}</strong>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="position:relative; width:${size}px; height:${size}px; flex-shrink:0;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="rgba(128,128,128,0.16)" stroke-width="${strokeWidth}" />
        ${circlesSVG}
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:16px;">
        <span style="font-size:0.74rem; color:var(--text-muted);">${dict.totalExpensesLabel}</span>
        <strong class="classical-num" style="font-size:0.95rem; margin-top:2px;">${totalFormatted}</strong>
      </div>
    </div>
    <div class="donut-legend">${legendHTML}</div>
  `;
}
