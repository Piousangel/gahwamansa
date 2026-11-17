# 자녀 화면(③) 앱이 쓰는 서버 계약 (앱 줄, 2026-11-17)
기준: 서버 줄 `docs/team/dev-server-notes.md`(0019~0028, worktree-agent-a42c228abb4d805d7). 앱 쪽: `app/src/features/types.ts`(타입·키 목록), `realApi.ts`(호출·매핑), `fakeApi.ts`, `__tests__/childContract.test.ts`.
**가정(ASSUMED)으로 남은 것은 아래 표시한 1건뿐**이다. 나머지는 서버 노트와 글자까지 맞췄다.

| 앱 메서드 | RPC | 상태 |
|---|---|---|
| `fetchChildSummary()` | `child_summary()` parents[].parent_id·title·connected·shared·latest | 서버 확정(0019·0021). 옛 서버면 순번·가족 호칭·연결됨으로 채움 |
| `ChildParent.starter` | `child_summary()` parents[].latest.starter | **ASSUMED(0027)** 기능 회의 B3 첫마디 한 줄. 서버 확정 시 realApi 한 줄(`p.latest?.starter`)만 고친다 |
| `fetchAnswerHistory()` | `child_answer_history()` parents[].answers[].session_date·prompt_short·choice_label | 서버 확정(0021). prompt_short 가 없으면 앱이 option_a·b 로 만든다 |
| `sendCheer(parentId, key)` | `send_cheer(p_parent, p_key)` → `{ok, cheer_id}`·`{ok:false, reason}` | 서버 확정(0020). 키 `love_you·warm_day·thanks_always·peaceful_day`, reason `invalid_key·invalid_target·disconnected·daily_limit`(테스트로 고정) |
| `setParentTitleFor(parentId, title)` | `set_parent_title_for(p_parent, p_title)` | 서버 확정(0019). 연결 전 가족 기본값은 기존 `set_parent_title(p_title)` |
| `getLoginMethod()`·`signOut()` | 없음(세션 `app_metadata.provider`, SDK signOut + `auth.signOut({scope:'local'})`) | 앱만 |
| 새 폰 연결 번호·끊김 배너 번호 만들기 | 기존 `issue_invite_code(p_target = parent_id)` | 기존 |

## 앱 쪽 동작 메모 (서버 줄 확인용)
- 응원은 **연결된 어르신 한 분씩** `send_cheer` 를 부른다(어르신 고르기 UI 없음, 시안 C4). 일부만 성공하면 성공한 분 호칭으로 "{호칭}께 보냈어요". `disconnected`·`invalid_target` 이면 요약을 다시 불러 배너·버튼을 맞춘다.
- `daily_limit`·`disconnected` 전용 문구가 아직 없어 일반 오류 제목("잠깐 문제가 생겼어요")을 쓴다(라이터 TODO).
- 아직 부르지 않는 것: `log_event`(0022, 자녀 화면 이벤트 `cheer_sent`·`child_report_viewed`·`invite_share_tapped`는 U14에서), 푸시(U15, C3 알림 켜기 줄은 권한 훅 자리만).
