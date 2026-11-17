# 서버 개인정보 변경 독립 검토 (2026-11-17)
대상: 0012_child_privacy.sql, 0013_content_photos_bucket.sql, rpc_privacy/rls 테스트, 계획 05, DECISIONS·DECISION-MEMO. 방법: SQL 읽기·grep만(실행 안 함, 테스트 통과 여부 미확인).
요약: 핵심 RLS 차단(answers·daily_sessions)과 함수 기본기(search_path='', 역할 가드, anon 회수)는 양호. 그러나 **자녀가 같은 정보를 다른 테이블로 우회해 읽는 경로 2곳**이 남았다.

## ① 놓친 것
1. **[높음] cheers.read_at로 "어르신이 앱을 열었다"가 자녀에게 노출**: `cheers_read`는 자녀에게 가족 전체 응원을 허용하고(0002_rls.sql:57-58) read_at은 어르신이 응원을 읽은 시각이다. 0012는 이 정책을 건드리지 않았다. 계획 15행의 "마지막 연 날짜·참여 여부 숨김"과 모순. 동의 거부·철회 가족에서도 읽음 시각이 보인다. 제안: 자녀 select 정책에서 read_at을 숨기거나(컬럼 권한 revoke는 select * 호환성 주의, 대안은 sent 목록 RPC), 최소한 정책 문구에 포함. 테스트 추가 필요.
2. **[중간] profiles_read로 철회와 미동의가 구분됨**: 자녀는 같은 가족 프로필 전 컬럼을 읽는다(0002_rls.sql:30). 새 컬럼 consent_withdrawn_at·consent_version(0012:8-9)이 그대로 보인다. 결정(DECISIONS "답과 참여 여부 모두 숨김")은 거부와 철회를 같게 보이게 하려는 것인데 철회 시각이 노출돼 "서운함" 신호가 된다. 제안: 두 컬럼을 자녀가 못 읽게(컬럼 revoke 또는 별도 테이블 consents) 하거나 컬럼을 뺀다.
3. **[중간] 철회와 save_answer 경쟁 상태**: save_answer가 동의를 확인(0009:14)한 뒤 insert하는 동안 withdraw_consent의 delete(0012:43)가 먼저 커밋되면, 철회된 상태에 답이 남는다. 지금은 child_summary가 consented_at으로 가려 보이지 않지만 **재동의 순간 옛 답이 되살아난다**(재동의가 answers를 비우지 않음, 0012:28-32). 제안: 두 함수에서 profiles 행을 `select ... for update`로 잠그거나, give_consent에서 consented_at이 null이었던 경우 answers를 지운다. 테스트 없음(동시성은 pgTAP 한계, 재동의 시나리오만이라도 필요).
4. **[중간] 동의 문구 버전이 검증·강제되지 않음**: p_version은 임의 길이 문자열을 받고(0012:21), 인자 없는 호출은 조용히 'v1'로 기록된다. 구버전 앱이 새 문구 없이 호출해도 v1로 남아 증거가 오염된다. 문구 개정 시 재동의를 요구하는 로직도 없다(my_consented는 consented_at만 봄). 제안: `char_length <= 20` 체크, 현재 유효 버전 상수와 비교해 불일치 시 거부 또는 default 제거(앱 갱신 후). 재동의 요구가 아직 필요 없으면 "미사용"이라 문서에 명시.
5. **[중간] 철회 후 daily_sessions 잔존**: withdraw_consent는 answers만 지운다(0012:43). 단계·소요 시간·완료 시각은 남고, 철회 후에도 record_session_step이 계속 쌓인다(동의 확인 없음, 미확인: 0005 확인 안 함). 자녀는 못 읽으므로 노출 위험은 낮지만, 방침의 "철회 시 삭제" 문구가 답에만 해당함을 명시해야 한다. 파기 대상 정의는 법률 확인 안건(DECISION-MEMO §4-5).
6. **[낮음] child_summary가 알려 주는 것**: answered_date는 사실상 "마지막 활동일"이다. 오래된 날짜는 안부 신호가 되며(메모 §6에서 위원도 인정) 계획 15행의 "마지막 연 날짜 없음"은 엄밀히는 거짓. 계획 문구를 "최근 답 날짜만"으로 고칠 것. 그 외 노출 필드(parent_title·shared·prompt·choice_label)는 적정.
7. **[낮음] 권한**: 새 RPC 4개는 definer+search_path=''+역할 가드+anon 회수로 적절(0012:88-89). parent_streak(uuid,date)는 자녀가 호출 가능하지만 invoker라 이제 0을 돌려줄 뿐 우회 아님(0005:9-10, 78). Realtime 게시(publication)는 마이그레이션에 없어 우회 없음, 대시보드 설정은 미확인.
8. **[낮음] 형제·마지막 자녀**: child_summary는 가족 내 모든 어르신을 모든 자녀에게 보여 줌(의도). 마지막 자녀가 지우면 가족 전체 cascade(0008:47-49)라 안전하며, 자녀 한 명 탈퇴 시 어르신 데이터 유지도 맞다. 단, 형제 B의 set_parent_title이 A의 설정을 덮어씀(마지막 쓰기 승리), 변경 기록 없음. 허용 가능.
9. **[낮음~중간] 스토리지 버킷**: public=true, 정책 없음(0013:2-4). 업로드는 서비스 키만, 목록 조회는 정책이 없어 불가, URL을 알면 누구나 읽음(의도된 설계, AI 생성 사진이라 민감도 낮음). 위험: ① 나중에 가족 개인 사진을 같은 버킷에 올리면 전 세계 공개(주석으로 금지 명시 권장), ② `on conflict do update`가 대시보드에서 바꾼 설정을 재실행 때 되돌림(드리프트), ③ jpeg만 허용이라 png 업로드 거부(도구 확인 필요), ④ 트래픽·대역폭 비용 상한 없음. 확신 낮음 항목: 호스팅 환경의 storage 스키마 권한(미확인).

## ② 부족한 것
- **테스트 없음**: 재동의 시 withdrawn_at 비움·답 복원 여부(계획 19행엔 "재동의"가 있으나 rpc_privacy.test.sql엔 없음), consent_version 저장, 새 RPC의 anon 실행 거부(rpc_family.test.sql:61 식 테스트), cheers.read_at 노출, 자녀가 profiles의 consent 컬럼을 읽는지, 어르신 2명(형제 시나리오·다중 어르신 순서), 다른 가족 자녀의 set_parent_title(my_family_id로 격리되나 단정 안 함), 버킷 설정.
- **문서 불일치**: DECISIONS.md에 0012·0013 구현 결정 항목이 없다(근거는 메모·계획뿐). 메모(§5)의 이름 child_today_summary·set_display_name·last_active_date와 구현 child_summary·set_parent_title이 달라 앱 팀이 혼동할 수 있음. 철회 시 sessions를 남기는 결정과 "마지막으로 연 날짜" 항목의 폐기도 기록이 없음.
- **롤백**: 다운 마이그레이션 없음. 0012는 정책 교체·함수 drop을 포함해 역방향 SQL을 plan에 적어 둘 것(답 삭제는 비가역: 철회 전 백업 불가를 사용자에게 고지). 출시 전이면 허용.
- **배포 순서**: 자녀 앱이 answers를 직접 읽는 현행 클라이언트는 0012 적용 즉시 빈 화면이 된다(계획 21행의 "다음 단계"). 함께 배포 또는 호환 기간 필요(미확인: 이미 배포된 클라이언트 여부).

## ③ 과한 것 (빼도 되는 것)
- `consent_withdrawn_at`: 로직에서 쓰이지 않고(child_summary는 consented_at만 사용) 자녀에게 노출되는 부작용만 있다. 감사 목적이 아니면 삭제 권장(②-2 해결과 겸함). consent_version도 "활용 로직 없음"이면 보류 가능하나 법률 증빙용이면 유지.
- give_consent `default 'v1'`: 호환 목적이 끝나면 제거 대상(위 4번).
- set_parent_title의 jsonb 반환(ok/reason): 다른 RPC는 예외를 던지는데 이것만 다름. 앱 편의로 허용하나 일관성은 낮음. 닫힌 목록은 check 제약과 함수 두 곳에 중복되어 있어 한쪽이 바뀌면 어긋남(상수 하나로).
- revoke `from public, anon` 이중 표기는 안전해서 유지. 버킷 file_size_limit·mime 제한은 적절, 과하지 않음.

## 우선순위 제안
1) cheers.read_at 노출 처리(높음) 2) consent_withdrawn_at 비노출 또는 제거 3) save_answer/withdraw 잠금 + 재동의 시 답 정리 4) p_version 검증 5) 테스트 6항목 추가 6) DECISIONS·계획 문구 정정.
