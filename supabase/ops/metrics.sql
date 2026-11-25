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

-- ⑪ 7일 왕복률(기획 v2.1 성장 리뷰 3.2 ③, 스토어 문서 목표 50%): 자녀가 처음 답을 본 가족(child_first_answer_viewed, 가족별 첫 KST 날 d0가
--    기간 안) 중 그 뒤 d0~d0+6(7일) 안에 자녀가 응원(cheer_sent)을 보낸 가족 비율. 7일이 다 지난 코호트만(d0 <= 오늘−7).
--    첫 열람은 전체 기간에서 가족별 최소라 앞 기간에 이미 본 가족은 다시 세지 않는다. 첫 열람보다 앞선 응원은 넣지 않는다.
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to),
first_view as (
  select e.family_id, min(e.ts) as t0, min((e.ts at time zone 'Asia/Seoul')::date) as d0
    from public.events e join public.families f on f.id = e.family_id
   where e.name = 'child_first_answer_viewed' and not f.is_review and not f.is_test
   group by e.family_id
),
cohort as (
  select fv.*, exists (select 1 from public.events c
                        where c.family_id = fv.family_id and c.name = 'cheer_sent' and c.actor_role = 'child'
                          and c.ts >= fv.t0 and (c.ts at time zone 'Asia/Seoul')::date <= fv.d0 + 6) as round_trip
    from first_view fv, p
   where fv.d0 >= p.d_from and fv.d0 < p.d_to and fv.d0 <= public.kst_today() - 7
)
select count(*) as families, count(*) filter (where round_trip) as round_trip_7d,
       round(100.0 * count(*) filter (where round_trip) / nullif(count(*), 0), 1) as pct
  from cohort;

-- ⑫ 북극성: 주간 '양쪽이 닿은 가족'(기획 v2.1 0절, 성장 리뷰 3.1). 같은 KST 주(월요일 시작)에
--    (부모님) 한 어르신이 course_completed 를 2일 이상 AND (자녀) cheer_sent 또는 child_home_viewed(0066) 1회 이상인 가족 수.
--    '2일 이상'은 같은 어르신 기준(어르신 두 분이 하루씩이면 아님). '매일'을 요구하지 않는다(감시·연속 지표 아님).
--    d_from·d_to 는 월요일로 둔다(주 중간이면 그 주는 일부만 센다). 이번 주는 아직 끝나지 않은 값.
with p as (select date '2026-11-30' as d_from, date '2026-12-14' as d_to),
ev as (
  select e.family_id, e.profile_id, e.actor_role, e.name, (e.ts at time zone 'Asia/Seoul')::date as d
    from public.events e join public.families f on f.id = e.family_id, p
   where not f.is_review and not f.is_test
     and e.name in ('course_completed', 'cheer_sent', 'child_home_viewed')
     and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
),
parent_side as (
  select distinct week, family_id from (
    select date_trunc('week', d)::date as week, family_id, profile_id from ev
     where actor_role = 'parent' and name = 'course_completed'
     group by 1, 2, 3 having count(distinct d) >= 2) x
),
child_side as (
  select distinct date_trunc('week', d)::date as week, family_id from ev
   where actor_role = 'child' and name in ('cheer_sent', 'child_home_viewed')
),
weeks as (select generate_series(date_trunc('week', p.d_from), p.d_to - 1, interval '1 week')::date as week from p)
select w.week,
       (select count(*) from parent_side ps where ps.week = w.week) as parent_side,
       (select count(*) from child_side cs where cs.week = w.week) as child_side,
       (select count(*) from parent_side ps join child_side cs using (week, family_id) where ps.week = w.week) as both_sides
  from weeks w
 order by w.week;

-- ⑬ 자녀 D7 재방문(성장 리뷰 3.2 ①): 처음 답을 본 자녀(child_first_answer_viewed, 자녀별 첫 KST 날 d0가 기간 안) 중
--    d0+7~d0+13 에 자녀 이벤트(child_home_viewed·child_report_viewed·cheer_sent)가 1개 이상인 비율. 14일이 다 지난 코호트만.
--    0066 반영과 새 앱(child_home_viewed 를 보내는 판) 보급 전 기간은 응원·지난 날만으로 센 하한값이다(옛 앱 자녀는 홈 열람이 안 잡힘).
--    ⑫ 자녀 쪽도 같은 이유로 그 기간은 낮게 나온다.
with p as (select date '2026-11-20' as d_from, date '2026-12-01' as d_to),
first_view as (
  select e.profile_id, min((e.ts at time zone 'Asia/Seoul')::date) as d0
    from public.events e join public.families f on f.id = e.family_id
   where e.name = 'child_first_answer_viewed' and e.actor_role = 'child' and e.profile_id is not null
     and not f.is_review and not f.is_test
   group by e.profile_id
),
cohort as (
  select fv.*, exists (select 1 from public.events x
                        where x.profile_id = fv.profile_id
                          and x.name in ('child_home_viewed', 'child_report_viewed', 'cheer_sent')
                          and (x.ts at time zone 'Asia/Seoul')::date between fv.d0 + 7 and fv.d0 + 13) as back
    from first_view fv, p
   where fv.d0 >= p.d_from and fv.d0 < p.d_to and fv.d0 <= public.kst_today() - 14
)
select count(*) as cohort, count(*) filter (where back) as returned_d7,
       round(100.0 * count(*) filter (where back) / nullif(count(*), 0), 1) as pct
  from cohort;
