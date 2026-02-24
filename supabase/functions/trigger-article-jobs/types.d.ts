// Type declaration for Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Type declaration for @supabase/supabase-js
declare module "https://esm.sh/@supabase/supabase-js" {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, any>
  ): any;
  export type SupabaseClient = any;
}

// Type declaration for Deno's serve function
declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}