-- 0059 되돌리기(수동). send_cheer(uuid, text, uuid)를 지우고 0020의 send_cheer(uuid, text)와 grant를 다시 실행, create_family는 0003 정의로.
-- request_id 열·인덱스는 지워도 된다(응원 행 자체는 남는다). 되돌리면 시간 초과 재시도로 응원이 두 번 갈 수 있다.
drop index if exists public.cheers_request_key;
alter table public.cheers drop column if exists request_id;
