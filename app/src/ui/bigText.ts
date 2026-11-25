/**
 * '아주 큰 글자' 문턱(리드 결정 #263 QA-2 M1). 이 배율부터 화면은 숨기지 않고 순서·배치만 바꿔
 * 화면의 목적(질문·확인할 번호·본문)이 첫 화면에 오게 한다(V4-INDEX FS 200% 선례, P7 #263, 대기열 44).
 * Android 1.8·2.0 과 iOS Dynamic Type AX1(약 1.64)·제조사 중간 단계·'화면 크기'를 키운 150%가 여기에 든다.
 * 1.5(150%)는 기존 배치 그대로다.
 */
export const BIG_TEXT_SCALE = 1.6;
export const isBigText = (fontScale: number) => fontScale >= BIG_TEXT_SCALE;
