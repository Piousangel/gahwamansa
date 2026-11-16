export type AppConfig = {SUPABASE_URL: string; SUPABASE_KEY: string};

// config.local.ts 가 없으면(try/catch) 에러 메시지로 안내한다. 값은 코드에 하드코딩하지 않는다.
export function loadConfig(): AppConfig {
  let local: Partial<AppConfig> | undefined;
  try {
    local = require('./config.local').default;
  } catch {
    local = undefined;
  }
  if (!local?.SUPABASE_URL || !local?.SUPABASE_KEY) {
    throw new Error(
      'src/lib/config.local.ts 가 없거나 비어 있어요. config.local.example.ts 를 복사해 SUPABASE_URL, SUPABASE_KEY 를 채워 주세요.',
    );
  }
  return {SUPABASE_URL: local.SUPABASE_URL, SUPABASE_KEY: local.SUPABASE_KEY};
}
