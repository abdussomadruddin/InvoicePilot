const SUPABASE_TABLES_ERROR = "Supabase table belum setup. Run SQL dalam supabase/schema.sql dahulu.";

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();
  return { url, key };
}

function isSupabaseConfigured() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

function requireSupabaseConfig() {
  const config = supabaseConfig();
  if (!config.url || !config.key) {
    throw new Error("Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dahulu.");
  }
  return config;
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const error = await response.json();
      detail = error.message || error.details || JSON.stringify(error);
    } catch (parseError) {
      detail = await response.text();
    }
    if (response.status === 404 || /relation .* does not exist/i.test(detail)) {
      throw new Error(SUPABASE_TABLES_ERROR);
    }
    throw new Error(detail || `Supabase request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function amount(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) / 100 : 0;
}

function clientToRow(client) {
  return {
    code: client.code,
    brand_client: client.brandClient || client.name || client.code,
    name: client.name || client.brandClient || client.code,
    contact_name: client.contactName || "",
    email: client.email || "",
    phone: client.phone || "",
    company_name: client.companyName || "",
    registration_number: client.registrationNumber || "",
    billing_name: client.billingName || client.companyName || client.brandClient || client.name || client.code,
    billing_address: client.billingAddress || "",
    monthly_retainer: amount(client.monthlyRetainer),
    drive_folder_id: client.driveFolderId || "",
    drive_folder_name: client.driveFolderName || "",
    weekly_report_folder_id: client.weeklyReportFolderId || "",
    invoice_receipt_folder_id: client.invoiceReceiptFolderId || "",
    source: "supabase",
    metadata: client.metadata || {},
  };
}

function rowToClient(row) {
  return {
    code: row.code,
    brandClient: row.brand_client,
    name: row.name || row.brand_client,
    contactName: row.contact_name || "",
    email: row.email || "",
    phone: row.phone || "",
    companyName: row.company_name || "",
    registrationNumber: row.registration_number || "",
    billingName: row.billing_name || row.company_name || row.brand_client,
    billingAddress: row.billing_address || "",
    monthlyRetainer: amount(row.monthly_retainer),
    driveFolderId: row.drive_folder_id || "",
    driveFolderName: row.drive_folder_name || "",
    weeklyReportFolderId: row.weekly_report_folder_id || "",
    invoiceReceiptFolderId: row.invoice_receipt_folder_id || "",
    source: "supabase",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    metadata: row.metadata || {},
  };
}

async function listSupabaseClients() {
  const rows = await supabaseRequest("invoice_clients?select=*&order=brand_client.asc");
  return (rows || []).map(rowToClient);
}

async function upsertSupabaseClient(client) {
  const rows = await supabaseRequest("invoice_clients?on_conflict=code", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [clientToRow(client)],
  });
  return rowToClient(rows?.[0] || clientToRow(client));
}

function settingsToRow(settings) {
  return {
    id: "default",
    name: settings.name || "",
    registration_number: settings.registrationNumber || settings.regNo || "",
    email: settings.email || "",
    phone: settings.phone || "",
    address: settings.address || "",
    payment_details: settings.paymentDetails || "",
    bank_name: settings.bankName || "",
    bank_account_number: settings.bankAccountNumber || "",
    bank_account_name: settings.bankAccountName || "",
    payment_link: settings.paymentLink || "",
    logo_path: settings.logoPath || "",
  };
}

function rowToSettings(row) {
  return {
    name: row.name || "",
    registrationNumber: row.registration_number || "",
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    paymentDetails: row.payment_details || "",
    bankName: row.bank_name || "",
    bankAccountNumber: row.bank_account_number || "",
    bankAccountName: row.bank_account_name || "",
    paymentLink: row.payment_link || "",
    logoPath: row.logo_path || "",
  };
}

async function getSupabaseBusinessSettings() {
  const rows = await supabaseRequest("business_settings?id=eq.default&select=*");
  return rows?.[0] ? rowToSettings(rows[0]) : null;
}

async function upsertSupabaseBusinessSettings(settings) {
  const rows = await supabaseRequest("business_settings?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [settingsToRow(settings)],
  });
  return rowToSettings(rows?.[0] || settingsToRow(settings));
}

async function recordSupabaseInvoiceUpload({ invoice, upload, replaced }) {
  if (!isSupabaseConfigured()) return null;

  const rows = await supabaseRequest("invoice_uploads?on_conflict=invoice_number", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      invoice_number: invoice.invoiceNumber,
      period: invoice.period,
      client_code: invoice.client.code,
      client_name: invoice.client.name,
      invoice_date: invoice.invoiceDate,
      service_price: amount(invoice.subtotal),
      discount: amount(invoice.discount),
      total: amount(invoice.total),
      currency: invoice.currency,
      drive_file_id: upload.id || "",
      drive_file_name: invoice.fileName,
      drive_file_url: upload.webViewLink || "",
      invoice_receipt_folder_id: upload.invoicesFolderId || "",
      replaced: Boolean(replaced),
      metadata: {
        billingName: invoice.client.billingName,
        terms: invoice.terms,
      },
    }],
  });
  return rows?.[0] || null;
}

module.exports = {
  getSupabaseBusinessSettings,
  isSupabaseConfigured,
  listSupabaseClients,
  recordSupabaseInvoiceUpload,
  upsertSupabaseBusinessSettings,
  upsertSupabaseClient,
};
