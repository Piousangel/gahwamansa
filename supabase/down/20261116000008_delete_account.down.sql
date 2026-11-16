-- 되돌리기: 20261116000008_delete_account.sql (수동 실행용). 외래키를 원래(ON DELETE 없음)로 되돌린다.
drop function if exists public.delete_my_account();
alter table public.families drop constraint families_created_by_fkey,
  add constraint families_created_by_fkey foreign key (created_by) references auth.users(id);
-- created_by NOT NULL 복원은 null 행이 없을 때만 가능: update 후 수동 실행 필요
-- alter table public.families alter column created_by set not null;
alter table public.cheers drop constraint cheers_to_parent_fkey,
  add constraint cheers_to_parent_fkey foreign key (to_parent) references public.profiles(id);
alter table public.cheers drop constraint cheers_from_child_fkey,
  add constraint cheers_from_child_fkey foreign key (from_child) references public.profiles(id);
alter table public.invite_codes drop constraint invite_codes_target_profile_id_fkey,
  add constraint invite_codes_target_profile_id_fkey foreign key (target_profile_id) references public.profiles(id);
alter table public.invite_codes drop constraint invite_codes_created_by_fkey,
  add constraint invite_codes_created_by_fkey foreign key (created_by) references public.profiles(id);
alter table public.invite_codes drop constraint invite_codes_used_by_fkey,
  add constraint invite_codes_used_by_fkey foreign key (used_by) references auth.users(id);
