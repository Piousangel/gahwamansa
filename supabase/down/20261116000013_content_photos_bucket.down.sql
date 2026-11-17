-- 0013 되돌리기(수동). 버킷에 파일이 있으면 먼저 비워야 삭제된다.
delete from storage.objects where bucket_id = 'content-photos';
delete from storage.buckets where id = 'content-photos';
