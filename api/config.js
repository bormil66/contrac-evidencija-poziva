module.exports = async (req, res) => {
  const deepseek = !!process.env.DEEPSEEK_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  res.status(200).json({
    aiEnabled: deepseek || anthropic,
    aiProvider: deepseek ? "deepseek" : (anthropic ? "anthropic" : null),
  });
};
