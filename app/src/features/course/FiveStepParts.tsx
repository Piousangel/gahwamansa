import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Button, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {AiNotice} from '../../ui/AiNotice';
import {Icon} from '../../ui/assets/icons';
import {appCopy, copy} from '../../copy/copy';

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

type SaveResult = {ok: true} | {ok: false; reason: string};
/**
 * ②·⑤ 확정 = 저장(동의일 때) + 단계 기록. 순서는 **저장 먼저**(리드 결정 #254 QA-2 L3 — 자정을 넘긴 뒤 누르면 기록이 새 날에 먼저 찍히지 않게):
 * - 저장 ok(또는 저장 안 함) → 기록
 * - skipped(넘긴 단계를 다시 함 — 서버는 넘긴 단계 저장을 거부) → 기록(p_skipped:false) → 재저장 1회 → 끝(기록은 이미 함)
 * - stale_day(지난 날 화면) → 기록 없이 'stale'(호출부가 다시 불러 홈으로 — 홈이 새 날로 바뀌는 것이 안내)
 * - 그 밖 거절(consent_required·disabled·no_content·invalid_option·missing_value)은 저장 없이 기록(경고만)
 * - 끊김 등 예외는 그대로 던진다(호출부가 오류 + 다시 하기). 기록 실패는 finish 가 오류를 띄우고 'fail'.
 */
export async function saveAndFinish(a: {save: (() => Promise<SaveResult>) | null; finish: () => Promise<boolean>}): Promise<{result: 'ok' | 'stale' | 'fail'; saved: boolean}> {
  if (!a.save) {
    return {result: (await a.finish()) ? 'ok' : 'fail', saved: false};
  }
  let r = await a.save();
  if (!r.ok && r.reason === 'stale_day') {
    return {result: 'stale', saved: false};
  }
  if (!r.ok && r.reason === 'skipped') {
    if (!(await a.finish())) {
      return {result: 'fail', saved: false};
    }
    r = await a.save();
    if (!r.ok) {
      console.warn(`[5단계] 저장하지 않음: ${r.reason}`);
    }
    return {result: r.ok || r.reason !== 'stale_day' ? 'ok' : 'stale', saved: r.ok};
  }
  if (!r.ok) {
    console.warn(`[5단계] 저장하지 않음: ${r.reason}`);
  }
  return {result: (await a.finish()) ? 'ok' : 'fail', saved: r.ok};
}

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
