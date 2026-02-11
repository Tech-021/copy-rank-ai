export type GenParams = {
  topic: string;
  audience: string;
  words?: number;
  keyword?: string;
  keywordMeta?: any;
};

export const systemPrompt = `Write like a human: short paragraphs (2–4 sentences), varied sentence length, contractions, rhetorical questions. Include one short anecdote early. Use specific, concrete details and avoid generic lead-ins or boilerplate. Do NOT repeat example text verbatim in your output.`;

export const humanExamples: string[] = [
  `I once helped a small bookstore figure out what really mattered to its customers; a single experiment changed how they merchandised bestsellers and made a big difference during the holidays.`,
  `A café owner told me that focusing on one small operational change saved them hours every week; that concrete adjustment was far more valuable than lofty strategy meetings.`
];

function buildKeywordExample(keyword?: string, meta?: any) {
  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
    return humanExamples[Math.floor(Math.random() * humanExamples.length)];
  }

  const safeKeyword = keyword.trim();
  const industry = meta?.industry ? `${meta.industry} ` : '';

  // Avoid exposing exact location names in examples unless explicitly needed; use contextual phrasing
  const context = meta?.location
    ? `a local ${industry}business`
    : `a small ${industry}business`;

  return `I once helped ${context} improve ${safeKeyword} with one focused experiment; that small practical change taught me how specific tactics beat vague strategy.`;
}

export function buildMessages({ topic, audience, words = 800, keyword, keywordMeta }: GenParams) {
  const example = buildKeywordExample(keyword, keywordMeta);
  const task = `Topic: ${topic}
Audience: ${audience}
Length: ~${words} words
Style: conversational, first person when natural
Include: one 20–40 word anecdote, 2 concrete examples, one actionable takeaway
Avoid: boilerplate phrases, repeated transitions, excessive adjectives`;
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Example Human:\n${example}` },
    { role: "user", content: `Now write:\n${task}` },
  ];
}

export const defaultSampling = {
  temperature: 0.9,
  top_p: 0.9,
  frequency_penalty: 0.4,
  presence_penalty: 0.5,
};
