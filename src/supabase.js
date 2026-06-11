import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
}

// Diagnostic fetch wrapper — logs exactly which header contains a bad character
const safeFetch = async (input, init) => {
  if (init?.headers) {
    const headers = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : init.headers;
    for (const [k, v] of Object.entries(headers)) {
      for (let i = 0; i < (v||"").length; i++) {
        if (v.charCodeAt(i) > 255) {
          console.error(`BAD HEADER [${k}] char at ${i}: U+${v.charCodeAt(i).toString(16)} = "${v.slice(Math.max(0,i-10), i+10)}"`);
        }
      }
    }
  }
  return fetch(input, init);
};

export const supabase = createClient(url, key, { global: { fetch: safeFetch } });
