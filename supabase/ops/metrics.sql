-- 지표 SQL 모음(로드맵 SV-16, growth.md §3·§6, 백오피스 계획 11 §1·§2). 읽기 전용 — Studio SQL Editor(서비스 권한)에서 쿼리 하나씩 실행.
-- 공통 규칙: 심사 가족(families.is_review) 제외, 기간은 KST 날짜 [from, to). 각 쿼리 맨 위 p CTE의 날짜만 바꾼다.
-- 개인정보: 집계 숫자만 낸다(이름·이메일 없음). A/B 비율은 응답 20명 미만이면 숨긴다(소수 표본 재식별·과잉 해석 방지).
-- 보관 기간 한계: events 14개월, daily_sessions·answers 31일 → D7 유지·A/B 비율은 최근 31일 안에서만 정확.

-- ① 퍼널 8단계(1~7은 이벤트, 8은 ③ D7 유지)
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to),
ev as (
  select e.* from public.events e, p
   where (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
     and (e.family_id is null or not exists (select 1 from public.families f where f.id = e.family_id and f.is_review))
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
         where ds.session_date = x.d and not f.is_review) as parents_opened_course
  from (select (e.ts at time zone 'Asia/Seoul')::date as d, e.actor_role as role, count(distinct e.profile_id) as n
          from public.events e, p
         where e.profile_id is not null
           and (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
           and not exists (select 1 from public.families f where f.id = e.family_id and f.is_review)
         group by 1, 2) x
 group by d order by d;

-- ③ D7 유지(퍼널 8): 기간 안에 연결된 어르신 중 연결 7~13일째에 코스를 연 비율(연결 후 14일이 지난 코호트만)
with p as (select date '2026-11-20' as d_from, date '2026-12-01' as d_to),
cohort as (
  select pr.id, (pr.created_at at time zone 'Asia/Seoul')::date as joined
    from public.profiles pr join public.families f on f.id = pr.family_id, p
   where pr.role = 'parent' and not f.is_review
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
 where not f.is_review
   and (f.created_at at time zone 'Asia/Seoul')::date >= p.d_from and (f.created_at at time zone 'Asia/Seoul')::date < p.d_to;

-- ⑤ 유료 관심(C6, 관심 표시만): 시트 연 자녀 수, 안별 소식 받기 누른 자녀 수, 전환 분모
with p as (select date '2026-12-01' as d_from, date '2026-12-15' as d_to),
ev as (
  select e.* from public.events e, p
   where (e.ts at time zone 'Asia/Seoul')::date >= p.d_from and (e.ts at time zone 'Asia/Seoul')::date < p.d_to
     and not exists (select 1 from public.families f where f.id = e.family_id and f.is_review)
)
select (select count(distinct profile_id) from ev where name = 'child_first_answer_viewed') as denominator,
       (select count(distinct profile_id) from ev where name = 'paid_sheet_opened') as sheet_opened,
       (select count(distinct profile_id) from ev where name = 'paid_interest_tapped') as interested,
       (select jsonb_object_agg(plan, n) from (select props ->> 'plan' as plan, count(distinct profile_id) as n
                                                 from ev where name = 'paid_interest_tapped' group by 1) x) as by_plan;

-- ⑥ 푸시: 종류별 실행 요약 합계(보냄·실패·무효·제외)와 알림을 눌러 연 수
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
 where not f.is_review
 group by q.day_index, q.option_a, q.option_b
 order by q.day_index;
