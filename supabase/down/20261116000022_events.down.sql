-- 0022 되돌리기(수동)
-- 순서(리뷰 L7): 이 파일은 뒤 번호부터 하나씩 되돌린다고 가정한다. **먼저** 아래에 적은 이전 정의 함수를 이전 마이그레이션 파일에서 다시 실행해
--   이 파일이 지울 컬럼·함수에 기대지 않게 만든 뒤, 그다음 이 파일을 실행한다(반대 순서면 남은 함수가 깨진다).
drop function if exists public.log_event(text, jsonb);
drop function if exists public.event_prop_ok(text, jsonb);
drop function if exists public.event_device_key(uuid);
drop table if exists public.events;
