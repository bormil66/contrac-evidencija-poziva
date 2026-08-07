module.exports = async (req, res) => {
  const deepseek = !!process.env.DEEPSEEK_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const readOnly = process.env.READ_ONLY === "true";
  res.status(200).json({
    aiEnabled: deepseek || anthropic,
    aiProvider: deepseek ? "deepseek" : (anthropic ? "anthropic" : null),
    readOnly,
  });
};
