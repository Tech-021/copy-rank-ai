export async function generateImagesForArticle(
  request: Request,
  content: string,
  title: string,
  keywords: string[],
  count: number = 2
): Promise<string[]> {
  try {
    console.log(`🖼️ Generating ${count} images for article...`);

    const imagePrompts = extractImagePromptsFromContent(content, title, keywords);

    const images: string[] = [];

    for (let i = 0; i < Math.min(count, imagePrompts.length); i++) {
      let prompt = imagePrompts[i];
      prompt = `${prompt}. NO TEXT, NO WORDS, NO LETTERS, NO HEADINGS, NO TYPOGRAPHY, NO WRITING, NO LOGOS WITH TEXT. Pure illustration only, no textual elements.`;

      console.log(`📸 Generating image ${i + 1} with prompt: "${prompt.substring(0, 100)}..."`);

      const authHeader = request.headers.get('authorization');
      const internalKey = request.headers.get('x-internal-api-key');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authHeader) headers['Authorization'] = authHeader;
      // Propagate internal process key for server-to-server calls
      if (internalKey) headers['x-internal-api-key'] = internalKey;

      const imageResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/image-generation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: prompt,
          size: '1328*1328',
          n: 1,
          negative_prompt: 'text, words, letters, typography, writing, headings, titles, captions, logos with text, watermarks, signatures, written text, numbers, symbols, characters, fonts, calligraphy',
        }),
      });

      if (!imageResponse.ok) {
        console.error(`❌ Image generation failed for prompt: ${prompt}`);
        continue;
      }

      const imageData = await imageResponse.json();
      if (imageData.ok && imageData.images && imageData.images.length > 0) {
        images.push(imageData.images[0]);
        console.log(`✅ Image ${i + 1} generated successfully`);
      }
    }

    return images;
  } catch (error) {
    console.error('💥 Image generation error:', error);
    return [];
  }
}

function extractImagePromptsFromContent(content: string, title: string, keywords: string[]): string[] {
  const prompts: string[] = [];
  const cleanContent = content.replace(/<[^>]*>/g, ' ');
  const sections = cleanContent.split(/\n+/).filter((section) => section.trim().length > 50 && section.split(' ').length > 10);

  const mainConceptPrompt = `Professional digital illustration, ${title}. ${keywords.join(', ')}. Clean, modern, professional blog style, high quality, detailed`;
  prompts.push(mainConceptPrompt);

  if (sections.length > 0) {
    const firstSection = sections[0].substring(0, 200);
    prompts.push(`Digital illustration concept: ${firstSection}. Professional blog style, clear, engaging visual`);
  }

  if (sections.length > 2) {
    const middleIndex = Math.floor(sections.length / 2);
    const middleSection = sections[middleIndex].substring(0, 150);
    prompts.push(`Concept art: ${middleSection}. Professional illustration, blog content visual`);
  }

  // lightweight category detection just to pick a fallback prompt
  const lowerKeyword = (keywords[0] || '').toLowerCase();
  const categoryPrompts: Record<string, string> = {
    fitness: 'Professional fitness illustration, active lifestyle, health and wellness, modern graphic style',
    marketing: 'Digital marketing concept, business growth, analytics, modern professional illustration',
    finance: 'Financial growth concept, money management, investment strategies, professional business illustration',
    health: 'Health and wellness concept, balanced lifestyle, nutrition, professional medical illustration',
    technology: 'Modern technology concept, innovation, digital transformation, clean tech illustration',
    general: 'Professional blog illustration, content creation, engaging visual concept',
  };

  const category = lowerKeyword.includes('fit') ? 'fitness' : lowerKeyword.includes('mark') ? 'marketing' : lowerKeyword.includes('money') ? 'finance' : lowerKeyword.includes('health') ? 'health' : lowerKeyword.includes('tech') ? 'technology' : 'general';

  prompts.push(categoryPrompts[category] ?? categoryPrompts.general);

  return [...new Set(prompts)].slice(0, 4);
}
