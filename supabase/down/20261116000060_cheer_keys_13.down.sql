-- 0060 되돌리기(수동). 원칙은 앞으로 고치기(dev-server-notes §18) — 이 파일은 비상용이다.
-- 순서: send_cheer 를 0059 정의로, event_prop_ok 를 0055 정의로 다시 실행(두 파일에서 해당 함수 부분을 복사해 실행) → 아래 → cheer_key_ok 삭제.
-- 주의: 새 13키로 이미 보낸 cheers 행·적재된 cheer_texts 행이 있으면 4키 check 가 실패한다. cheer_texts 의 새 키 행을 먼저 지운다
--       (cheers 행은 남는다 — 어르신 앱은 모르는 키를 기본 문장으로 보여 준다, #236).
delete from public.cheer_texts where message_key not in ('love_you', 'warm_day', 'thanks_always', 'peaceful_day');
alter table public.cheer_texts drop constraint cheer_texts_message_key_check,
  add constraint cheer_texts_message_key_check check (message_key in ('love_you', 'warm_day', 'thanks_always', 'peaceful_day'));
-- send_cheer·event_prop_ok 를 되돌린 뒤에만:
-- drop function public.cheer_key_ok(text);
