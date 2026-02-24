// Webflow publishing integration

interface WebflowConnection {
  siteId: string;
  collectionId?: string;
  apiKey: string;
}

export function isWebflowConfigured() {
  return Boolean(process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_SITE_ID);
}

// Create a minimal 'Articles' collection if the site has none. Returns the created collection object.
  async function createCollectionIfMissing(siteId: string, webflow: any) {
    // Use the documented high-level create API shape
    // Note: do NOT attempt to create a custom Slug field — Webflow provides a built-in slug.
    const payload = {
      displayName: 'Articles',
      singularName: 'Article',
      slug: 'articles',
      fields: [
        { isRequired: true, type: 'PlainText', displayName: 'Title', helpText: 'Article title' },
        { isRequired: false, type: 'RichText', displayName: 'Content', helpText: 'Main article content' },
        { isRequired: false, type: 'PlainText', displayName: 'Excerpt', helpText: 'Short excerpt or summary' }
      ]
    } as any;

    try {
      if (!webflow.collections || typeof webflow.collections.create !== 'function') {
        const e: any = new Error('The installed webflow client does not support creating collections. Upgrade the SDK.');
        e.hint = 'Upgrade `webflow-api` to a version that exposes `collections.create`.';
        throw e;
      }

      console.log('[webflow] creating Articles collection on site:', siteId);
      const created = await webflow.collections.create(siteId, payload);

      // Normalize created collection object
      const createdObj = created || (created?.data ? created.data : null) || (created?.collection ? created.collection : null);
      if (!createdObj) {
        const e: any = new Error('Collection creation returned unexpected response');
        e.hint = 'Unexpected response creating collection.';
        throw e;
      }

      console.log('[webflow] created collection (raw):', createdObj._id || createdObj.id || createdObj.collectionId || createdObj);
      // Fetch full collection details (fields) because create responses sometimes omit schema
      try {
        const createdId = createdObj._id || createdObj.id || createdObj.collectionId || createdObj._cid || createdObj.cid;
        if (createdId) {
          const detailsRes = await webflow.client.get(`/collections/${createdId}`);
          const details = detailsRes?.data || detailsRes || null;
          if (details) {
            // normalize and attach fields
            const fields = details.fields || details?.collection?.fields || details?.data?.fields || [];
            createdObj.fields = fields;
            console.log('[webflow] fetched created collection details; fields count:', (fields || []).length);
          } else {
            console.warn('[webflow] created collection details fetch returned unexpected shape:', detailsRes);
          }
        }
      } catch (fetchErr: any) {
        console.warn('[webflow] failed to fetch created collection details:', fetchErr?.message || fetchErr);
      }

      return createdObj;
    } catch (e: any) {
      const err: any = new Error('Failed to create collection on Webflow site');
      // Surface Webflow's response message when available to help debugging
      if (e && e.response && e.response.data) {
        err.status = e.response.status;
        err.body = e.response.data;
        const remoteMsg = e.response.data?.message || e.response.data?.error || JSON.stringify(e.response.data);
        err.message = `Failed to create collection on Webflow site: ${remoteMsg}`;
        // Add targeted hint for common validation errors
        if (typeof remoteMsg === 'string' && remoteMsg.toLowerCase().includes('invalid field type')) {
          err.hint = `${remoteMsg}. Do not include a custom 'Slug' field; Webflow provides a built-in slug field. Adjust the collection schema and try again.`;
        } else {
          err.hint = 'Collection creation failed. The token may lack `collections:write` permission or the site plan may not support adding collections.';
        }
      } else if (e && e.status) {
        err.status = e.status;
        err.body = e.body || e.message || null;
      } else {
        err.hint = 'Collection creation failed for an unknown reason.';
      }
      console.error('[webflow] createCollectionIfMissing error:', e?.message || e);
      throw err;
    }
  }

// NOTE: site discovery helpers removed due to Webflow API limitations and changed behaviors.
// Use explicit Site ID (from Webflow Project Settings → General → Site ID) when adding a connection.

export async function validateSiteAccess(apiKey: string, siteIdOrSlug: string) {
  // Use the official webflow-api client exclusively for validation. If it's not installed, return a clear error.
  let WebflowClient: any;
  try {
    const mod = await import('webflow-api');
    WebflowClient = (mod as any).WebflowClient || (mod as any).default || (mod as any);
  } catch (imErr: any) {
    const e: any = new Error('Missing dependency: `webflow-api` is required to validate Webflow site access. Install with `pnpm add webflow-api`.');
    e.hint = 'Install webflow-api to enable site validation on the server.';
    throw e;
  }

  const webflow = new WebflowClient({ accessToken: apiKey });

  // Ensure high-level helpers exist (we require them for simplicity)
  if (!webflow.sites || typeof webflow.sites.list !== 'function' || !webflow.collections || typeof webflow.collections.list !== 'function') {
    const e: any = new Error('Installed `webflow-api` does not expose the expected high-level helpers (sites.list, collections.list). Upgrade to a recent stable version.');
    e.hint = 'Upgrade `webflow-api` to a version that exposes high-level helpers (e.g., v3.x or later).';
    throw e;
  }
 
  // Helper to list collections for a site
  async function tryListCollections(siteId: string) {
    try {
      // `collections.list` accepts the site id string in the latest client
      return await webflow.collections.list(siteId);
    } catch (e: any) {
      const err: any = new Error(`Failed to list collections for site ${siteId}`);
      if (e && e.response) {
        err.status = e.response.status;
        err.body = e.response.data;
        err.headers = e.response.headers;
      } else if (e && e.status) {
        // some errors may surface differently
        err.status = e.status;
        err.body = e.body || e.message || null;
      }

      // Heuristics for common 400 validation scenarios
      if (err.status === 400) {
        const body = err.body;
        const maybeMsg = body?.msg || body?.message || body?.name || body?.error;
        if (maybeMsg && typeof maybeMsg === 'string' && maybeMsg.includes('Provided IDs are invalid')) {
          err.hint = 'The provided Site ID looks invalid. Use the machine Site ID from Webflow Project Settings → General → Site ID (a 24-character hex ID), not the site slug or domain. Also ensure the token has `collections:read` and `sites:read` scopes.';
        } else {
          err.hint = 'Webflow returned 400 when listing collections. Check that the Site ID is the machine Site ID and that the token has `collections:read` and `sites:read` scopes.';
        }
      }
      throw err;
    }
  }

 

  // Prefer verifying the token by listing sites first (per webflow docs); this is clearer for account-level tokens
  try {
    console.log('[webflow] sites.list() - attempting to list sites for token; siteIdOrSlug=', typeof siteIdOrSlug === 'string' ? (siteIdOrSlug.length > 64 ? siteIdOrSlug.slice(0,64) + '...' : siteIdOrSlug) : siteIdOrSlug);
    const sitesRes = await webflow.sites.list();
    const sites = Array.isArray(sitesRes) ? sitesRes : (Array.isArray(sitesRes?.sites) ? sitesRes.sites : []);
    console.log('[webflow] sites.list() - normalized sites count:', sites.length);
    const normalized = (siteIdOrSlug || '').toString().toLowerCase();

    // Use the first site returned by sites.list() as the canonical site for validation when available
    if (sites.length > 0) {
      const first = sites[0];
      const resolvedFirst = first._id || first.id;
      console.log('[webflow] using first site from sites.list():', resolvedFirst, first.displayName || first.name || first.shortName || '(no name)');
      try {
        await tryListCollections(resolvedFirst);
        return resolvedFirst;
      } catch (firstErr: any) {
        console.warn('[webflow] collections.list() failed for first site:', resolvedFirst, firstErr?.message || firstErr);
        // If collection listing for the first site failed, fall back to attempting to match the provided identifier in the full list
      }
    }

    const found = (sites || []).find((s: any) => {
      try {
        const id = (s._id || s.id || '').toString().toLowerCase();
        if (id === normalized) return true;
        if ((s.slug || '').toString().toLowerCase() === normalized) return true;
        if ((s.name || '').toString().toLowerCase().includes(normalized)) return true;
        const domains = (s.domains || []).map((d: any) => (d || '').toString().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''));
        if (domains.includes(normalized)) return true;
      } catch (e) {
        // ignore
      }
      return false;
    });

    if (found) {
      const resolved = found._id || found.id;
      // Verify we can list collections for the resolved site id
      await tryListCollections(resolved);
      return resolved;
    }

    // If the site wasn't found in the list, return a helpful error
    const e: any = new Error('Site not found for the provided token');
    e.hint = 'The Site ID does not match any sites accessible by this token. Verify you used the machine Site ID and that the token has `sites:read` scope.';
    throw e;
  } catch (sitesErr: any) {
    console.error('[webflow] sites.list() failed:', sitesErr?.message || sitesErr);
    // If sites.list failed (e.g., site-scoped tokens without sites:read), try validating by listing collections directly for the provided site id
    try {
      await tryListCollections(siteIdOrSlug);
      return siteIdOrSlug;
    } catch (collErr: any) {
      // Combine diagnostics and return a clear validation error with richer context
      const err: any = new Error(`Site validation failed: ${collErr?.message || sitesErr?.message || 'unknown error'}`);
      err.hint = collErr.hint || sitesErr?.hint || 'Ensure the Site ID is correct and the token has either `sites:read` (account tokens) or `collections:read` (site tokens) scope.';
      err.status = collErr?.status ?? sitesErr?.status ?? undefined;
      err.body = collErr?.body ?? sitesErr?.body ?? undefined;
      // Include minimal raw errors for debugging (avoid exposing full stack traces)
      err.raw = {
        sitesError: sitesErr?.message || (sitesErr && typeof sitesErr === 'object' ? JSON.stringify(sitesErr) : sitesErr),
        collectionsError: collErr?.message || (collErr && typeof collErr === 'object' ? JSON.stringify(collErr) : collErr),
      };
      throw err;
    }
  }
}

export async function publishArticleToWebflow(article: any, connection?: WebflowConnection) {
  const apiKey = connection?.apiKey || process.env.WEBFLOW_API_TOKEN;
  const siteId = connection?.siteId || process.env.WEBFLOW_SITE_ID;
  const collectionOverride = connection?.collectionId;

  if (!apiKey || !siteId) {
    throw new Error('Webflow not configured (missing site id or API token)');
  }

  // Use high-level webflow-api client for site & collection operations
  let webflow: any;
  try {
    const mod = await import('webflow-api');
    const WebflowClient = (mod as any).WebflowClient || (mod as any).default || (mod as any);
    webflow = new WebflowClient({ accessToken: apiKey });
  } catch (imErr: any) {
    const e: any = new Error('Missing dependency: `webflow-api` is required for Webflow operations. Install with `pnpm add webflow-api`.');
    e.hint = 'Install webflow-api to enable publishing via Webflow.';
    throw e;
  }

  if (!webflow.collections || typeof webflow.collections.list !== 'function') {
    throw new Error('Installed `webflow-api` does not expose high-level collection helpers. Upgrade to a recent stable version.');
  }

  // Discover collections for the site
  let collections: any[] = [];
  try {
    const raw = await webflow.collections.list(siteId);
    // Normalize response: SDK may return an array or an object { collections: [...] }
    if (Array.isArray(raw)) {
      collections = raw;
    } else if (Array.isArray(raw?.collections)) {
      collections = raw.collections;
    } else if (Array.isArray((raw as any)?.data)) {
      // some SDKs put data in `data`
      collections = (raw as any).data;
    } else {
      // Unexpected shape — log for debugging and attempt to coerce
      console.warn('[webflow] collections.list() returned unexpected shape:', Object.keys(raw || {}));
      collections = [];
    }

    console.log('[webflow] collections normalized count:', collections.length);

    // If there are no collections, attempt to auto-create an Articles collection
    if ((!collections || collections.length === 0)) {
      console.log('[webflow] no collections found, attempting to auto-create Articles collection');
      const created = await createCollectionIfMissing(siteId, webflow);
      const createdId = created?._id || created?.id || created?.collectionId || null;
      if (createdId) {
        collections = [created];
        // attach createdCollectionId to the outer scope by returning it later in result
        (collections as any)._createdCollectionId = createdId;
        console.log('[webflow] auto-created collection id:', createdId);
      }
    }
  } catch (err: any) {
    const msg = err?.message || JSON.stringify(err?.body || err || {});
    const e: any = new Error(`Failed to fetch Webflow collections: ${msg}`);
    e.status = err?.status;
    e.body = err?.body ?? null;
    e.hint = 'Ensure the Site ID is correct and the token has `collections:read` scope.';
    throw e;
  }

  // Auto-discover an "Articles" collection by name or slug
  let collection: any | undefined;
  if (collectionOverride) {
    collection = collections.find((c: any) => c._id === collectionOverride || c.collectionId === collectionOverride || c.id === collectionOverride);
  }

  if (!collection) {
    collection = collections.find((c: any) => {
      const name = (c.name || '').toString().toLowerCase();
      const slug = (c.slug || '').toString().toLowerCase();
      return name === 'articles' || slug === 'articles' || name.includes('article') || slug.includes('article');
    });
  }

  if (!collection) {
    // If there's only one collection, choose it as a last resort
    if (collections.length === 1) collection = collections[0];
  }

  if (!collection) {
    throw new Error('Could not find a CMS collection on the Webflow site. Ensure a collection named "Articles" exists or specify a collection id in the connection.');
  }

  const collectionId = collection._id || collection.id || collection.collectionId;

  // Build a slug
  const slug = (article.slug || article.title || 'article')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 120);

  // Simplified publish flow: create/update using live endpoint with minimal fieldData (name & slug required)
  const fieldData: any = {
    name: article.title || 'Untitled',
    slug,
    content: article.content || article.body || '',
    excerpt: article.preview || article.meta_description || ''
  };

  // Ensure collectionId is present; require explicit configuration to avoid discovery issues
  if (!collectionId) {
    throw new Error('Collection ID is required to publish to Webflow. Please provide a collectionId in your connection.');
  }

  // Find existing item by slug
  let existingItem: any = null;
  // small safe stringifier to avoid huge logs
  const safe = (o: any, max = 800) => {
    try {
      const s = JSON.stringify(o);
      return s.length > max ? s.slice(0, max) + '...' : s;
    } catch (e) {
      return String(o);
    }
  };

  try {
    console.log('[webflow] fetching collection items', { collectionId, slugPreview: slug.slice(0, 64) });
    const res = await webflow.client.get(`/collections/${collectionId}/items?limit=100`);
    const itemsRes = res?.data || res;
    const allItems = Array.isArray(itemsRes?.items) ? itemsRes.items : (Array.isArray(itemsRes) ? itemsRes : []);
    console.log('[webflow] fetched items count for collection:', (allItems || []).length);
    existingItem = allItems.find((it: any) => (it.slug || '').toString().toLowerCase() === slug.toLowerCase());
    if (existingItem) console.log('[webflow] found existing item', { id: existingItem._id || existingItem.id || existingItem._cid, slug: existingItem.slug });
  } catch (err) {
    console.warn('[webflow] failed to fetch collection items (will attempt create):', err || err);
  }

  let createdOrUpdated: any = null;
  try {
    if (existingItem) {
      const itemId = existingItem._id || existingItem._cid || existingItem.id;
      console.log('[webflow] publishing - updating existing item', { collectionId, itemId, fieldDataKeys: Object.keys(fieldData) });
      if (webflow.collections?.items?.updateItemLive && typeof webflow.collections.items.updateItemLive === 'function') {
        // Use documented shape: body must contain `fieldData` (no isArchived/isDraft at top-level)
        const req = { skipInvalidFiles: true, body: { fieldData } };
        console.log('[webflow] calling updateItemLive request:', safe({ collectionId, itemId, body: fieldData }));
        const res = await webflow.collections.items.updateItemLive(collectionId, itemId, req);
        createdOrUpdated = res?.data || res || null;
        console.log('[webflow] updateItemLive response:', safe(createdOrUpdated));
      } else {
        console.log('[webflow] calling updateItem request:', safe({ collectionId, itemId, body: fieldData }));
        createdOrUpdated = await webflow.collections.items.updateItem(collectionId, itemId, { fieldData });
        console.log('[webflow] updateItem response:', safe(createdOrUpdated));
      }
    } else {
      console.log('[webflow] publishing - creating new item', { collectionId, fieldDataKeys: Object.keys(fieldData) });
      if (webflow.collections?.items?.createItemLive && typeof webflow.collections.items.createItemLive === 'function') {
        // Use documented shape: body must contain `fieldData` (no isArchived/isDraft at top-level)
        const req = { skipInvalidFiles: true, body: { fieldData } };
        console.log('[webflow] calling createItemLive request:', safe({ collectionId, body: fieldData }));
        try {
          const res = await webflow.collections.items.createItemLive(collectionId, req);
          createdOrUpdated = res?.data || res || null;
          console.log('[webflow] createItemLive response:', safe(createdOrUpdated));
        } catch (liveErr: any) {
          console.warn('[webflow] createItemLive failed, attempting v2 bulk items fallback:', liveErr?.message || liveErr);
          const remoteBody = liveErr?.body || liveErr?.response?.data || null;
          // If validation error, try the v2 bulk endpoint which accepted the working shape
          try {
            const path = `/collections/${collectionId}/items/bulk?skipInvalidFiles=true`;
            const payload = { fieldData, cmsLocaleIds: [], isArchived: false, isDraft: false };
            console.log('[webflow] fallback POST to v2 bulk endpoint:', path, safe(payload, 2000));
            const fallbackRes = await webflow.client.post(path, payload);
            createdOrUpdated = fallbackRes?.data || fallbackRes || null;
            console.log('[webflow] bulk endpoint response:', safe(createdOrUpdated));
          } catch (fallbackErr: any) {
            console.error('[webflow] fallback bulk endpoint failed:', fallbackErr?.message || fallbackErr);
            // Re-throw the original live error with added diagnostics
            const e: any = new Error(`createItemLive failed and bulk fallback failed: ${liveErr?.message || liveErr}`);
            e.status = liveErr?.status ?? liveErr?.response?.status;
            e.body = remoteBody || fallbackErr?.body || fallbackErr?.response?.data || null;
            e.hint = 'createItemLive failed; attempted v2 bulk fallback which also failed. Inspect the returned bodies for details.';
            throw e;
          }
        }
      } else {
        console.log('[webflow] calling createItem request:', safe({ collectionId, body: fieldData }));
        createdOrUpdated = await webflow.collections.items.createItem(collectionId, { fieldData });
        console.log('[webflow] createItem response:', safe(createdOrUpdated));
      }
    }

    if (createdOrUpdated && createdOrUpdated.data) {
      console.log('[webflow] normalizing createdOrUpdated.data');
      createdOrUpdated = createdOrUpdated.data;
    }

    if (createdOrUpdated) console.log('[webflow] item created/updated summary', { id: createdOrUpdated._id || createdOrUpdated.id || createdOrUpdated._cid, slug: createdOrUpdated.slug });
  } catch (err: any) {
    const remoteBody = err?.body || err?.response?.data || null;
    const msg = err?.message || (remoteBody && (remoteBody.message || JSON.stringify(remoteBody))) || String(err);
    const e: any = new Error(`Failed to create/update Webflow item: ${msg}`);
    e.status = err?.status ?? err?.response?.status;
    e.body = remoteBody;
    e.hint = 'Verify the collection has `name` and `slug` fields and that the token has `collections:write` scope.';
    console.error('[webflow] create/update error:', { message: msg, status: e.status, body: safe(remoteBody, 2000) });
    throw e;
  }

  // Attempt to publish the site so the item is live
  try {
    const itemId = createdOrUpdated?._id || createdOrUpdated?.id || createdOrUpdated?._cid;
    if (webflow.collections?.items?.publishItem && typeof webflow.collections.items.publishItem === 'function') {
      await webflow.collections.items.publishItem({ collectionId, itemId });
    } else if (webflow.sites && typeof webflow.sites.publish === 'function') {
      try {
        await webflow.sites.publish({ siteId });
      } catch (e) {
        // ignore
      }
    }
  } catch (err: any) {
    console.warn('Webflow publish failed (non-fatal):', err?.message || err);
  }

  // Try to build public URL using site domains or fallback to environment site URL
  let webflowUrl: string | null = null;
  try {
    const sitesRes = await webflow.sites.list();
    const sites = Array.isArray(sitesRes) ? sitesRes : (Array.isArray(sitesRes?.sites) ? sitesRes.sites : []);
    console.log('[webflow] sites.list() - normalized sites count (for URL building):', sites.length);
    const siteInfo = (sites || []).find((s: any) => (s._id || s.id) === siteId || (s._id || s.id) === siteId);
    const domain = (siteInfo?.domains || [])?.[0] || siteInfo?.defaultDomain || siteInfo?.domain || null;
    if (domain) {
      const base = domain.replace(/\/$/, '').replace(/^https?:\/\//, '');
      const path = (collection.path || '').replace(/^\//, '') || '';
      const prefix = path ? `/${path}` : '';
      webflowUrl = `https://${base}${prefix}/${slug}`.replace(/\/\/+/, '/').replace('https:/', 'https://');
    }
  } catch (err) {
    // ignore
  }

  // Fallback to any known site url env var
  if (!webflowUrl) {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || null;
    if (fallback) {
      const normalized = fallback.replace(/\/$/, '');
      webflowUrl = `${normalized}/${slug}`;
    }
  }

  return {
    webflowItemId: createdOrUpdated?.id || createdOrUpdated?.slug || createdOrUpdated?._id || null,
    webflowUrl,
    publishResult: createdOrUpdated,
    createdCollectionId: (collections as any)?._createdCollectionId || null,
  };
}

/* Simplified, safe publisher using `createItems` (no hard-coded secrets).
   Reads API token and collectionId from `connection` or env vars. */
export async function publishArticleToWebflowCreateItems(article: any, connection?: WebflowConnection) {
  const apiKey = connection?.apiKey || process.env.WEBFLOW_API_TOKEN;
  const collectionId = connection?.collectionId || process.env.WEBFLOW_COLLECTION_ID;

  if (!apiKey) throw new Error('Missing Webflow API token (set on connection or in WEBFLOW_API_TOKEN).');
  if (!collectionId) throw new Error('Missing Webflow collection id (set on connection.collectionId or WEBFLOW_COLLECTION_ID).');

  const fieldData: any = {
    name: article.title || 'Untitled',
    slug: (article.slug || article.title || 'article').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 120),
    title: article.title || 'Untitled',
    content: article.content || article.body || '',
  };

  let WebflowClient: any;
  try {
    const mod = await import('webflow-api');
    WebflowClient = (mod as any).WebflowClient || (mod as any).default || (mod as any);
  } catch (e: any) {
    const err: any = new Error('Missing dependency: `webflow-api` is required to publish. Install with `pnpm add webflow-api`.');
    err.hint = 'Install webflow-api to enable publishing via Webflow.';
    throw err;
  }

  const client = new WebflowClient({ accessToken: apiKey });

  try {
    console.log('[webflow] createItems call', { collectionId, fieldDataKeys: Object.keys(fieldData) });
    const result = await client.collections.items.createItems(collectionId, {
      skipInvalidFiles: true,
      cmsLocaleIds: [],
      isArchived: false,
      isDraft: false,
      fieldData,
    });

    console.log('[webflow] createItems result:', result);

    const normalized = result?.data || result || null;
    return {
      webflowItemId: normalized?.id || normalized?._id || null,
      publishResult: normalized,
    };
  } catch (err: any) {
    const remoteBody = err?.response?.data || err?.body || null;
    const msg = err?.message || (remoteBody && (remoteBody.message || JSON.stringify(remoteBody))) || String(err);
    const e: any = new Error(`Failed to create items via Webflow: ${msg}`);
    e.status = err?.status ?? err?.response?.status;
    e.body = remoteBody;
    e.hint = 'Verify token permissions and that the collection exists and accepts the provided fields.';
    console.error('[webflow] createItems error:', { message: msg, status: e.status, body: remoteBody });
    throw e;
  }
}

export async function publishArticleIfConfigured(article: any) {
  if (!isWebflowConfigured()) return null;
  try {
    return await publishArticleToWebflowCreateItems(article);
  } catch (err) {
    console.error('Webflow publish error:', err);
    return null;
  }
}