const { queryAllRows, createRow } = require("../../lib/supabase");

/** Pulls the caller's JWT out of the Authorization header. */
function getAccessToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

module.exports = async (req, res) => {
  try {
    const token = getAccessToken(req);
    if (!token) {
      res.status(401).json({ error: "Niste prijavljeni." });
      return;
    }

    if (req.method === "GET") {
      const rows = await queryAllRows(token);
      res.status(200).json({ rows });
      return;
    }

    if (req.method === "POST") {
      const row = await createRow(token, req.body || {});
      res.status(200).json({ row });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
