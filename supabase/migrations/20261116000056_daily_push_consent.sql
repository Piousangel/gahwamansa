-- 0056 일일 알림 대상에서 '답 보여 주기 동의(consented_at)' 조건을 뺀다(리드 결정 DECISIONS 11-19).
-- 알림 받기 동의(push_consented_at, N1 '알림 받기' 시각 — 법률 체크리스트 #10 ④)와 답 공유 동의(consented_at, P2)는 별개다.
-- 일일 알림("오늘의 사진이 왔어요")은 어르신 본인에게 가는 콘텐츠 도착 알림이라 답 공유 여부와 무관 → 알림 켬 + 알림 받기 시각만 본다.
-- 자녀에게 가는 알림은 그대로: 첫 답(0052)은 어르신이 지금 답을 보여 주는 중일 때만(par.consented_at), 응원 도착(N2)·연결(N3)은 바뀌지 않는다.
-- push_daily_targets(0036)·push_daily_claim(0038)은 이 함수를 쓰므로 함께 바뀐다. 0033의 옛 push_daily_targets 본문은 0036이 이미 대체했다.

create or replace function public.push_daily_eligible(p_today date) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
    from public.profiles p
    join public.families f on f.id = p.family_id
   where p.role = 'parent' and p.user_id is not null
     and p.push_enabled and p.push_consented_at is not null -- 0056: 답 공유 동의(consented_at)는 보지 않는다
     and not f.is_review
     and not exists (select 1 from public.daily_sessions ds
                      where ds.parent_id = p.id and ds.session_date = p_today and ds.completed_at is not null)
     and not exists (select 1 from public.push_claims c where c.kind = 'daily' and c.sent_on = p_today and c.profile_id = p.id)
     and not exists (select 1 from public.push_log l
                      where l.kind = 'daily' and l.profile_id = p.id and l.sent_on = p_today and l.status = 'sent')
     and exists (select 1 from public.device_tokens dt where dt.user_id = p.user_id)
$$;
