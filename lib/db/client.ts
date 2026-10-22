// Supabase 접속 (서버 전용). 서비스 키는 모든 보안을 우회하므로 브라우저 코드에서 import하지 않는다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "../env";

let cached: SupabaseClient | undefined;

export function getDb(): SupabaseClient {
  cached ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Supabase 오류는 메시지만 담아 던진다 (요청 내용이나 키는 담지 않는다)
export function dbError(action: string, error: { message: string }): Error {
  return new Error(`저장소 오류 (${action}): ${error.message}`);
}
