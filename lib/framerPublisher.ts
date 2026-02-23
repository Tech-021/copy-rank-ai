export function isFramerConfigured() {
  return Boolean(process.env.FRAMER_API_KEY && process.env.FRAMER_PROJECT_URL);
}

interface FramerConnection {
  projectUrl: string;
  apiKey: string;
}

export async function publishArticleToFramer(article: any, connection?: FramerConnection) {
  // If no connection provided, fall back to global env
  const projectUrl = connection?.projectUrl || process.env.FRAMER_PROJECT_URL;
  const apiKey = connection?.apiKey || process.env.FRAMER_API_KEY;

  if (!projectUrl || !apiKey) {
    throw new Error('Framer not configured (missing project URL or API key).');
  }

  // Connect to Framer (dynamic import so app still runs when package isn't installed locally)
  const framerModule = await import('framer-api');
  let framer = await framerModule.connect(projectUrl, apiKey as any);

  // Helper: reconnect the client
  async function reconnectFramer() {
    try {
      await framer.disconnect();
    } catch (e) {
      // ignore
    }
    framer = await framerModule.connect(projectUrl, apiKey as any);
  }

  // Helper: safe project info fetch with retries and reconnection on internal errors
  async function safeGetProjectInfo(attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await framer.getProjectInfo();
      } catch (err: any) {
        const msg = (err?.message || '').toString();
        const isNoConnection = msg.includes('No connection') || err?.code === 'INTERNAL';
        console.warn(`Framer getProjectInfo failed (attempt ${attempt + 1}/${attempts}): ${msg}`);
        if (isNoConnection) {
          try {
            await reconnectFramer();
            // small backoff before retrying
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
            continue;
          } catch (re) {
            // ignore, will retry
          }
        }
        // For other errors, wait a bit then retry
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw new Error('Failed to fetch Framer project info after retries');
  }

  // Helper: attempt to create managed collection with retries for transient errors
  async function safeCreateManagedCollection(name: string, attempts = 3) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await framer.createManagedCollection(name);
      } catch (err: any) {
        const msg = (err?.message || '').toString();
        const isNoConnection = msg.includes('No connection') || err?.code === 'INTERNAL';
        const alreadyExists = msg.toLowerCase().includes('already exists') || msg.includes('A collection with the name');
        console.warn(`Framer createManagedCollection failed (attempt ${attempt + 1}/${attempts}): ${msg}`);
        if (alreadyExists) throw err; // let caller handle the already-exists case (they will try discovery)
        if (isNoConnection) {
          try {
            await reconnectFramer();
          } catch (re) {
            // ignore
          }
        }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw new Error('Failed to create Framer managed collection after retries');
  }

  // Helper: add items with retries and reconnects
  async function safeAddItems(collection: any, items: any[], attempts = 4) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        if (collection.addItems) return await collection.addItems(items);
        if ((framer as any).addItemsToManagedCollection) return await (framer as any).addItemsToManagedCollection(collection.id, items);
        if ((framer as any).addItems) return await (framer as any).addItems(collection.id, items);
        throw new Error('Unable to add item to Framer managed collection: method not found');
      } catch (err: any) {
        const msg = (err?.message || '').toString();
        const isNoConnection = msg.includes('No connection') || err?.code === 'INTERNAL';
        console.warn(`Framer addItems failed (attempt ${attempt + 1}/${attempts}): ${msg}`);
        if (isNoConnection) {
          try {
            await reconnectFramer();
          } catch (re) {
            // ignore
          }
        }
        // Surface typia errors immediately so caller can inspect payload
        if (msg.includes('typia.createAssert')) throw err;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw new Error('Failed to add items to Framer managed collection after retries');
  }

  // Helper: publish & deploy, with retries for transient errors
  async function safePublishAndDeploy(attempts = 3) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const result: any = await framer.publish();
        if (result?.deployment?.id) {
          await framer.deploy(result.deployment.id);
        }
        return result;
      } catch (err: any) {
        const msg = (err?.message || '').toString();
        const isNoConnection = msg.includes('No connection') || err?.code === 'INTERNAL';
        console.warn(`Framer publish/deploy failed (attempt ${attempt + 1}/${attempts}): ${msg}`);
        if (isNoConnection) {
          try {
            await reconnectFramer();
          } catch (re) {
            // ignore
          }
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw new Error('Failed to publish/deploy on Framer after retries');
  }

  try {
    // Ensure there's an Articles managed collection. Try to create; if exists, find it.
    let collection: any = null;

    // Try to discover an existing "Articles" managed collection to avoid create races
    try {
      const info: any = await safeGetProjectInfo();
      const allCollections = [ ...(info?.managedCollections || []), ...(info?.collections || []) ];
      const existing = allCollections.find((c: any) => c.name === "Articles" || c.slug === "articles");
      if (existing) {
        collection = existing;
      }
    } catch (e) {
      // ignore discovery errors — we'll attempt create next
    }

    // If not found, attempt to create. Handle concurrent create races by retrying discovery if we get an "already exists" error.
    if (!collection) {
      try {
        collection = await safeCreateManagedCollection("Articles");
        // If created, provision standard fields we expect (ids chosen for easy mapping)
        if (collection.setFields) {
          await collection.setFields([
            { id: "title", type: "string", name: "Title" },
            { id: "slug", type: "string", name: "Slug" },
            { id: "content", type: "formattedText", name: "Content" },
            { id: "excerpt", type: "string", name: "Excerpt" },
          ]);
        }
      } catch (err: any) {
        const msg = (err?.message || "").toString();
        const alreadyExists = msg.toLowerCase().includes("already exists") || msg.includes("A collection with the name");
        if (alreadyExists) {
          // Race: another process created it. Retry discovery a few times with larger backoff using safeGetProjectInfo
          let found = null;
          for (let attempt = 0; attempt < 8 && !found; attempt++) {
            try {
              const info: any = await safeGetProjectInfo(8);
              const allCollections = [ ...(info?.managedCollections || []), ...(info?.collections || []) ];
              found = allCollections.find((c: any) => c.name === "Articles" || c.slug === "articles");
              if (found) {
                collection = found;
                break;
              }

              // Log what we saw on the last attempt to aid debugging
              if (attempt === 7) {
                console.warn('Framer discovery on final attempt saw collections:', {
                  managedCollections: (info?.managedCollections || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
                  collections: (info?.collections || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
                });
              }
            } catch (e) {
              // ignore
            }
            await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
          }
          if (!collection) {
            console.warn('Framer createManagedCollection reported already exists, but discovery failed after retries');

            // Try creating a fallback-named managed collection (avoid blocking publish)
            const timestamp = Date.now().toString(36);
            const altNames = [
              `Articles-copyrank`,
              `Articles-${timestamp}`,
              `Articles-copyrank-${Math.random().toString(36).slice(2,8)}`,
            ];
            let created: any = null;

            for (const alt of altNames) {
              try {
                created = await safeCreateManagedCollection(alt);
                if (created) {
                  collection = created;
                  console.warn(`Created fallback Framer collection '${alt}' because original 'Articles' was reported existing but not discoverable.`);
                  if (collection.setFields) {
                    await collection.setFields([
                      { id: "title", type: "string", name: "Title" },
                      { id: "slug", type: "string", name: "Slug" },
                      { id: "content", type: "formattedText", name: "Content" },
                      { id: "excerpt", type: "string", name: "Excerpt" },
                    ]);
                  }
                  break;
                }
              } catch (ce: any) {
                console.warn(`Fallback create '${alt}' failed: ${ce?.message || ce}`);
                // try next alt
              }
            }

            if (!collection) {
              try {
                const info: any = await safeGetProjectInfo(4);
                const allCollections = [ ...(info?.managedCollections || []), ...(info?.collections || []) ];
                const summary = (allCollections || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, hasFields: Boolean(c.fields) }));
                const e = new Error('Framer createManagedCollection reported already exists, but discovery failed after retries. Project collections: ' + JSON.stringify(summary));
                (e as any).raw = err;
                throw e;
              } catch (e2) {
                // If we couldn't fetch project info to enrich the error, rethrow original
                throw err;
              }
            }
          }
        } else {
          throw err;
        }
      }
    }

    // Build an item for the collection. We must use the FieldDataInput shape expected by Framer.
    const slug = (article.slug || article.title || "article")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 120);

    // Resolve collection fields so we can map names -> field ids
    let fields: any[] | undefined = undefined;
    if (collection.getFields) {
      try {
        fields = await collection.getFields();
      } catch (e) {
        // ignore
      }
    }

    // If we don't have fields from the ManagedCollection instance, try project info (both managedCollections and collections)
    if (!fields) {
      try {
        const info: any = await safeGetProjectInfo();
        const allCollections = [ ...(info?.managedCollections || []), ...(info?.collections || []) ];
        const existing = allCollections.find((c: any) => c.name === "Articles" || c.slug === "articles");
        fields = existing?.fields || undefined;

        if (!fields) {
          console.warn('Could not discover fields for Articles collection; project collections seen:', (allCollections || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, hasFields: Boolean(c.fields) })));
        }
      } catch (e) {
        // ignore
      }
    }

    // Helper to find a field by common name
    const findField = (name: string) => (fields || []).find((f: any) => (f.name || "").toString().toLowerCase() === name.toLowerCase() || (f.id || "").toString().toLowerCase() === name.toLowerCase());

    const titleField = findField("title");
    const slugField = findField("slug");
    const contentField = findField("content");
    const excerptField = findField("excerpt");

    const item: any = {
      id: article.id,
      slug,
      fieldData: {},
    };

    if (titleField) item.fieldData[titleField.id] = { type: "string", value: article.title || "Untitled" };
    if (slugField) item.fieldData[slugField.id] = { type: "string", value: slug };
    if (contentField) item.fieldData[contentField.id] = { type: "formattedText", value: article.content || "", contentType: "markdown" };
    if (excerptField) item.fieldData[excerptField.id] = { type: "string", value: article.preview || article.meta_description || "" };

    // If no fields were discovered, also include top-level fields to maximize compatibility (some older API versions accepted these)
    if (!(titleField || slugField || contentField || excerptField)) {
      item.title = article.title || "Untitled";
      item.content = article.content || "";
      item.excerpt = article.preview || article.meta_description || "";
    }

    // Add or update item(s) with safe retry logic
    try {
      await safeAddItems(collection, [item]);
    } catch (addErr: any) {
      // Surface more helpful error when Framer fails typia validation
      if (addErr?.message?.includes("typia.createAssert") || addErr?.message?.includes('validation')) {
        const ctx = {
          collection: (fields || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type })),
          attemptedItem: item,
          rawError: addErr?.message,
        };
        const e = new Error("Framer addItems validation failed: " + JSON.stringify(ctx, null, 2));
        (e as any).original = addErr;
        throw e;
      }
      throw addErr;
    }

    // Publish preview and deploy to production (MVP behavior) using safe wrapper
    const result: any = await safePublishAndDeploy();

    // Try to build public URL if hostnames returned. Accept string or object shapes for hostnames.
    const hostRaw = result?.hostnames?.[0] ?? null;
    let hostStr: string | null = null;
    if (typeof hostRaw === 'string') {
      hostStr = hostRaw;
    } else if (hostRaw && typeof hostRaw === 'object') {
      hostStr = hostRaw.hostname || hostRaw.host || hostRaw.url || hostRaw.address || null;
      if (!hostStr) {
        console.warn('Framer publish returned host object with unexpected shape:', hostRaw);
      }
    }
    if (hostStr) {
      hostStr = hostStr.replace(/\/$/, '');
      // If the host string doesn't include a protocol, assume HTTPS so window.open will use an absolute URL
      if (!/^https?:\/\//i.test(hostStr)) {
        hostStr = `https://${hostStr}`;
      }
    }
    const framerUrl = hostStr ? `${hostStr}/${slug}` : null;

    return {
      framerItemId: item.id,
      framerUrl,
      publishResult: result,
    };
  } finally {
    try {
      await framer.disconnect();
    } catch (err) {
      // ignore disconnect errors
    }
  }
}

export async function publishArticleIfConfigured(article: any) {
  if (!isFramerConfigured()) return null;
  try {
    return await publishArticleToFramer(article);
  } catch (err) {
    console.error("Framer publish error:", err);
    return null;
  }
}
