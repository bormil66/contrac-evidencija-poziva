const { queryAllRows, createRow } = require("../lib/notion");
const { blockIfReadOnly } = require("../lib/auth");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await queryAllRows();
      res.status(200).json({ rows });
      return;
    }
    if (req.method === "POST") {
      if (!blockIfReadOnly(res)) return;
      const row = await createRow(req.body || {});
      res.status(200).json({ row });
      return;
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
