function weeklyReportWhatsappMessage({ contactName, clientName, dateRangeLabel, documentUrl }) {
  const recipient = String(contactName || clientName || "client").trim();
  const range = String(dateRangeLabel || "minggu ini").trim();
  const link = String(documentUrl || "").trim();
  if (!link) throw new Error("Link Google Drive report belum tersedia.");
  return [
    `Hi ${recipient},`,
    "",
    "*Weekly Meta Ads Report*",
    `Report untuk ${range} sudah tersedia.`,
    "",
    "Klik link di bawah untuk lihat atau download report:",
    link,
    "",
    "Terima kasih.",
  ].join("\n");
}

module.exports = { weeklyReportWhatsappMessage };
