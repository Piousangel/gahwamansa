-- 0048 되돌리기(수동). record_terms_agreement·my_terms_status(0046)·push_text_clean(0046) 정의를 다시 실행한 뒤 제약을 다시 만든다.
-- 게시 버전 목록은 지난 동의의 근거이므로 지우기 전에 내보낸다.
drop function if exists public.admin_publish_terms_version(text, text, text, text);
drop index if exists public.terms_agreements_pair_key;
drop table if exists public.terms_versions;
