// WordPress Publishing Integration
// This file provides the core functionality to publish articles to WordPress sites

import crypto from 'crypto';

interface WordPressCredentials {
  url: string; // e.g., "https://example.com"
  username: string;
  applicationPassword: string; // WordPress application password
}

interface Article {
  title: string;
  content: string;
  slug: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  featuredImageUrl?: string;
  categories?: number[]; // WordPress category IDs
  tags?: number[]; // WordPress tag IDs
  status?: 'draft' | 'publish' | 'pending' | 'private';
}

interface WordPressPost {
  id: number;
  link: string;
  slug: string;
  status: string;
}

/**
 * Publish an article to WordPress using the REST API
 */
export async function publishToWordPress(
  credentials: WordPressCredentials,
  article: Article
): Promise<WordPressPost> {
  const { url, username, applicationPassword } = credentials;

  // Validate URL
  const baseUrl = url.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/posts`;

  // Create Basic Auth header
  const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

  console.log('Publishing to WordPress:', {
    url: baseUrl,
    username,
    title: article.title,
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content,
        slug: article.slug,
        excerpt: article.excerpt || '',
        status: article.status || 'draft',
        categories: article.categories || [],
        tags: article.tags || [],
        // Yoast SEO plugin meta (if installed)
        meta: {
          _yoast_wpseo_title: article.metaTitle || '',
          _yoast_wpseo_metadesc: article.metaDescription || '',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      console.error('WordPress API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
      });

      throw new Error(
        `WordPress API Error: ${response.status} - ${
          errorDetails?.message || errorText
        }`
      );
    }

    const post = await response.json();
    console.log('Successfully published to WordPress:', post.link);

    return {
      id: post.id,
      link: post.link,
      slug: post.slug,
      status: post.status,
    };
  } catch (error) {
    console.error('Failed to publish to WordPress:', error);
    throw error;
  }
}

/**
 * Update an existing WordPress post
 */
export async function updateWordPressPost(
  credentials: WordPressCredentials,
  postId: number,
  article: Partial<Article>
): Promise<WordPressPost> {
  const { url, username, applicationPassword } = credentials;
  const baseUrl = url.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;

  const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

  const response = await fetch(apiUrl, {
    method: 'POST', // WordPress uses POST for updates too
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({
      ...(article.title && { title: article.title }),
      ...(article.content && { content: article.content }),
      ...(article.slug && { slug: article.slug }),
      ...(article.excerpt && { excerpt: article.excerpt }),
      ...(article.status && { status: article.status }),
      ...(article.categories && { categories: article.categories }),
      ...(article.tags && { tags: article.tags }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update WordPress post: ${error}`);
  }

  return await response.json();
}

/**
 * Delete a WordPress post
 */
export async function deleteWordPressPost(
  credentials: WordPressCredentials,
  postId: number
): Promise<void> {
  const { url, username, applicationPassword } = credentials;
  const baseUrl = url.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;

  const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete WordPress post: ${error}`);
  }
}

/**
 * Test WordPress connection
 */
export async function testWordPressConnection(
  credentials: WordPressCredentials
): Promise<{ success: boolean; message: string }> {
  const { url, username, applicationPassword } = credentials;
  const baseUrl = url.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/users/me`;

  const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`,
      };
    }

    const user = await response.json();
    return {
      success: true,
      message: `Connected successfully as ${user.name}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Upload featured image to WordPress
 */
export async function uploadFeaturedImage(
  credentials: WordPressCredentials,
  imageUrl: string,
  postId: number
): Promise<number> {
  // 1. Fetch the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error('Failed to fetch image');
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

  // 2. Upload to WordPress
  const { url, username, applicationPassword } = credentials;
  const baseUrl = url.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/wp-json/wp/v2/media`;

  const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

  const uploadResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="featured-image.jpg"`,
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to WordPress');
  }

  const media = await uploadResponse.json();

  // 3. Set as featured image
  const updateResponse = await fetch(`${baseUrl}/wp-json/wp/v2/posts/${postId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({
      featured_media: media.id,
    }),
  });

  if (!updateResponse.ok) {
    throw new Error('Failed to set featured image');
  }

  return media.id;
}

/**
 * Encrypt WordPress credentials for storage
 */
export function encryptCredentials(credentials: string, encryptionKey: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(credentials, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt WordPress credentials from storage
 */
export function decryptCredentials(encrypted: string, encryptionKey: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
