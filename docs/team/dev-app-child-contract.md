# 자녀 화면(③) 앱이 쓰는 서버 계약 (앱 줄, 2026-11-17)
기준: 서버 줄 `docs/team/dev-server-notes.md`(0019~0028, worktree-agent-a42c228abb4d805d7). 앱 쪽: `app/src/features/types.ts`(타입·키 목록), `realApi.ts`(호출·매핑), `fakeApi.ts`, `__tests__/childContract.test.ts`.
서버 0019~0028이 main 에 들어와(3b76263) **가정(ASSUMED) 표시는 없다**. 모두 서버 노트와 글자까지 맞췄다.

| 앱 메서드 | RPC | 상태 |
|---|---|---|
| `fetchChildSummary()` | `child_summary()` parents[].parent_id·title·connected·shared·latest | 서버 확정(0019·0021). 옛 서버면 순번·가족 호칭·연결됨으로 채움 |
| `ChildParent.starter` | `child_summary()` parents[].latest.starter | 서버 확정(0027). 기능 회의 B3, null 이면 줄 숨김 |
| `fetchAnswerHistory()` | `child_answer_history()` parents[].answers[].session_date·prompt_short·choice_label | 서버 확정(0021). prompt_short 가 없으면 앱이 option_a·b 로 만든다 |
| `sendCheer(parentId, key)` | `send_cheer(p_parent, p_key)` → `{ok, cheer_id}`·`{ok:false, reason}` | 서버 확정(0020). 키 `love_you·warm_day·thanks_always·peaceful_day`, reason `invalid_key·invalid_target·disconnected·daily_limit`(테스트로 고정) |
| `setParentTitleFor(parentId, title)` | `set_parent_title_for(p_parent, p_title)` | 서버 확정(0019·0028). reason `invalid_title·invalid_target·duplicate_title`. 앱이 먼저 같은 호칭을 막고(L4), 서버 거부도 시트 안에 안내. 연결 전 가족 기본값은 기존 `set_parent_title(p_title)` |
| `getLoginMethod()`·`signOut()` | 없음(세션 `app_metadata.provider`, SDK signOut + `auth.signOut({scope:'local'})`) | 앱만 |
| 새 폰 연결 번호·끊김 배너 번호 만들기 | 기존 `issue_invite_code(p_target = parent_id)` | 기존 |

## 앱 쪽 동작 메모 (서버 줄 확인용)
- 응원은 **연결된 어르신 한 분씩** `send_cheer` 를 부른다(어르신 고르기 UI 없음, 시안 C4). 일부만 성공하면 성공한 분 호칭으로 "{호칭}께 보냈어요". `disconnected`·`invalid_target` 이면 요약을 다시 불러 배너·버튼을 맞춘다.
- `daily_limit`는 임시 전용 문구(라이터 확인), `disconnected`는 요약을 다시 불러 배너로 보여 준다.
- `get_my_cheers`·`mark_cheers_read`(0020)는 어르신 쪽(P8) 계약이라 자녀 화면은 부르지 않는다.
- 남은 일: 연결 때 기본 호칭이 겹친 어르신에게 호칭 바꾸기 권하기(서버 노트 §1) — 디자인 결정 필요.
- 아직 부르지 않는 것: `log_event`(0022, 자녀 화면 이벤트 `cheer_sent`·`child_report_viewed`·`invite_share_tapped`는 U14에서), 푸시(U15, C3 알림 켜기 줄은 권한 훅 자리만).

## ASSUMED (서버 요청)
- `child_summary().parents[].connected_date`(YYYY-MM-DD, KST): 그 어르신이 가족에 연결된 날. C4 호칭 겹침 시트의 "{월}월 {일}일에 연결된 분이에요"에 쓴다. 없으면 날짜 문장 없이 "이 이름으로 화면에 보여요". 앱: `ChildParent.connectedDate`.
