-- 지표 SQL 모음(로드맵 SV-16, growth.md §3·§6, 백오피스 계획 11 §1·§2). 읽기 전용 — Studio SQL Editor(서비스 권한)에서 쿼리 하나씩 실행.
-- 공통 규칙: 심사 가족(families.is_review)·테스터 가족(families.is_test, 0045) 제외(가족이 없는 설치 이벤트는 구분 불가), 기간은 KST 날짜 [from, to). 각 쿼리 맨 위 p CTE의 날짜만 바꾼다.
-- 개인정보: 집계 숫자만 낸다(이름·이메일 없음). A/B 비율은 응답 20명 미만이면 숨긴다(소수 표본 재식별·과잉 해석 방지).
-- 보관 기간 한계: events 14개월, daily_sessions·answers 31일 → D7 유지·A/B 비율은 최근 31일 안에서만 정확.

-- ① 퍼널 8단계(1~7은 이벤트, 8은 ③ D7 유지)
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to),
ev as (
  select e.* from public.events e, p
   where (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
     and (e.family_id is null or not exists (select 1 from public.families f where f.id = e.family_id and (f.is_review or f.is_test)))
)
select step, name, n from (values
  (1, '설치(app_first_open)', (select count(distinct device_key) from ev where name = 'app_first_open')),
  (2, '자녀 가입(child_signup_completed)', (select count(distinct family_id) from ev where name = 'child_signup_completed')),
  (3, '번호 발급(invite_code_issued)', (select count(distinct family_id) from ev where name = 'invite_code_issued')),
  (4, '어르신 연결(parent_code_redeemed)', (select count(distinct profile_id) from ev where name = 'parent_code_redeemed')),
  (5, '동의(parent_consent_accepted)', (select count(distinct profile_id) from ev where name = 'parent_consent_accepted')),
  (6, '첫 코스 완료(course_completed)', (select count(distinct profile_id) from ev where name = 'course_completed')),
  (7, '자녀 첫 답 확인(child_first_answer_viewed) = 전환 분모', (select count(distinct profile_id) from ev where name = 'child_first_answer_viewed'))
) t(step, name, n) order by step;

-- ② DAU(KST 날짜별, 역할별 이벤트를 남긴 프로필 수) + 어르신 코스 연 수
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to)
select d, sum(case when role = 'parent' then n end) as parent_dau, sum(case when role = 'child' then n end) as child_dau,
       (select count(distinct ds.parent_id) from public.daily_sessions ds join public.families f on f.id = ds.family_id
         where ds.session_date = x.d and not f.is_review and not f.is_test) as parents_opened_course
  from (select (e.ts at time zone 'Asia/Seoul')::date as d, e.actor_role as role, count(distinct e.profile_id) as n
          from public.events e, p
         where e.profile_id is not null
           and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
           and not exists (select 1 from public.families f where f.id = e.family_id and (f.is_review or f.is_test))
         group by 1, 2) x
 group by d order by d;

-- ③ D7 유지(퍼널 8): 기간 안에 연결된 어르신 중 연결 7~13일째에 코스를 연 비율(연결 후 14일이 지난 코호트만)
with p as (select date '2026-11-20' as d_from, date '2026-12-01' as d_to),
cohort as (
  select pr.id, (pr.created_at at time zone 'Asia/Seoul')::date as joined
    from public.profiles pr join public.families f on f.id = pr.family_id, p
   where pr.role = 'parent' and not f.is_review and not f.is_test
     and (pr.created_at at time zone 'Asia/Seoul')::date >= p.d_from and (pr.created_at at time zone 'Asia/Seoul')::date < p.d_to
     and (pr.created_at at time zone 'Asia/Seoul')::date <= public.kst_today() - 14
)
select count(*) as cohort,
       count(*) filter (where exists (select 1 from public.daily_sessions ds where ds.parent_id = c.id
                                       and ds.session_date between c.joined + 7 and c.joined + 13)) as retained_d7,
       round(100.0 * count(*) filter (where exists (select 1 from public.daily_sessions ds where ds.parent_id = c.id
                                       and ds.session_date between c.joined + 7 and c.joined + 13)) / nullif(count(*), 0), 1) as pct
  from cohort c;

-- ④ 연결률: 기간 안에 만든 가족 중 어르신이 1명 이상 연결된 비율
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to)
select count(*) as families,
       count(*) filter (where exists (select 1 from public.profiles pr where pr.family_id = f.id and pr.role = 'parent')) as connected,
       round(100.0 * count(*) filter (where exists (select 1 from public.profiles pr where pr.family_id = f.id and pr.role = 'parent')) / nullif(count(*), 0), 1) as pct
  from public.families f, p
 where not f.is_review and not f.is_test
   and (f.created_at at time zone 'Asia/Seoul')::date >= p.d_from and (f.created_at at time zone 'Asia/Seoul')::date < p.d_to;

-- ⑤ 유료 관심(C6, 관심 표시만): 시트 연 자녀 수, 안별 소식 받기 누른 자녀 수, 전환 분모
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to),
ev as (
  select e.* from public.events e, p
   where (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
     and not exists (select 1 from public.families f where f.id = e.family_id and (f.is_review or f.is_test))
)
select (select count(distinct profile_id) from ev where name = 'child_first_answer_viewed') as denominator,
       (select count(distinct profile_id) from ev where name = 'paid_sheet_opened') as sheet_opened,
       (select count(distinct profile_id) from ev where name = 'paid_interest_tapped') as interested,
       (select jsonb_object_agg(plan, n) from (select props ->> 'plan' as plan, count(distinct profile_id) as n
                                                 from ev where name = 'paid_interest_tapped' group by 1) x) as by_plan;

-- ⑥ 푸시: 종류별 실행 요약 합계(보냄·실패·무효·제외)와 알림을 눌러 연 수(실행 요약은 집계 숫자라 테스터를 뺄 수 없음 — 운영 확인용)
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to)
select r.kind, count(*) as runs, sum(r.targets) as targets, sum(r.sent) as sent, sum(r.failed) as failed, sum(r.invalid) as invalid,
       sum(r.excluded) as excluded, count(*) filter (where r.note is not null) as runs_with_note,
       (select count(*) from public.events e
         where e.name = 'push_opened' and e.props ->> 'push_kind' = r.kind
           and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to) as opened
  from public.push_runs r, p
 where (r.run_at at time zone 'Asia/Seoul')::date >= p.d_from and (r.run_at at time zone 'Asia/Seoul')::date < p.d_to
 group by r.kind, p.d_from, p.d_to order by r.kind;

-- ⑦ 질문별 A/B 비율(최근 31일, 응답 20명 미만이면 비율 숨김)
select q.day_index, q.option_a, q.option_b, count(*) as answers,
       case when count(*) >= 20 then round(100.0 * count(*) filter (where a.choice = 'A') / count(*), 1) end as pct_a,
       case when count(*) >= 20 then round(100.0 * count(*) filter (where a.choice = 'B') / count(*), 1) end as pct_b
  from public.answers a
  join public.content_questions q on q.id = a.question_id
  join public.families f on f.id = a.family_id
 where not f.is_review and not f.is_test
 group by q.day_index, q.option_a, q.option_b
 order by q.day_index;

-- ⑧ 카카오 연결 끊기(0042·0044): 대기·포기 건수와 최근 7일 실행 기록(설정 오류 회차 포함). 포기가 1건이라도 있으면 운영자 확인(dev-server-notes §14)
select (select count(*) from public.kakao_unlink_queue where gave_up_at is null) as waiting,
       (select count(*) from public.kakao_unlink_queue where gave_up_at is not null) as gave_up,
       (select min(enqueued_at) from public.kakao_unlink_queue where gave_up_at is null) as oldest_waiting,
       (select count(*) from public.push_runs where kind = 'kakao_unlink' and note = 'config_error' and run_at > now() - interval '7 days') as config_error_runs_7d,
       (select coalesce(sum(sent), 0) from public.push_runs where kind = 'kakao_unlink' and run_at > now() - interval '7 days') as unlinked_7d;

-- ⑨ 탈퇴 수(0054): 서버 삭제 함수가 남긴 account_deleted(식별자 없음, device_key is null)를 KST 날짜·범위·역할별로.
--    가족이 없는 기록이라 테스터 가족(is_test)은 뺄 수 없다(심사 가족은 기록 자체가 없음). 시각은 시 단위로 잘려 있다.
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to)
select (e.ts at time zone 'Asia/Seoul')::date as d, e.props ->> 'scope' as scope, e.props ->> 'role' as role, count(*) as deleted
  from public.events e, p
 where e.name = 'account_deleted' and e.device_key is null
   and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
 group by 1, 2, 3
 order by 1, 2, 3;

-- ⑩ 연결 전·옛 익명 계정 자동 정리(0057, 90일): 파기 배치가 지운 수(account_purged, 식별자 없음)를 KST 날짜별로. 탈퇴(⑨)와 따로 센다.
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to)
select (e.ts at time zone 'Asia/Seoul')::date as d, count(*) as purged
  from public.events e, p
 where e.name = 'account_purged' and e.device_key is null
   and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
 group by 1
 order by 1;
