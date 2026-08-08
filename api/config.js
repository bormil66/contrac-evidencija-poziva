/**
 * Public config endpoint. Deliberately unauthenticated — the browser needs
 * these values before it can log in.
 *
 * The publishable key is safe to expose: it identifies the project, not the
 * user, and every query it makes still goes through Row Level Security.
 */
module.exports = async (req, res) => {
  const aiProvider = process.env.DEEPSEEK_API_KEY
    ? "deepseek"
    : (process.env.ANTHROPIC_API_KEY ? "anthropic" : null);

  res.status(200).json({
    aiEnabled: !!aiProvider,
    aiProvider,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || null,
  });
};