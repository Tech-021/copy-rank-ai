import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // Trigger processing (fire and forget)
    fetch(`${baseUrl}/api/article-jobs/process`, {
      method: 'POST',
    }).catch(error => {
      console.error("Error triggering job processing:", error);
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Article processing triggered" 
    });
  } catch (error) {
    console.error("Error in trigger endpoint:", error);
    return NextResponse.json(
      { error: "Failed to trigger processing" },
      { status: 500 }
    );
  }
}

