import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Heading} from './Text';
import {ds} from './roles';
import {shadow} from '../tokens';
import {useAudience} from './audience';

const c = ds.color;

/** 면 tone 이 쓰는 바탕 색 이름(글자 tone×면 허용 목록 검사용) */
export const CARD_SURFACE = {paper: 'card', polaroid: 'card', notice: 'paperSoft', outlined: 'card'} as const;

// 면 규칙(SUMMARY 2-6): 흰 카드 = 누르거나 한 덩어리로 읽는 것, 종이 띠(notice) = 안내. 높이는 내용대로(고정 높이 없음).
// outlined = 흰 면 + line 1.5 테두리(누르는 것 아님, 예: C3 번호 카드 — 디자인 결정 PR #83)
export function Card({tone = 'paper', children, testID}: {tone?: keyof typeof CARD_SURFACE; children: React.ReactNode; testID?: string}) {
  return (
    <View testID={testID ?? `card-${tone}`} style={[styles.card, tone === 'polaroid' ? styles.polaroid : tone === 'notice' ? styles.notice : tone === 'outlined' ? styles.outlined : null]}>
      {children}
    </View>
  );
}

/** 섹션: 제목(Heading 2) + 묶음. 섹션 사이 여백은 section(32), 섹션 안 묶음 사이는 audience 별 between */
export function Section({title, children, testID}: {title?: string; children: React.ReactNode; testID?: string}) {
  const a = useAudience();
  return (
    <View testID={testID ?? 'section'} style={[styles.section, {gap: ds.space.between[a]}]}>
      {title ? <Heading level={2}>{title}</Heading> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: c[CARD_SURFACE.paper], borderRadius: ds.radius.card, padding: 20, gap: ds.space.group, alignSelf: 'stretch'},
  polaroid: {backgroundColor: c[CARD_SURFACE.polaroid], borderRadius: ds.radius.chip, padding: 12, paddingBottom: 24, boxShadow: shadow.lifted},
  notice: {backgroundColor: c[CARD_SURFACE.notice]},
  outlined: {borderWidth: 1.5, borderColor: c.line, padding: 16},
  section: {marginTop: ds.space.section, alignSelf: 'stretch'},
});
