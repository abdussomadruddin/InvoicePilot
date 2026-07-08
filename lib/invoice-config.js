const invoiceConfig = {
  timezone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur",
  driveMasterFolderId: process.env.INVOICE_DRIVE_MASTER_FOLDER_ID || "1DqzU5ZZ_81bpEXZiWqqecBF8gqmRiv-o",
  business: {
    name: process.env.INVOICE_BUSINESS_NAME || "Your Business Name",
    registrationNumber: process.env.INVOICE_BUSINESS_REG_NO || "",
    address: process.env.INVOICE_BUSINESS_ADDRESS || "Business address",
    email: process.env.INVOICE_BUSINESS_EMAIL || "",
    phone: process.env.INVOICE_BUSINESS_PHONE || "",
    paymentDetails: process.env.INVOICE_PAYMENT_DETAILS || "Bank details / payment instructions",
    bankName: process.env.INVOICE_BANK_NAME || "",
    bankAccountNumber: process.env.INVOICE_BANK_ACCOUNT_NUMBER || "",
    bankAccountName: process.env.INVOICE_BANK_ACCOUNT_NAME || "",
    paymentLink: process.env.INVOICE_PAYMENT_LINK || "",
    logoPath: "",
  },
  defaults: {
    currency: "MYR",
    taxRate: 0,
    terms: "due_on_receipt",
    serviceTitle: process.env.INVOICE_SERVICE_TITLE || "Lead Generation Ads & Funnelling",
    serviceDescription: process.env.INVOICE_SERVICE_DESCRIPTION || "Perkhidmatan pengurusan kempen Lead Generation yang merangkumi perancangan strategi, pengurusan iklan, pemantauan prestasi, dan pengoptimuman berterusan bagi meningkatkan jumlah prospek berkualiti serta mengurangkan kos setiap lead.",
    serviceScope: process.env.INVOICE_SERVICE_SCOPE || [
      "Perancangan strategi pemasaran digital.",
      "Penyediaan dan pengurusan kempen Meta/Tiktok Ads.",
      "Pengoptimuman kempen secara berkala berdasarkan prestasi.",
      "Pemantauan kos, lead, dan prestasi iklan.",
      "Penyediaan funnel untuk pengumpulan prospek.",
      "Integrasi borang Lead Form atau WhatsApp mengikut keperluan.",
      "Pengurusan asas automasi lead dan aliran prospek.",
      "Laporan prestasi berkala beserta ringkasan analisis.",
    ].join("\n"),
    serviceNote: process.env.INVOICE_SERVICE_NOTE || "Perkhidmatan ini meliputi yuran pengurusan sahaja. Bajet pengiklanan Meta/Tiktok Ads, langganan perisian pihak ketiga, dan caj platform adalah di bawah tanggungan pelanggan melainkan dinyatakan sebaliknya.",
  },
  clients: [
    {
      name: "TEEGA",
      code: "TEEGA",
      billingName: "TEEGA",
      billingAddress: "",
      monthlyRetainer: Number(process.env.INVOICE_DEFAULT_MONTHLY_RETAINER || 0),
      driveFolderName: "TEEGA",
    },
    {
      name: "SAFRICH",
      code: "SAFRICH",
      billingName: "SAFRICH",
      billingAddress: "",
      monthlyRetainer: Number(process.env.INVOICE_DEFAULT_MONTHLY_RETAINER || 0),
      driveFolderName: "SAFRICH",
    },
    {
      name: "MUIZ NAZMI (HONDA)",
      code: "MUIZ-HONDA",
      billingName: "MUIZ NAZMI (HONDA)",
      billingAddress: "",
      monthlyRetainer: Number(process.env.INVOICE_DEFAULT_MONTHLY_RETAINER || 0),
      driveFolderName: "MUIZ NAZMI (HONDA)",
    },
    {
      name: "KAK SUE KITCHEN",
      code: "KAK-SUE",
      billingName: "KAK SUE KITCHEN",
      billingAddress: "",
      monthlyRetainer: Number(process.env.INVOICE_DEFAULT_MONTHLY_RETAINER || 0),
      driveFolderName: "KAK SUE KITCHEN",
    },
    {
      name: "AZ HUSTLER EMPIRE",
      code: "AZ-HUSTLER",
      billingName: "AZ HUSTLER EMPIRE",
      billingAddress: "",
      monthlyRetainer: Number(process.env.INVOICE_DEFAULT_MONTHLY_RETAINER || 0),
      driveFolderName: "AZ HUSTLER EMPIRE",
    },
  ],
};

function parseClientsFromEnv() {
  const raw = process.env.INVOICE_CLIENTS_JSON;
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("INVOICE_CLIENTS_JSON mesti array client.");
  return parsed;
}

function getInvoiceConfig() {
  const envClients = parseClientsFromEnv();
  return {
    ...invoiceConfig,
    clients: envClients || invoiceConfig.clients,
  };
}

module.exports = {
  getInvoiceConfig,
};
