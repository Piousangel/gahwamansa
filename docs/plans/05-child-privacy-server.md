# 서버 변경 계획: 자녀 노출 범위 축소·동의 철회·호칭 (2026-11-17)

근거: `docs/team/board/DECISION-MEMO.md` 안건 A·C·E, 사용자 결정(참여 여부까지 숨김, 철회 시 저장된 답 삭제). 크기 M, 서버 먼저 → 앱 순서(REPO.md).

## 데이터 모양
| 변경 | 내용 |
|---|---|
| `families.parent_title` | 닫힌 목록(엄마·아빠·어머니·아버지·할머니·할아버지·부모님), 기본 "부모님". 어르신 프로필이 생기기 전에 자녀가 번호를 발급하며 정하므로 가족에 둔다 |
| `profiles.consent_version`, `consent_withdrawn_at` | 어떤 문구에 동의했는지와 철회 시각 |
| RLS | `answers_read`·`sessions_read`를 **본인(어르신)만**으로 좁힌다. 자녀는 테이블을 직접 읽지 못하고 RPC로만 본다 |

## 시그니처
- `give_consent(p_version text default 'v1') returns void` — 기존 호출(`give_consent()`)과 호환. 재동의 시 철회 시각을 비운다
- `withdraw_consent() returns void` — 어르신만. 본인 답을 **삭제**하고 동의를 해제한다(세션 기록은 어르신 본인용으로 남김, 자녀는 읽지 못함)
- `child_summary() returns jsonb` — 자녀만. `{parent_title, parents:[{shared, latest:{prompt, choice_label, answered_date}|null}]}`. 동의하지 않았거나 철회한 어르신은 `shared:false, latest:null`. **단계·연속일·소요 시간·마지막 연 날짜·완료 여부는 포함하지 않는다**(동의 문구 "안 한 날은 보이지 않아요"와 1:1)
- `set_parent_title(p_title text) returns jsonb` — 자녀만. 목록 밖이면 `{ok:false, reason:'invalid_title'}`

## 검증
pgTAP `rpc_privacy.test.sql`(자녀 직접 읽기 0행, 동의 전·후·철회 후 요약, 키 목록 제한, 권한, 호칭 검증, 재동의) 먼저 작성 → 빨간불 확인 → 마이그레이션 0012 → 전체 pgTAP 통과. `rls.test.sql` 53행(자녀가 답 1건을 본다)은 새 정책에 맞게 수정한다.

## 앱에 미치는 영향(다음 단계, 별도 커밋)
- 자녀 홈·리포트는 `child_summary()`로 바꾼다(realApi·fakeApi·types).
- 어르신 동의 거부·철회 시에도 앱은 그대로 쓸 수 있어야 한다("괜찮아요. 앱은 그대로 써요"). 현재 동의 전에는 답 저장이 거부되므로, 앱이 동의 화면에 갇히지 않는지 확인한다.
