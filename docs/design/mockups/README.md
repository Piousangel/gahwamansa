# 디자인 시안 보관 (2026-11-17)

Claude Design 캔버스 "부모와 자식 디자인"이 계정에서 사라져서(삭제 또는 접근 불가, 원인 미확인) 작업 폴더의 원본을 이곳에 보관한다. 캔버스 링크는 더 이상 열리지 않는다.

## 파일
| 파일 | 내용 |
|---|---|
| `Connect`·`Main`·`Photo`·`Question`·`Hangul`·`ChildHome`·`Report` `.dc.html` | 1차 시안(실용형, 어르신 5 + 자녀 2) |
| `A_*`, `C_*` | 컨셉 비교안: A 사진첩, C 따뜻한 일러스트 |
| `M_*` | **확정 컨셉 "해님이 안내하는 우리 집 앨범"(A+C 혼합)** 시안. 코드 입력(상태 전환), 동의, 오늘의 코스, 사진, 질문, 한글, 자녀 홈, 리포트 |
| `canvas.json` | 캔버스 배치 정보 |

## 열람 방법과 한계
- `.dc.html`은 Claude Design 캔버스용 형식(`<x-dc>`, `support.js` 필요)이라 **브라우저에서 바로 열면 렌더링되지 않을 수 있다**(`support.js`는 캔버스 쪽 파일이라 보관본에 없다). 구조와 인라인 스타일, 문구는 읽을 수 있다.
- 다시 캔버스로 올리려면 새 Design 캔버스를 만들어 `project/` 경로로 게시한다(배치는 `canvas.json` 참고).

## 구현 기준은 시안이 아니라 아래 문서
- 디자인 토큰·컴포넌트·접근성 스펙: `docs/team/designer.md`
- 코드: `app/src/ui/tokens.ts`
- 시안의 해님·아이콘 SVG는 **임시 그림**이며 전문 에셋 디자이너 산출물로 교체한다(`docs/team/assets-manifest.md`). 구형 시안(1차, A, C, M_Main·Photo·Question·ChildHome)에는 임시 해님이 그대로 남아 있다.
