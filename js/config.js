/* ============================================================
 * AutoFlex Dashboard - الإعدادات المركزية
 * عدّل هذا الملف فقط لو تغيّرت البنية أو الروابط
 * ============================================================ */
window.APP_CONFIG = {
  /* رابط Web App بعد نشره من Google Apps Script
     مثال: "https://script.google.com/macros/s/XXXX/exec"
     اتركه فارغًا للعرض بواسطة ملف المعاينة data/preview.json */
  API_URL: 'https://script.google.com/macros/s/AKfycbxjXJVf-SAwcxfKc1dj257IepGtFyM3CtqyFdSv5T5hSXideIT1FRm4siAt4M4W2bwGsw/exec',

  /* اسم التبويب الرئيسي داخل Google Sheets */
  PRIMARY_SHEET: 'all',

  /* اسم تبويب المرتجعات إذا كان منفصلاً */
  RETURNS_SHEET: 'المرتجعات',

  MOCK_DATA_URL: 'data/preview.json',
  MOCK_LABEL: 'وضع المعاينة بالملف الثابت',

  /* التحديث التلقائي */
  AUTO_REFRESH_DEFAULT: 'off',
  AUTO_REFRESH_OPTIONS: [
    { value: 'off', label: 'إيقاف' },
    { value: 1, label: 'كل دقيقة' },
    { value: 5, label: 'كل 5 دقائق' },
    { value: 15, label: 'كل 15 دقيقة' },
    { value: 30, label: 'كل 30 دقيقة' }
  ],

  BRAND: {
    name: 'AutoFlex',
    subtitle: 'لوحة إدارة المبيعات، المصاريف، التوريد والفواتير',
    owner: 'كريم شعير',
    ownerTitle: 'إدارة البيانات والتحول الرقمي'
  },

  CURRENCY: 'جنيه',

  /* لوحة الألوان: هوية العلامة */
  COLORS: {
    blue: '#014976',
    blueDark: '#073b5c',
    blueSoft: '#0a5a8e',
    orange: '#FBAE42',
    orangeDark: '#e0921f',
    cream: '#F4F3EF',
    ink: '#13222e',
    muted: '#5f6b76',
    line: '#dbe1de',
    white: '#ffffff',
    good: '#2e9e6b',
    warn: '#d9a441',
    bad: '#cf5340',
    chart: {
      base: ['#014976', '#FBAE42', '#0a5a8e', '#7f9bb3', '#e4a04b', '#2e9e6b', '#9b7fb3', '#b3541e',
             '#133f5c', '#d9c08a', '#3f6c8f', '#8fa9bb', '#c9a86a', '#1b6f9b', '#e8b86e', '#5f6b76']
    }
  },

  /* =====================================================
   * Schema تب "all" (29 عمودًا) — نفس ترتيب الأعمدة الأصلي
   * type:
   *  datetime | date | currency | text | id | phone | image | discount | unknown | boolean
   * ===================================================== */
  ALL_SCHEMA: [
    { key: 'timestamp', label: 'وقت التسجيل', type: 'datetime', group: 'all' },
    { key: 'formType', label: 'نوع الفورم', type: 'text', group: 'all' },
    { key: 'expenseType', label: 'النوع', type: 'text', group: 'expense' },
    { key: 'expensePrice', label: 'السعر', type: 'currency', group: 'expense' },
    { key: 'expenseDate', label: 'التاريخ', type: 'date', group: 'expense' },
    { key: 'expenseImage', label: 'صوره', type: 'image', group: 'expense' },
    { key: 'invoiceExitDate', label: 'تاريخ خروجها', type: 'date', group: 'invoice' },
    { key: 'supplyAmount', label: 'المبلغ', type: 'currency', group: 'supply' },
    { key: 'supplyMethod', label: 'الطريقه', type: 'text', group: 'supply' },
    { key: 'supplyDate', label: 'التاريخ 2', type: 'date', group: 'supply' },
    { key: 'docStatus', label: 'توثيق', type: 'text', group: 'invoice' },
    { key: 'invoiceNumber', label: 'رقم الفاتوره', type: 'id', group: 'invoice' },
    { key: 'invoicePrice', label: 'سعرها', type: 'currency', group: 'invoice' },
    { key: 'invoiceWorkDate', label: 'تاريخ عملها', type: 'date', group: 'invoice' },
    { key: 'invoiceOwner', label: 'صاحب الفاتوره', type: 'text', group: 'invoice' },
    { key: 'invoiceImage', label: 'صوره الفاتوره', type: 'image', group: 'invoice' },
    { key: 'salesPerson', label: 'sales person', type: 'text', group: 'invoice' },
    { key: 'discount', label: 'Discount', type: 'discount', group: 'invoice' },
    { key: 'phone', label: 'phone number', type: 'phone', group: 'invoice' },
    { key: 'column19', label: 'Column 19', type: 'unknown', group: 'invoice' },
    { key: 'governorate', label: 'المحافظه', type: 'text', group: 'invoice' },
    { key: 'returnDate', label: 'التاريخ 3', type: 'date', group: 'return' },
    { key: 'returnInvoiceNumber', label: 'رقم الفاتوره 2', type: 'id', group: 'return' },
    { key: 'returnPrice', label: 'سعرها 2', type: 'currency', group: 'return' },
    { key: 'returnOwner', label: 'صاحب الفاتوره', type: 'text', group: 'return' },
    { key: 'returnSalesPerson', label: 'sales person 2', type: 'text', group: 'return' },
    { key: 'returnDoc', label: 'توثيق 2', type: 'text', group: 'return' },
    { key: 'returnReceiver', label: 'مين استلمها منك من المخزن', type: 'text', group: 'return' },
    { key: 'returnReason', label: 'سبب المرتجع', type: 'text', group: 'return' }
  ],

  /* Schema تب "المرتجعات" المنفصل — يُطابَق بالاسم عند القراءة */
  RETURNS_TAB_SCHEMA: [
    { headerMatch: 'timestamp', key: 'timestamp', type: 'datetime', label: 'وقت التسجيل' },
    { headerMatch: 'نوع الفورم', key: 'formType', type: 'text', label: 'نوع الفورم' },
    { headerMatch: 'التاريخ', key: 'returnDate', type: 'date', label: 'تاريخ المرتجع' },
    { headerMatch: 'رقم الفاتوره', key: 'returnInvoiceNumber', type: 'id', label: 'رقم الفاتورة' },
    { headerMatch: 'سعرها', key: 'returnPrice', type: 'currency', label: 'قيمة المرتجع' },
    { headerMatch: 'صاحب الفاتوره', key: 'returnOwner', type: 'text', label: 'صاحب الفاتورة' },
    { headerMatch: 'sales person', key: 'returnSalesPerson', type: 'text', label: 'Sales Person' },
    { headerMatch: 'توثيق', key: 'returnDoc', type: 'text', label: 'التوثيق' },
    { headerMatch: 'مين استلمها', key: 'returnReceiver', type: 'text', label: 'مستلم المرتجع' },
    { headerMatch: 'سبب المرتجع', key: 'returnReason', type: 'text', label: 'سبب المرتجع' }
  ],

  /* عمود اجتياز تاريخ العملية حسب نوع الفورم */
  DATE_BASIS: {
    expense: 'expenseDate',
    supply: 'supplyDate',
    invoice: 'invoiceWorkDate',
    return: 'returnDate'
  },

  /* تسميات الأنواع */
  FORM_LABELS: {
    expense: 'المصاريف',
    supply: 'التوريد',
    invoice: 'خروج الفواتير',
    return: 'المرتجعات'
  },

  /* الجداول المعروضة في كل قسم */
  TABLES: {
    invoice: [
      { col: 'invoiceNumber', label: 'رقم الفاتورة' },
      { col: 'invoicePrice', label: 'القيمة' },
      { col: 'invoiceWorkDate', label: 'تاريخ العمل' },
      { col: 'invoiceExitDate', label: 'تاريخ الخروج' },
      { col: 'invoiceOwner', label: 'صاحب الفاتورة' },
      { col: 'salesPerson', label: 'Sales Person' },
      { col: 'discountSummary', label: 'الخصم' },
      { col: 'governorate', label: 'المحافظة' },
      { col: 'docStatus', label: 'التوثيق' }
    ],
    expense: [
      { col: 'expenseType', label: 'نوع المصروف' },
      { col: 'expensePrice', label: 'القيمة' },
      { col: 'expenseDate', label: 'التاريخ' },
      { col: 'timestamp', label: 'وقت التسجيل' }
    ],
    supply: [
      { col: 'supplyAmount', label: 'المبلغ' },
      { col: 'supplyMethod', label: 'طريقة الدفع' },
      { col: 'supplyDate', label: 'التاريخ' },
      { col: 'timestamp', label: 'وقت التسجيل' }
    ],
    return: [
      { col: 'returnInvoiceNumber', label: 'رقم الفاتورة' },
      { col: 'returnPrice', label: 'القيمة' },
      { col: 'returnDate', label: 'التاريخ' },
      { col: 'returnOwner', label: 'صاحب الفاتورة' },
      { col: 'returnReason', label: 'سبب المرتجع' },
      { col: 'returnReceiver', label: 'المستلم' },
      { col: 'returnDoc', label: 'التوثيق' }
    ]
  },

  PHONE_NORMALIZE: true
};