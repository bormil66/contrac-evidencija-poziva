function blockIfReadOnly(res) {
  const readOnly = process.env.READ_ONLY === "true";
  if (!readOnly) return true; // ova instanca (deployment) smije da pise
  res.status(403).json({ error: "Ovo je read-only prikaz — izmjene i AI unos su ovdje onemoguceni." });
  return false;
}

module.exports = { blockIfReadOnly };
