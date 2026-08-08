const { blockIfReadOnly } = require("../../lib/auth");
const { updateRow, archiveRow } = require("../../lib/notion");

module.exports = async (req, res) => {
  const { id } = req.query;
  try {
    if (req.method === "PATCH") {
      if (!blockIfReadOnly(res)) return;
      const row = await updateRow(id, req.body || {});
      res.status(200).json({ row });
      return;
    }
    if (req.method === "DELETE") {
      if (!blockIfReadOnly(res)) return;
      const result = await archiveRow(id);
      res.status(200).json(result);
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
