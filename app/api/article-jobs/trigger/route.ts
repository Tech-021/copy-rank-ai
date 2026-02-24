import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // Check authentication using JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check subscription status (log for debugging but do not block processing here)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('subscribe')
      .eq('id', user.id)
      .single();

    console.log(`Trigger called by user ${user.id} - subscribe flag:`, userData?.subscribe);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Trigger processing and return the process response for visibility
    console.log(`Article-jobs trigger invoked by user ${user.id}, calling ${baseUrl}/api/article-jobs/process`);
    try {
      const procRes = await fetch(`${baseUrl}/api/article-jobs/process`, {
        method: 'POST',
      });
      const procJson = await procRes.json().catch(() => null);
      console.log('Process response:', procRes.status, procJson);

      return NextResponse.json({
        success: true,
        message: 'Article processing triggered',
        processStatus: procRes.status,
        processResult: procJson,
      });
    } catch (err) {
      console.error('Error triggering job processing:', err);
      return NextResponse.json({ error: 'Failed to trigger processing' }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in trigger endpoint:", error);
    return NextResponse.json(
      { error: "Failed to trigger processing" },
      { status: 500 }
    );
  }
}

