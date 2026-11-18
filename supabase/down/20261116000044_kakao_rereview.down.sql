-- 0044 되돌리기(수동). 권한 회수(K-L2)는 되돌리지 않는다.
-- kakao_unlink_claim·kakao_unlink_record(0042), admin_publish_content(0043) 정의를 다시 실행한 뒤 아래를 실행한다.
drop function if exists public.kakao_unlink_release(bigint[], int);
drop trigger if exists content_photos_image_url_audit on public.content_photos;
drop function if exists public.content_image_url_audit();
-- admin_audit action 목록은 content_image_url 행이 남아 있으면 줄일 수 없다(감사 보존).
