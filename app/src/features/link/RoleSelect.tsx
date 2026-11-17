import React, {useState} from 'react';
import {Image, LayoutChangeEvent, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Screen} from '../../ui/Screen';
import {Text20} from '../../ui/Text20';
import {color} from '../../ui/tokens';
import {assetRegistry} from '../../ui/assets/registry';
import {BrandSymbol} from '../../ui/assets/brandSymbol';
import {Icon, IconName} from '../../ui/assets/icons';
import {copy} from '../../copy/copy';
import {TwoLineButton} from './TwoLineButton';
import {polaroidLayout, TILT_DEG} from './polaroidLayout';

const f = copy.first;

// 의미 단위 줄바꿈: 마지막 두 어절을 붙여 "가요"만 다음 줄로 넘어가지 않게 한다
// ("고른 답으로 자녀가 / 취향을 알아 가요"). 한 줄에 들어가면 그대로 한 줄.
export const keepTail = (t: string) => {
  const w = t.split(' ');
  return w.length < 4 ? t : `${w.slice(0, -3).join(' ')} ${w.slice(-3).join('\u00A0')}`;
};

// 첫 화면(확정: C 구성 + A 질문). 위 심볼+워드마크+한 줄 설명, 가운데 소개 폴라로이드(번들 사진, "AI가 만든 그림"),
// 아래 고정 영역에 질문과 버튼 2개(첫 화면은 하단 40% 규칙 예외). 해님 말 없음. 이전 바 없음.
// 본문은 스크롤하지 않는 한 화면: 워드마크→소개(제목+아이콘 항목 3줄)→사진(보조)→질문→버튼 순서로 읽힌다.
// 사진은 남은 영역(onLayout)과 상한(화면 폭 50%·높이 22%) 안에서 크기를 명시 계산하고, 공간이 모자라면 먼저 숨긴다.
export function RoleSelect({onChoose}: {onChoose: (role: 'parent' | 'child') => void}) {
  const {width: winW, height: winH, fontScale} = useWindowDimensions();
  // 소개가 사진보다 중요: 130%면 사진을 먼저 숨기고, 150%면 소개 항목도 숨긴다(제목은 남김)
  const showPhoto = fontScale < 1.3;
  const showItems = fontScale < 1.5;
  const [area, setArea] = useState<{w: number; h: number} | null>(null);
  const onArea = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setArea(a => (a && a.w === width && a.h === height ? a : {w: width, h: height}));
  };
  const lay =
    showPhoto && area ? polaroidLayout(area.w, area.h, fontScale, {maxPhotoW: winW * 0.5, maxPhotoH: winH * 0.22}) : null;
  const items = f.intro;
  const ICONS: IconName[] = ['icon-photo', 'icon-pencil', 'icon-family'];

  return (
    <Screen
      fill
      dockMaxRatio={0.6}
      bottom={
        <>
          <Text20 size={28} weight="bold" accessibilityRole="header">{f.question}</Text20>
          <TwoLineButton title={f.parent} sub={f.parent_sub} onPress={() => onChoose('parent')} />
          <TwoLineButton variant="secondary" title={f.child} sub={f.child_sub} onPress={() => onChoose('child')} />
        </>
      }>
      <View style={styles.brand}>
        <BrandSymbol size={40} />
        <Text20 size={28} weight="bold" style={styles.wordmark}>{f.wordmark}</Text20>
      </View>
      <View accessible accessibilityLabel={[f.intro_title, ...f.intro].join('. ')} style={styles.intro}>
        <Text20 size={24} weight="bold">{f.intro_title}</Text20>
        {showItems
          ? items.map((t, i) => (
              <View key={ICONS[i]} style={styles.item}>
                <Icon name={ICONS[i]} size={24} color={color.ink} />
                {/* 항목은 보통 굵기, 두 줄 허용(셋째 줄의 주어 "자녀가"를 빼지 않는다) */}
                <Text20 style={styles.itemText}>{keepTail(t)}</Text20>
              </View>
            ))
          : null}
      </View>
      <View testID="polaroid-area" style={styles.area} onLayout={onArea}>
        {lay ? (
          <View
            style={[styles.polaroid, {width: lay.frameW, height: lay.frameH}]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={f.polaroid_a11y}>
            <Image
              testID="intro-photo"
              source={assetRegistry['intro-photo']!}
              style={[styles.photo, {width: lay.photoW, height: lay.photoH}]}
              resizeMode="cover"
            />
            <View style={{height: lay.captionH}}>
              <Text20 style={styles.caption} importantForAccessibility="no">{f.polaroid_caption}</Text20>
            </View>
          </View>
        ) : null}
        {lay ? (
          // AI 표기: 틀 밖 아래 보조 글자(사진 제목과 구분)
          <Text20 testID="intro-ai-label" importantForAccessibility="no" style={styles.ai}>
            {f.polaroid_ai}
          </Text20>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16}, // 위 여백 확대(QA 첫 화면 #10)
  wordmark: {color: color.inkTitle},
  intro: {gap: 6},
  item: {flexDirection: 'row', alignItems: 'center', gap: 8},
  itemText: {flexShrink: 1},
  // 남은 높이를 차지하고, 그 안 가운데에 폴라로이드(넘치면 잘라 화면 밖으로 나가지 않게)
  area: {flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  // 종이 사진 느낌: 틀 반경 3, 사진 반경 0(QA 첫 화면 #4)
  polaroid: {backgroundColor: color.card, paddingTop: 8, paddingHorizontal: 8, borderRadius: 3, transform: [{rotate: `-${TILT_DEG}deg`}], boxShadow: '0px 4px 10px rgba(92,78,51,0.22)'},
  photo: {borderRadius: 0, backgroundColor: color.paperSoft},
  caption: {color: color.handwrite, marginTop: 4, textAlign: 'center'},
  ai: {color: color.inkSub, marginTop: 4},
});
