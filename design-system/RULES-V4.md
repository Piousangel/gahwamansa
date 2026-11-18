# 디자인 시스템 v4 규칙 (값 확정, 2026-11-19)

원문: `docs/team/board/2026-11-19-design-system-v4/SUMMARY.md` 2~3절, 표결 Q2~Q11. 값의 원본은 `tokens-v4.json`(DS 레인이 코드 토큰으로 옮김). v3는 한 릴리스 별칭(`v3Aliases`).

## 확정한 것(tokens-v4.json 키)
| 영역 | 키 | 내용 |
|---|---|---|
| 글자 | `typeRoles`·`typeRules` | display·title·heading·bodyLg·body·sub·button·link·backLink(+label·numeral·hand). 400/700 두 단계, 화면은 역할만, 700 역할 화면당 2개 이하 |
| 색 | `color`·`colorRoles`·`colorRules` | inkTitle·inkBody(차콜)·inkSub(교체)·inkSubChild·action(누르는 것 전용)·accent·info/infoSoft·doneInk·dangerInk·line |
| 대비 | `contrast` | 이 파일 값으로 스크립트 계산. 어르신 7, 자녀 4.5, 경계 3. 금지 조합 목록 포함 |
| 간격 | `space` | 4 격자, 묶음 안 8 / 묶음 사이 16(어르신 20) / 구역 32, 좌우 24(어르신)·20(자녀) |
| 터치 | `touch` | minHeight만. 어르신 주 72·보조 64·링크 64·간격 12, 자녀 56/48. 말줄임 금지와 예외 3, 확대 상한 2.0/1.5 |
| Dock | `dock` | 주 1 + 보조 0~1 + 한 줄 note, 약관은 본문 끝, 넘치면 note → 보조 순으로 본문 끝, 최후에 페이드 + 테스트 실패 |
| BackLink | `backLink` | 화살표 28(자녀 24)·글자 24(자녀 18)·알약, 어르신 64×120 이상·자녀 56, 목적지 문구, 배율 숨김 없음, 자판 열리면 BackLink 한 줄로 접음 |
| 틀 | `screenVariants` | step·list·form·done·state·intro 6종 + Sheet/Dialog |
| 컴포넌트 | `components` | Text·Heading·Screen·TopBar/BackLink·Button·SocialButton·Dock·Card/Section·ListRow·Sheet/Dialog·Choice·Field·Banner/Toast·StateView(14종) |

## 디자인이 SUMMARY 값에서 바꾼 것 (이유 포함)
1. **BackLink 알약 면: paperSoft → card(흰) + line 테두리 1.5.** SUMMARY는 paperSoft인데, action 글자가 paperSoft 위에서 6.47로 어르신 7:1에 못 미친다(card 위 7.80). 대비표 테스트가 실패하므로 확정 값을 바꾼다.
2. **옅은 면 위 글자 제한을 대비 계산으로 구체화.** inkSubChild는 paperSoft 4.73·noticeSoft 4.56·actionSoft 4.41, accent는 actionSoft 6.28이라 옅은 면 위에서 쓰지 않는다(SUMMARY의 "옅은 면 위는 inkTitle·inkBody만"과 같은 방향, 수치 추가).
3. **비활성 버튼**: 면 대비 1.10 문제(진단 A6)에 SUMMARY가 값을 정하지 않아 line 테두리 1.5 + 이유 글자 한 줄을 제안으로 추가(어르신 확인 대상).
4. **인접 크기 비율 1.2**: 어르신 표에서 bodyLg 22/body 20(1.10)·heading 26/bodyLg 22(1.18)는 1.2 미만이라 굵기·색으로 보완하는 쌍으로 표시해야 테스트가 통과한다.

## 검증
- 대비 수치는 SUMMARY 2-2 표와 일치(inkBody 13.01/14.40, inkSub 7.70/8.52, inkSubChild 5.16/5.71, accent 7.34, info 7.82, line 3.36).
- `contrast.text` 28건 중 어르신 7:1 미달 0건(비활성 글자 1건은 WCAG 면제로 4.5 기준 표기).
- 렌더 확인은 해당 없음(값·문서만). 시안은 화면 묶음별 PR에서 갱신한다.
