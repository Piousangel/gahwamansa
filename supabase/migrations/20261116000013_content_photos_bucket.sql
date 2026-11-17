-- 0013 콘텐츠 사진 저장소: 공개 읽기 버킷(앱이 URL로 이미지를 표시). 쓰기는 서비스 키만(정책 없음).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-photos', 'content-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];
