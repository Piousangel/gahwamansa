-- 0046 되돌리기(수동). 동의 이력은 증빙이므로 표를 지우기 전에 내보내 보관한다.
alter table public.cheer_texts drop constraint if exists cheer_texts_no_ads;
alter table public.push_copy drop constraint if exists push_copy_no_ads;
drop function if exists public.push_text_clean(text);
drop function if exists public.my_terms_status();
drop function if exists public.record_terms_agreement(text, text);
drop table if exists public.terms_agreements;
