export type GenParams = {
  topic: string;
  audience: string;
  words?: number;
};

export const systemPrompt = `Write like a human: short paragraphs (2–4 sentences), varied sentence length, contractions, rhetorical questions. Include one short anecdote early. Use specific local details, slightly opinionated tone. Avoid generic lead-ins and boilerplate.`;

export const humanExamples: string[] = [
  `I still keep a wrinkled ticket from a rainy meetup in Lahore. We argued about CSS grids over chai; that messy, specific moment taught me why conventions beat cleverness.`,
  `A shop owner in Karachi once told me he tracks inventory on paper because it forces him to notice odd patterns. That small friction saved him twice during holiday rushes.`
];

export function buildMessages({ topic, audience, words = 800 }: GenParams) {
  const example = humanExamples[Math.floor(Math.random() * humanExamples.length)];
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
