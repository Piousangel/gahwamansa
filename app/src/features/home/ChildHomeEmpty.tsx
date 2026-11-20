import React from 'react';
import {StyleSheet, View} from 'react-native';
import {AudienceProvider, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {useFoldGap} from '../../ui/ds/useFoldGap';
import {copy} from '../../copy/copy';

const e = copy.child.home.empty;
const GAP = 14; // 시안 본문 간격

/**
 * C4 첫날 빈 상태 안 B(시안 child/C3_C4_P8_ds4 #42·#59, 리드 결정): 한 줄 + 흐린 예시 카드 2장 + 이야기 꺼내기 한 줄.
 * - 예시 카드: 점선·'예시' 칩·흐린 면, 누르는 것 아님. 실제 답으로 오인하지 않게 읽기 이름도 '예시'로 시작한다.
 * - 가짜 개인정보 없음(호칭은 '부모님', 문장은 일반 예시). 칭찬·압박 문구 없음.
 * - 접힘 경계(R-15): 첫 화면 끝이 카드·이야기 꺼내기를 가르면 그 앞에 잰 만큼 간격(useFoldGap). 안내 한 줄은 늘 첫 화면에.
 * 화면 틀은 C4 홈(옛 Screen, 시안 없음 화면)이 쥐고, 이 묶음은 본문 바로 아래 자식으로 들어간다(onViewport 는 화면이 넘긴다).
 */
export function useEmptyFold() {
  return useFoldGap(4, GAP, 1);
}

// action: 큰 글자에서 본문으로 내려온 응원 버튼(N-10) — 안내 한 줄 바로 다음, 예시보다 앞(#167 리뷰 M2). 접힘 계산에서 0번 요소에 함께 든다
export function ChildHomeEmpty({fold, action}: {fold: ReturnType<typeof useEmptyFold>; action?: React.ReactNode}) {
  return (
    <AudienceProvider value="child">
      <View testID="child-home-empty" style={styles.block} onLayout={fold.onBlock}>
        <View onLayout={fold.onItem(0)} testID="child-home-empty-line" style={styles.lineGroup}>
          <Text role="bodyLg">{e.line}</Text>
          {action}
        </View>
        {e.examples.map((x, i) => (
          <View
            key={x.title}
            testID={`child-home-example-${i + 1}`}
            accessible
            // 재확인 L7: 읽기 이름에는 '○월 ○일'(기호로 읽힘)을 빼고 spoken 을 쓴다
            accessibilityLabel={`${e.chip}, ${x.title}, ${x.spoken} ${x.choice}`}
            onLayout={fold.onItem(i + 1)}
            style={[styles.example, fold.gapStyle(i + 1)]}>
            <View style={styles.chip}>
              <Text role="sub">{e.chip}</Text>
            </View>
            <Text role="heading">{x.title}</Text>
            <Text role="bodyLg">{`${x.line} ${x.choice}`}</Text>
          </View>
        ))}
        {/* 이야기 꺼내기도 예시(PR #87 M1·디자인 #92 a): 예시 카드와 같은 모양(칩·점선·흐린 면), 읽기 이름도 '예시'로 시작 */}
        <View
          testID="child-home-empty-starter"
          accessible
          accessibilityLabel={`${e.chip}, ${e.starter_label}, ${e.starter}`}
          onLayout={fold.onItem(3)}
          style={[styles.example, fold.gapStyle(3)]}>
          <View style={styles.chip}>
            <Text role="sub">{e.chip}</Text>
          </View>
          <Text role="sub" tone="default">
            {e.starter_label}
          </Text>
          <Text role="bodyLg">{e.starter}</Text>
        </View>
      </View>
    </AudienceProvider>
  );
}

const styles = StyleSheet.create({
  block: {gap: GAP, alignSelf: 'stretch'},
  lineGroup: {gap: GAP},
  // 흐린 예시 카드: 점선 + 종이 면(실제 답 카드의 흰 면·테이프와 다르게)
  example: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: ds.color.line, borderRadius: ds.radius.card,
    backgroundColor: ds.color.paperSoft, paddingVertical: 14, paddingHorizontal: 16, gap: 6, alignSelf: 'stretch',
  },
  chip: {alignSelf: 'flex-start', backgroundColor: ds.color.card, borderWidth: 1.5, borderColor: ds.color.line, borderRadius: ds.radius.button, paddingHorizontal: 10},
});
