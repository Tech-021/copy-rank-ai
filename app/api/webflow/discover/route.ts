import { NextResponse } from 'next/server';

// Discovery endpoint deprecated: discovery via API is unreliable / unsupported for site-scoped tokens.
export async function POST() {
  return NextResponse.json({ error: 'Site discovery removed. Provide the exact Site ID from Webflow Project Settings → General → Site ID, or use a Personal Access Token with site-level scopes.' }, { status: 410 });
}