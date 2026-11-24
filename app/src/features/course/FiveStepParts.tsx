import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Button, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {AiNotice} from '../../ui/AiNotice';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy} from '../../copy/copy';
import {isServerError, hasReason} from '../types';
import {FIVE_STEPS_NOT_READY} from '../../api/contract/fiveSteps';

// 5단계 ②·⑤ 화면이 같이 쓰는 조각(시안 docs/design/2026-11-25-five-steps s2·s3).

/** 사진 80(높이 64) + AI 고지. 100%는 옆, 200%는 아래(시안 s2). 사진은 단서라 화면 읽기에서는 고지 줄만 읽는다. 사진이 없으면 아무것도 없다 */
export function PhotoThumbRow({uri, large}: {uri: string; large: boolean}) {
  const [failed, setFailed] = useState(false);
  if (uri.startsWith('pending://') || failed) {
    return null;
  }
  return (
    <View testID="five-photo" style={[styles.thumbRow, large ? styles.thumbCol : null]}>
      <Image source={{uri}} style={styles.thumb} resizeMode="cover" accessible={false} importantForAccessibility="no" onError={() => setFailed(true)} />
      <View style={styles.thumbText}>
        <AiNotice text={`${appCopy.ai_photo_label}·${appCopy.not_real_place}`} />
      </View>
    </View>
  );
}

/** 넘어가기(100%는 Dock 보조 글자 버튼, 200%는 본문 — P6 200%와 같은 규칙, R-12). 문구는 keyboard.skip(라이터 #2 통일) */
export function SkipInline({onPress, disabled}: {onPress: () => void; disabled?: boolean}) {
  return (
    <View testID="five-skip-inline" style={styles.skipInline}>
      <Button kind="text" size="inline" label={copy.keyboard.skip} disabled={disabled} onPress={onPress} testID="five-skip" />
    </View>
  );
}

/** 저장을 건너뛰고 진행해도 되는 실패: 동의 없음·서버 계약 전(not_ready)·⑤ 플래그 꺼짐. 그 밖(끊김 등)은 알리고 멈춘다 */
export const saveSkippable = (e: unknown): boolean =>
  isServerError(e, 'consent_required') || isServerError(e, 'pass_on_disabled') || hasReason(e, FIVE_STEPS_NOT_READY);

/** 보기 전용 카드(다 마친 뒤 다시 보기): 고른 것만 '고른 답' + ✓(P5 보기 전용과 같은 모양). 누르지 않는다 */
export function ReviewCards({items, chosen}: {items: readonly {key: string; label: string; sub?: string}[]; chosen: string | null}) {
  return (
    <View style={styles.cards}>
      {items.map(it => {
        const on = it.key === chosen;
        return (
          <View
            key={it.key}
            testID={`five-review-${it.key}`}
            accessible
            accessibilityLabel={on ? copy.review.chosen_a11y.split('{값}').join(it.label) : it.label}
            style={[styles.card, on ? styles.chosen : null]}>
            <View style={styles.cardBody}>
              <Text role="title">{it.label}</Text>
              {it.sub ? <Text role="sub" tone={on ? 'default' : 'muted'}>{it.sub}</Text> : null}
            </View>
            {on ? (
              <View style={styles.tag}>
                <Icon name="icon-check" size={28} color={ds.color.doneInk} />
                <Text role="bodyLg" tone="done">{copy.review.chosen}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** ②·⑤ 카드 최소 높이(시안 s2·s3: 64) */
export const FIVE_CARD_MIN_H = 64;

const styles = StyleSheet.create({
  thumbRow: {flexDirection: 'row', alignItems: 'center', columnGap: 12, rowGap: 8},
  thumbCol: {flexDirection: 'column', alignItems: 'flex-start'},
  // 사진 80 × 64(시안 s2) — 폭 + 비율(고정 상자 기준선을 늘리지 않게)
  thumb: {width: 80, aspectRatio: 80 / 64, borderRadius: 3, backgroundColor: ds.color.paperSoft},
  thumbText: {flexShrink: 1},
  skipInline: {alignItems: 'center'},
  cards: {gap: ds.touch.elder.gap},
  card: {minHeight: FIVE_CARD_MIN_H, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderRadius: ds.radius.row, borderWidth: 1.5, borderColor: ds.color.line, backgroundColor: ds.color.card, paddingVertical: 12, paddingHorizontal: 20},
  chosen: {borderWidth: 5, borderColor: ds.color.action, backgroundColor: ds.color.actionSoft, paddingHorizontal: 16.5, paddingVertical: 8.5},
  cardBody: {flexGrow: 1, flexShrink: 1, flexBasis: '100%', gap: 2},
  tag: {flexDirection: 'row', alignItems: 'center', gap: 8},
});
