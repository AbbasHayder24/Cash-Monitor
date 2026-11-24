/* ==========================================================================
   FinFlow — Centralized Configuration (APP_CONFIG)
   ملف الإعدادات المركزي: يمكنك تعديل الألوان، الهوية، الفئات، العملات،
   والقيم الافتراضية من هذا الملف فقط دون الحاجة لتعديل بقية ملفات الكود.
   ========================================================================== */

const APP_CONFIG = {
  // مفتاح الحفظ في المتصفح (لا تغيّره إلا إذا أردت بدء نسخة بيانات جديدة)
  storageKey: "finflow_classical_glass_v2",
  legacyStorageKey: "finflow_classical_glass_v1",
  
  // 1) هوية التطبيق الافتراضية (قابلة للتعديل أيضاً من داخل تبويب "التخصيص")
  brand: {
    name: "FinFlow",
    emblem: "FF",
    subtitleAr: "السجل المالي الكلاسيكي",
    subtitleEn: "Classical Wealth Ledger"
  },
  
  // 2) الإعدادات الافتراضية للتطبيق
  defaults: {
    lang: "ar", // "ar" أو "en"
    theme: "light", // "light" أو "dark"
    currency: "IQD", // العملة الافتراضية عند الفتح
    accentId: "gold", // معرف اللون الرئيسي من accentPresets أو "custom"
    customAccent: "#b88e3c", // لون مخصص إذا تم اختيار custom
    compactMode: false, // وضع مضغوط ومريح للشاشات الصغيرة (الهاتف)
    warnThresholdPct: 75, // نسبة التحذير في أشرطة الميزانية (%)
    recentTxCount: 5, // عدد أحدث المعاملات المعروضة في لوحة التحكم
    budgetWatchCount: 4, // عدد بطاقات الميزانية في لوحة التحكم
    ruleSplit: {
      needs: 50,
      wants: 30,
      savings: 20
    },
    widgets: {
      kpi: true,
      quickAdd: true,
      donut: true,
      recent: true,
      budgetWatch: true
    }
  },
  
  // 3) ألوان التمييز الجاهزة (Accent Presets)
  accentPresets: [
    { id: "gold", nameAr: "الذهبي الكلاسيكي", nameEn: "Classical Gold", primary: "#b88e3c", light: "#d9b873" },
    { id: "emerald", nameAr: "الزمردي الملكي", nameEn: "Royal Emerald", primary: "#1b6b50", light: "#48c99b" },
    { id: "sapphire", nameAr: "الياقوتي الأزرق", nameEn: "Royal Sapphire", primary: "#23487a", light: "#5b8fd9" },
    { id: "plum", nameAr: "الأرجواني الفاخر", nameEn: "Imperial Plum", primary: "#7c5295", light: "#b185db" },
    { id: "crimson", nameAr: "العنابي الكلاسيكي", nameEn: "Burgundy Crimson", primary: "#9e2a3b", light: "#e06d7d" },
    { id: "slate", nameAr: "الرمادي العصري", nameEn: "Modern Slate", primary: "#475569", light: "#94a3b8" }
  ],
  
  // 4) نسب سريعة جاهزة لقاعدة تقسيم الدخل
  rulePresets: [
    { label: "50 / 30 / 20", needs: 50, wants: 30, savings: 20 },
    { label: "60 / 20 / 20", needs: 60, wants: 20, savings: 20 },
    { label: "70 / 20 / 10", needs: 70, wants: 20, savings: 10 },
    { label: "40 / 30 / 30", needs: 40, wants: 30, savings: 30 }
  ],
  
  // 5) أسعار الصرف الافتراضية مقابل الدولار الأمريكي (USD) — العراقي والأمريكي فقط
  defaultRates: {
    USD: 1,
    IQD: 1310 // الدينار العراقي (قابل للتعديل من الواجهة)
  },
  
  // 6) بيانات العملات المدعومة (الدينار العراقي والدولار الأمريكي فقط، مع إمكانية إضافة عملات أخرى من الواجهة)
  defaultCurrencies: {
    IQD: { code: "IQD", nameAr: "الدينار العراقي", nameEn: "Iraqi Dinar", symbolAr: "د.ع", symbolEn: "IQD", decimals: 0, stepPresets: [10000, 50000], builtin: true },
    USD: { code: "USD", nameAr: "الدولار الأمريكي", nameEn: "US Dollar", symbolAr: "$", symbolEn: "$", decimals: 2, stepPresets: [25, 100], builtin: true }
  },
  
  // 7) الفئات الافتراضية (المصروفات والدخل) — قابلة للتعديل والإضافة والحذف بالكامل
  defaultCategories: [
    { id: "food", type: "expense", bucket: "needs", icon: "🍽️", color: "#b88e3c", nameAr: "الطعام والمطاعم", nameEn: "Food & Dining" },
    { id: "study", type: "expense", bucket: "needs", icon: "📚", color: "#1b6b50", nameAr: "الكتب والدراسة", nameEn: "Books & Study" },
    { id: "housing", type: "expense", bucket: "needs", icon: "🏠", color: "#23487a", nameAr: "السكن والفواتير", nameEn: "Rent & Bills" },
    { id: "transport", type: "expense", bucket: "needs", icon: "🚗", color: "#c27803", nameAr: "المواصلات", nameEn: "Transport" },
    { id: "health", type: "expense", bucket: "needs", icon: "🩺", color: "#9e2a3b", nameAr: "الصحة والرياضة", nameEn: "Health & Gym" },
    { id: "lifestyle", type: "expense", bucket: "wants", icon: "✨", color: "#7c5295", nameAr: "الترفيه والتسوق", nameEn: "Lifestyle & Shopping" },
    { id: "salary", type: "income", bucket: "none", icon: "💼", color: "#1b6b50", nameAr: "الراتب / المنحة", nameEn: "Salary / Stipend" },
    { id: "freelance", type: "income", bucket: "none", icon: "💡", color: "#23487a", nameAr: "دخل إضافي", nameEn: "Additional Income" }
  ],
  
  // 8) حدود الميزانية الافتراضية بالدولار الأمريكي (تُحوّل تلقائياً لعملتك المختارة)
  defaultBudgetsUSD: {
    food: 220,
    study: 150,
    housing: 420,
    transport: 100,
    health: 80,
    lifestyle: 140
  },
  
  // 9) أهداف الادخار التجريبية
  defaultGoals: [
    { id: "g-1", name: "صندوق الطوارئ / Emergency Fund", targetUSD: 2500, savedUSD: 1150 },
    { id: "g-2", name: "تطوير الأجهزة الدراسية / Study Workstation", targetUSD: 1100, savedUSD: 620 }
  ],
  
  // 10) معاملات تجريبية أولية (offsetDays = عدد الأيام قبل اليوم)
  sampleTransactions: [
    { id: "tx-1", type: "income", title: "الراتب الشهري / Monthly Stipend", amountUSD: 1200, category: "salary", offsetDays: -12, note: "" },
    { id: "tx-2", type: "income", title: "عمل حر / Freelance Project", amountUSD: 350, category: "freelance", offsetDays: -7, note: "" },
    { id: "tx-3", type: "expense", title: "إيجار وفواتير الإنترنت / Rent & Bills", amountUSD: 380, category: "housing", offsetDays: -10, note: "" },
    { id: "tx-4", type: "expense", title: "مراجع وكتب علمية / Textbooks & Notes", amountUSD: 95, category: "study", offsetDays: -6, note: "" },
    { id: "tx-5", type: "expense", title: "مقاضي المنزل والقهوة / Groceries", amountUSD: 145, category: "food", offsetDays: -4, note: "" },
    { id: "tx-6", type: "expense", title: "اشتراك النادي الرياضي / Gym", amountUSD: 45, category: "health", offsetDays: -3, note: "" },
    { id: "tx-7", type: "expense", title: "مواصلات وتنقل / Daily Transport", amountUSD: 60, category: "transport", offsetDays: -1, note: "" }
  ]
};