import React, {useEffect} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {color, font, FONT_SCALE_MAX, fontSize, radius, shadow, touch} from './tokens';
import {Text20} from './Text20';
import {Icon} from './assets/icons';
import {Sun, SunArt} from './assets/sun';
import {SunStamp} from './assets/album';
import {useScreenReader} from './a11y';

/**
 * 해님이 말할 수 있는 때(DECISIONS 11-17 Gemini 회의 권고): 첫 만남·완료·오류뿐.
 * 칭찬·하트 금지, 자녀 화면 금지(테스트로 막음), 한 화면에 큰 해님 하나.
 * 쓰지 말 곳(README §5): 사진 위, 한글 쓰기 영역, 동의·개인정보 화면, 책임·의학 판단 문장.
 */
export type HanimMoment = 'firstMeet' | 'complete' | 'error';
export type SunSize = 88 | 72 | 56 | 40;

type Props = {
  text: string;
  moment: HanimMoment;
  /** 기본: 첫 만남·완료 88, 오류 56. 오류는 걱정 표정이 56 이상에만 있어 40을 줘도 56으로 그린다. */
  size?: SunSize;
  /** 주면 말풍선 오른쪽 아래에 "읽어 주세요" 글자 버튼(아이콘+글자, 높이 64)을 붙인다. 화면 읽기가 켜져 있으면 숨김(TalkBack R16, 소리 겹침). */
  onReadAloud?: () => void;
  testID?: string;
};

const ART: Record<HanimMoment, SunArt> = {firstMeet: 'sun-wave', complete: 'sun-happy', error: 'sun-worry'};

const drawSize = (moment: HanimMoment, size: SunSize): SunSize => (moment === 'error' && size === 40 ? 56 : size);

/** 그릴 그림 이름. 40은 도장(기본 미소)뿐이다. */
export function hanimArt(moment: HanimMoment, size: SunSize): SunArt | 'sun-stamp' {
  return drawSize(moment, size) === 40 ? 'sun-stamp' : ART[moment];
}

const HEART = /[♥❤💕💖💗💓💞💘]|하트/;
const PRAISE = /잘하셨|잘했|훌륭|최고|대단|칭찬|똑똑/;
/** 해님 문구 규칙 위반을 찾는다(개발 중 경고용). 20자 안팎·두 줄까지 → 40자 넘으면 너무 긺. */
export function hanimTextIssues(text: string): Array<'heart' | 'praise' | 'tooLong'> {
  const out: Array<'heart' | 'praise' | 'tooLong'> = [];
  if (HEART.test(text)) out.push('heart');
  if (PRAISE.test(text)) out.push('praise');
  if ([...text].length > 40) out.push('tooLong');
  return out;
}

export function SunBubble({text, moment, size, onReadAloud, testID}: Props) {
  const s = drawSize(moment, size ?? (moment === 'error' ? 56 : 88));
  const art = hanimArt(moment, s);
  const screenReader = useScreenReader();

  useEffect(() => {
    const issues = hanimTextIssues(text);
    if (__DEV__ && issues.length) {
      console.warn(`[해님 규칙] ${issues.join(',')}: "${text}"`);
    }
  }, [text]);

  return (
    <View testID={testID ?? 'sun-bubble'} style={styles.row}>
      <View
        testID="sun-bubble-art"
        style={{width: s, height: s}}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {art === 'sun-stamp' ? <SunStamp variant={0} size={s} /> : <Sun art={art} size={s} />}
      </View>
      <View style={styles.bubbleWrap}>
        <View style={styles.tail} />
        <View style={styles.bubble} accessible accessibilityLabel={text}>
          <Text20 size={fontSize.bubble} style={styles.text}>
            {text}
          </Text20>
        </View>
        {onReadAloud && !screenReader ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="읽어 주세요"
            onPress={onReadAloud}
            style={({pressed}) => [styles.read, pressed ? styles.readPressed : null]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Icon name="icon-speaker" size={28} color={color.action} />
            </View>
            <Text20 size={22} weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.readText}>
              읽어 주세요
            </Text20>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const TAIL_W = 12;
const TAIL_H = 20;
const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 14},
  bubbleWrap: {flex: 1, justifyContent: 'center'},
  // 왼쪽 꼬리 12x20(삼각형, 흰 면)
  tail: {
    position: 'absolute', left: -TAIL_W + 1, top: '50%', marginTop: -TAIL_H / 2, width: 0, height: 0,
    borderTopWidth: TAIL_H / 2, borderBottomWidth: TAIL_H / 2, borderRightWidth: TAIL_W,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color.card, zIndex: 1,
  },
  bubble: {backgroundColor: color.card, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16, boxShadow: shadow.soft},
  text: {color: color.inkTitle, fontFamily: font.title},
  read: {
    alignSelf: 'flex-end', marginTop: 8, minWidth: touch.iconButton, minHeight: touch.iconButton, borderRadius: touch.iconButton / 2,
    flexDirection: 'row', gap: 6, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.card, borderWidth: 2, borderColor: color.line,
  },
  readText: {color: color.action},
  readPressed: {backgroundColor: color.actionSoft},
});
