import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useRoute, type RouteProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {copy} from '../copy/copy';
import {Text20} from '../ui/Text20';
import {WebPage} from '../ui/WebPage';
import {color, space} from '../ui/tokens';
import {allowedWebUrl, type WebTarget} from '../shared/appLink';
import {BackBar} from './BackBar';

// 앱 안 웹 화면(AU-07, 시안 P13_more '앱 정보 → 이용약관', 자녀 C7 도 같은 화면). 어르신·자녀 스택 공용 라우트 'Web'.
// 파라미터는 주소가 아니라 종류(terms·privacy) — 주소는 앱 정보 상수(env)에서만 꺼낸다(다른 주소를 열 수 없게).
// 열기 전 오프라인 확인·토스트는 호출부(shared/appLink.openInAppWeb).
export type WebParams = {target: WebTarget};

export function WebScreen() {
  const {params} = useRoute<RouteProp<{Web: WebParams}, 'Web'>>();
  const insets = useSafeAreaInsets();
  const url = allowedWebUrl(params.target);
  const title = params.target === 'terms' ? copy.app_info.terms : copy.app_info.privacy;
  return (
    <View style={[styles.root, {paddingTop: Math.max(space.topSafeMin, insets.top + space.md), paddingBottom: insets.bottom}]}>
      <View style={styles.top}>
        <BackBar />
        <Text20 size={28} weight="bold" accessibilityRole="header" style={styles.title}>
          {title}
        </Text20>
      </View>
      {url ? (
        <WebPage testID="web-page" url={url} errorText={copy.app_info.link_offline} loadingLabel={copy.app.loading} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: color.paper},
  top: {paddingHorizontal: space.screenX, paddingBottom: space.sm},
  title: {color: color.inkTitle},
});
