-- 0040 되돌리기(수동). 게시한 콘텐츠·감사 행은 그대로 둔다(되돌리지 않음).
drop function if exists public.admin_publish_content(jsonb, text, text);
drop function if exists public.admin_retire_content(int, text, text);
