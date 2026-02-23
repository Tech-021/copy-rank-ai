import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.WORDPRESS_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';

export interface WordPressCredentials {
  siteUrl: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface WordPressArticle {
  title: string;
  content: string;
  slug: string;
  status: 'draft' | 'publish';
  excerpt?: string;
  featuredImage?: string;
  categories?: string[];
  tags?: string[];
}

export interface WordPressPublishResult {
  id: number;
  url: string;
}

/**
 * Encrypt token for secure storage
 */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('WORDPRESS_ENCRYPTION_KEY environment variable is required');
  }

  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt token from storage
 */
export function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('WORDPRESS_ENCRYPTION_KEY environment variable is required');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Publish article to WordPress
 */
export async function publishToWordPress(
  credentials: WordPressCredentials,
  article: WordPressArticle
): Promise<WordPressPublishResult> {
  const { siteUrl, accessToken } = credentials;
  
  // Determine if using WordPress.com or self-hosted
  const isWordPressCom = siteUrl.includes('wordpress.com');
  const apiUrl = isWordPressCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/posts`
    : `${siteUrl}/wp-json/wp/v2/posts`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: article.title,
      content: article.content,
      slug: article.slug,
      status: article.status,
      excerpt: article.excerpt || '',
      // Add categories and tags if needed
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${errorText}`);
  }
  
  const post = await response.json();
  
  // Upload featured image if provided
  if (article.featuredImage) {
    try {
      await uploadFeaturedImage(credentials, post.id, article.featuredImage, isWordPressCom);
    } catch (error) {
      console.error('Failed to upload featured image:', error);
      // Don't fail the whole publish if image upload fails
    }
  }
  
  return {
    id: post.id,
    url: post.link || post.guid?.rendered || siteUrl,
  };
}

/**
 * Upload featured image to WordPress
 */
async function uploadFeaturedImage(
  credentials: WordPressCredentials,
  postId: number,
  imageUrl: string,
  isWordPressCom: boolean
): Promise<void> {
  const { siteUrl, accessToken } = credentials;
  
  try {
    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine file extension
    const ext = contentType.split('/')[1] || 'jpg';
    const filename = `featured-image-${Date.now()}.${ext}`;
    
    // Upload to WordPress
    const uploadUrl = isWordPressCom
      ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/media`
      : `${siteUrl}/wp-json/wp/v2/media`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: imageBuffer,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Failed to upload featured image:', errorText);
      return;
    }
    
    const media = await uploadResponse.json();
    
    // Set as featured image
    const updateUrl = isWordPressCom
      ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/posts/${postId}`
      : `${siteUrl}/wp-json/wp/v2/posts/${postId}`;

    await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        featured_media: media.id,
      }),
    });
  } catch (error) {
    console.error('Error in uploadFeaturedImage:', error);
    throw error;
  }
}

/**
 * Update existing WordPress post
 */
export async function updateWordPressPost(
  credentials: WordPressCredentials,
  postId: number,
  article: Partial<WordPressArticle>
): Promise<WordPressPublishResult> {
  const { siteUrl, accessToken } = credentials;
  
  const isWordPressCom = siteUrl.includes('wordpress.com');
  const apiUrl = isWordPressCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/posts/${postId}`
    : `${siteUrl}/wp-json/wp/v2/posts/${postId}`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(article.title && { title: article.title }),
      ...(article.content && { content: article.content }),
      ...(article.slug && { slug: article.slug }),
      ...(article.status && { status: article.status }),
      ...(article.excerpt && { excerpt: article.excerpt }),
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${errorText}`);
  }
  
  const post = await response.json();
  
  return {
    id: post.id,
    url: post.link || post.guid?.rendered || siteUrl,
  };
}

/**
 * Delete WordPress post
 */
export async function deleteWordPressPost(
  credentials: WordPressCredentials,
  postId: number
): Promise<void> {
  const { siteUrl, accessToken } = credentials;
  
  const isWordPressCom = siteUrl.includes('wordpress.com');
  const apiUrl = isWordPressCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/posts/${postId}`
    : `${siteUrl}/wp-json/wp/v2/posts/${postId}`;
  
  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${errorText}`);
  }
}

/**
 * Test WordPress connection
 */
export async function testWordPressConnection(
  siteUrl: string,
  accessToken: string
): Promise<{ success: boolean; siteName?: string; error?: string }> {
  try {
    const isWordPressCom = siteUrl.includes('wordpress.com');
    const testUrl = isWordPressCom
      ? `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(siteUrl)}`
      : `${siteUrl}/wp-json/wp/v2/users/me`;

    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Connection failed: ${response.status}`,
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      siteName: data.name || data.title || 'WordPress Site',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get WordPress site categories
 */
export async function getWordPressCategories(
  credentials: WordPressCredentials
): Promise<Array<{ id: number; name: string; slug: string }>> {
  const { siteUrl, accessToken } = credentials;
  
  const isWordPressCom = siteUrl.includes('wordpress.com');
  const apiUrl = isWordPressCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/categories`
    : `${siteUrl}/wp-json/wp/v2/categories`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  
  const categories = await response.json();
  return categories.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
  }));
}

/**
 * Get WordPress site tags
 */
export async function getWordPressTags(
  credentials: WordPressCredentials
): Promise<Array<{ id: number; name: string; slug: string }>> {
  const { siteUrl, accessToken } = credentials;
  
  const isWordPressCom = siteUrl.includes('wordpress.com');
  const apiUrl = isWordPressCom
    ? `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(siteUrl)}/tags`
    : `${siteUrl}/wp-json/wp/v2/tags`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.status}`);
  }
  
  const tags = await response.json();
  return tags.map((tag: any) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
  }));
}
