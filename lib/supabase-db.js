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

function cleanText(value) {
  return String(value || "").trim();
}

function eq(value) {
  return encodeURIComponent(String(value || ""));
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

function bankAccountToRow(account) {
  return {
    label: cleanText(account.label),
    bank_name: cleanText(account.bankName || account.bank_name),
    account_name: cleanText(account.accountName || account.account_name),
    account_number: cleanText(account.accountNumber || account.account_number),
    is_default: Boolean(account.isDefault || account.is_default),
    is_active: Object.prototype.hasOwnProperty.call(account, "isActive")
      ? Boolean(account.isActive)
      : Object.prototype.hasOwnProperty.call(account, "is_active")
        ? Boolean(account.is_active)
        : true,
  };
}

function rowToBankAccount(row) {
  return {
    id: row.id,
    label: row.label || "",
    bankName: row.bank_name || "",
    accountName: row.account_name || "",
    accountNumber: row.account_number || "",
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    deletedAt: row.deleted_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function validateBankAccount(account) {
  const clean = bankAccountToRow(account);
  if (!clean.label) throw new Error("Nama akaun bank wajib diisi.");
  if (!clean.bank_name) throw new Error("Nama bank wajib diisi.");
  if (!clean.account_name) throw new Error("Nama pemilik akaun wajib diisi.");
  if (!clean.account_number) throw new Error("No akaun wajib diisi.");
  return clean;
}

async function listBankAccounts() {
  const rows = await supabaseRequest("bank_accounts?select=*&is_active=eq.true&deleted_at=is.null&order=is_default.desc,label.asc");
  return (rows || []).map(rowToBankAccount);
}

async function getDefaultBankAccount() {
  const rows = await supabaseRequest("bank_accounts?select=*&is_default=eq.true&is_active=eq.true&deleted_at=is.null&limit=1");
  return rows?.[0] ? rowToBankAccount(rows[0]) : null;
}

async function clearDefaultBankAccounts(exceptId = "") {
  const filter = exceptId ? `&id=neq.${eq(exceptId)}` : "";
  await supabaseRequest(`bank_accounts?is_default=eq.true${filter}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { is_default: false },
  });
}

async function ensureOneDefaultBankAccount(preferredId = "") {
  const active = await listBankAccounts();
  if (!active.length) return null;
  const current = active.find((account) => account.isDefault);
  if (current) return current;
  const next = active.find((account) => account.id === preferredId) || active[0];
  await clearDefaultBankAccounts(next.id);
  const rows = await supabaseRequest(`bank_accounts?id=eq.${eq(next.id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { is_default: true },
  });
  return rowToBankAccount(rows?.[0] || next);
}

async function createBankAccount(account) {
  const clean = validateBankAccount(account);
  if (clean.is_default) await clearDefaultBankAccounts();
  const rows = await supabaseRequest("bank_accounts", {
    method: "POST",
    prefer: "return=representation",
    body: [clean],
  });
  const saved = rowToBankAccount(rows?.[0]);
  if (saved.isDefault) return saved;
  return (await ensureOneDefaultBankAccount(saved.id)) || saved;
}

async function updateBankAccount(id, account) {
  if (!id) throw new Error("ID akaun bank wajib ada.");
  const clean = validateBankAccount(account);
  if (clean.is_default) await clearDefaultBankAccounts(id);
  const rows = await supabaseRequest(`bank_accounts?id=eq.${eq(id)}&deleted_at=is.null`, {
    method: "PATCH",
    prefer: "return=representation",
    body: clean,
  });
  if (!rows?.[0]) throw new Error("Akaun bank tidak dijumpai.");
  const saved = rowToBankAccount(rows[0]);
  if (saved.isDefault) return saved;
  return (await ensureOneDefaultBankAccount()) || saved;
}

async function deleteBankAccount(id) {
  if (!id) throw new Error("ID akaun bank wajib ada.");
  const existingRows = await supabaseRequest(`bank_accounts?id=eq.${eq(id)}&deleted_at=is.null&select=*`);
  const existing = existingRows?.[0] ? rowToBankAccount(existingRows[0]) : null;
  if (!existing) throw new Error("Akaun bank tidak dijumpai.");

  const rows = await supabaseRequest(`bank_accounts?id=eq.${eq(id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      is_active: false,
      is_default: false,
      deleted_at: new Date().toISOString(),
    },
  });
  const deleted = rowToBankAccount(rows?.[0] || existingRows[0]);
  const defaultAccount = existing.isDefault ? await ensureOneDefaultBankAccount() : await getDefaultBankAccount();
  return { deleted, defaultAccount };
}

function activityToRow(activity) {
  return {
    activity_type: cleanText(activity.type || activity.activityType || "info"),
    title: cleanText(activity.title),
    description: cleanText(activity.description),
    entity_type: cleanText(activity.entityType || activity.entity_type),
    entity_id: cleanText(activity.entityId || activity.entity_id),
    metadata: activity.metadata || {},
  };
}

function rowToActivity(row) {
  return {
    id: row.id,
    type: row.activity_type,
    title: row.title,
    description: row.description,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    metadata: row.metadata || {},
    createdAt: row.created_at || "",
  };
}

async function recordActivity(activity) {
  if (!isSupabaseConfigured()) return null;
  const clean = activityToRow(activity);
  if (!clean.title) return null;
  const rows = await supabaseRequest("app_activity", {
    method: "POST",
    prefer: "return=representation",
    body: [clean],
  });
  return rows?.[0] ? rowToActivity(rows[0]) : null;
}

async function listActivity(limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 30), 50));
  const rows = await supabaseRequest(`app_activity?select=*&order=created_at.desc&limit=${safeLimit}`);
  return (rows || []).map(rowToActivity);
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
  const saved = rows?.[0] || null;
  await recordActivity({
    type: "invoice_uploaded",
    title: `${invoice.invoiceNumber} uploaded`,
    description: `${invoice.client.name} - ${invoice.currency} ${Number(invoice.total || 0).toFixed(2)}`,
    entityType: "invoice",
    entityId: invoice.invoiceNumber,
    metadata: {
      clientCode: invoice.client.code,
      fileId: upload.id || "",
      replaced: Boolean(replaced),
    },
  });
  return saved;
}

module.exports = {
  createBankAccount,
  deleteBankAccount,
  getDefaultBankAccount,
  getSupabaseBusinessSettings,
  isSupabaseConfigured,
  listActivity,
  listBankAccounts,
  listSupabaseClients,
  recordActivity,
  recordSupabaseInvoiceUpload,
  updateBankAccount,
  upsertSupabaseBusinessSettings,
  upsertSupabaseClient,
};
