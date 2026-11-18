import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text20} from '../../ui/Text20';
import {copy, withTitle} from '../../copy/copy';
import {color, FONT_SCALE_MAX, radius, size} from '../../ui/tokens';
import type {Api, ChildParent} from '../types';
import {defaultStore, type KeyValueStore} from '../../lib/kvStore';
import {newConnection, parseSeen} from './newConnection';
import {takeSkipBanner} from './pushOpen';
import {accountKey, SEEN_PARENTS_KEY} from '../../lib/accountStore';

const n = copy.child.n3;
export const BANNER_MS = 6000;

// N3 앱 안 배너(시안 common/N3_connected): 위쪽 상태 표시줄 아래 12, 흰 바탕·초록 테두리, 6초, '보기'.
// 토스트가 아니라 탭·하단 고정과 겹치지 않는다. 화면 읽기 polite 한 번. 앱을 열 때·앞으로 돌아올 때 확인한다.
export function NewConnectionBanner({api, onView, store: given}: {api: Api; onView: () => void; store?: KeyValueStore}) {
  const store = useRef(given ?? defaultStore()).current;
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<ChildParent | null>(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    try {
      const tag = await api.accountTag();
      if (!tag) {
        return; // 계정을 모르면 기억할 곳이 없다 → 배너 없음
      }
      const key = accountKey(SEEN_PARENTS_KEY, tag);
      const sum = await api.fetchChildSummary();
      const r = newConnection(parseSeen(await store.getItem(key)), sum.parents);
      await store.setItem(key, JSON.stringify(r.nextSeen));
      if (takeSkipBanner()) {
        return; // 연결 알림을 눌러 들어옴: 알림으로 이미 알렸다(AC-03)
      }
      if (r.banner) {
        setBanner(r.banner);
      }
    } catch {
      // 배너는 보조 알림: 실패해도 화면은 그대로
    } finally {
      busy.current = false;
    }
  }, [api, store]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
      }
    });
    return () => sub.remove();
  }, [check]);
  useEffect(() => {
    if (!banner) {
      return;
    }
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) {
    return null;
  }
  const title = withTitle(n.title, banner.title);
  return (
    <View pointerEvents="box-none" style={[styles.layer, {top: insets.top + 12}]}>
      <View testID="n3-banner" style={styles.box} accessibilityLiveRegion="polite">
        <View style={styles.flex} accessible accessibilityLabel={`${title}, ${withTitle(n.body, banner.title)}`}>
          <Text20 weight="bold" style={styles.title}>{title}</Text20>
          <Text20>{withTitle(n.body, banner.title)}</Text20>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={n.view}
          onPress={() => {
            setBanner(null);
            onView();
          }}
          style={({pressed}) => [styles.view, pressed ? styles.pressed : null]}>
          <Text20 weight="bold" maxFontSizeMultiplier={FONT_SCALE_MAX} style={styles.viewText}>{n.view}</Text20>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {position: 'absolute', left: 20, right: 20},
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.card,
    backgroundColor: color.card, borderWidth: 2, borderColor: color.done,
  },
  flex: {flex: 1},
  title: {color: color.inkTitle},
  view: {minHeight: size.touchMin, minWidth: size.touchMin, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8},
  pressed: {opacity: 0.7},
  viewText: {color: color.action, textDecorationLine: 'underline'},
});
