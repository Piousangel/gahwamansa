-- 0057 되돌리기(수동). purge_expired_data를 0043 정의로, user_delete_core(uuid)를 0054 정의로 다시 실행한 뒤 아래를 실행한다.
-- 되돌리면 방침 4절·삭제 안내 2절의 "90일 뒤 자동으로 지웁니다"(P21)가 지켜지지 않는다 — 방침을 함께 되돌려야 한다.
drop function if exists public.purge_stale_anonymous(timestamptz);
drop function if exists public.stale_anonymous_users(timestamptz, int);
drop function if exists public.user_delete_core(uuid, text);
drop function if exists public.stale_anon_days();
