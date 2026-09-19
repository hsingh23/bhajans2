// Calendar years, with leap-day anniversaries clamped to February 28.
function expirationFor(current, data, now = Date.now()) {
  if (data.mode === "years") {
    if (!Number.isInteger(data.years) || data.years < 1 || data.years > 100) {
      throw new Error("Enter a whole number of years from 1 to 100.");
    }
    const date = new Date(Math.max(Number(current?.expiresOn) || 0, now));
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() + data.years);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
    return date.getTime();
  }
  if (data.mode === "date") {
    if (
      typeof data.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ) {
      throw new Error("Choose a valid expiration date.");
    }
    const expiresOn = Date.parse(`${data.date}T23:59:59.999Z`);
    if (
      !Number.isFinite(expiresOn) ||
      new Date(expiresOn).toISOString().slice(0, 10) !== data.date ||
      expiresOn <= now
    ) {
      throw new Error("Choose a valid date today or later (UTC).");
    }
    return expiresOn;
  }
  throw new Error("Choose years to add or an expiration date.");
}
module.exports = { expirationFor };
