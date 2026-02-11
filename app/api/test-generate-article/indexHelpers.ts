export function buildArticleUrl(baseSiteUrl: string, slug: string): string {
  const normalizedBase = baseSiteUrl.replace(/\/$/, "");
  const basePath = process.env.ARTICLE_BASE_PATH || "/articles";
  const normalizedPath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return `${normalizedBase}${normalizedPath}/${slug}`;
}

export async function pingIndexNow(urlList: string[], siteUrl: string) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.warn("⚠️ INDEXNOW_KEY missing; skipping IndexNow ping");
    return;
  }

  const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `${siteUrl.replace(/\/$/, "")}/${key}.txt`;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: new URL(siteUrl).host,
        key,
        keyLocation,
        urlList,
      }),
    });

    if (!res.ok) {
      console.warn("⚠️ IndexNow ping failed:", res.status, await res.text());
    } else {
      console.log("🔔 IndexNow pinged for URLs:", urlList);
    }
  } catch (err) {
    console.warn("⚠️ IndexNow ping error:", err);
  }
}
