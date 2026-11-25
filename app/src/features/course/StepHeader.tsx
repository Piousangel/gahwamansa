import React from 'react';
import {View} from 'react-native';
import {Text} from '../../ui/ds';
import {copy} from '../../copy/copy';
import {useScreenTitleRef} from '../../ui/screenTitle';

// 단계 화면 제목 줄(P4·P5·P6, 시안 P3_P4_P5_ds4b): "사진 보기 · 1 / 3" 한 줄(heading 역할). 화면 읽기는 한 덩어리로
// "사진 보기, 3단계 중 1단계"(talkback-spec R4). 화면 제목 포커스(R2) 대상은 useScreenTitleRef 로 등록한다.
// 전체 단계 수: 3(기본) — 기능 스위치 fiveSteps 가 켜지면 5(DECISIONS 2026-11-25, step_a11y 의 {전체}만 5로)
const TOTAL_STEPS = 3;
const totalSteps = (five: boolean) => (five ? 5 : TOTAL_STEPS);

/** 자판이 열려 위 영역이 접혔을 때 BackLink 가 읽어 줄 단계 정보(R-15). StepHeader 의 읽기와 같다 */
export function stepA11y(name: string, n: number, review?: boolean, five = false): string {
  return review
    ? copy.course.step_review_a11y.split('{단계}').join(name)
    : copy.course.step_a11y
        .split('{단계}').join(name)
        .split('{전체}').join(String(totalSteps(five)))
        .split('{n}').join(String(n));
}

// review: 보기 전용(다시 보기). 단계 표시를 숨기고 읽기는 "사진 보기, 다시 보는 중"(11절 11b, 기록이 안 남는다는 것을 알림).
// compact: 큰 글자(150% 이상)에서 단계 표시를 '1 / 3'만(label 역할) — 사진 아래 질문 첫 문장이 첫 화면에 들게(P4 시안 #95 200% 보드).
//   읽기는 그대로 '사진 보기, 3단계 중 1단계'. 보기 전용은 이름만(숫자 없음)이라 그대로 heading
// five: 5단계로 도는가(세션 five = 스위치 + 서버 지원). 화면이 넘긴다
export function StepHeader({name, n, review, compact, five = false}: {name: string; n: number; review?: boolean; compact?: boolean; five?: boolean}) {
  const titleRef = useScreenTitleRef(true);
  const total = totalSteps(five);
  return (
    <View ref={titleRef} testID="step-header" accessible accessibilityRole="header" accessibilityLabel={stepA11y(name, n, review, five)}>
      {compact && !review ? <Text role="label">{`${n} / ${total}`}</Text> : <Text role="heading">{review ? name : `${name} · ${n} / ${total}`}</Text>}
    </View>
  );
}
