import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Linking, PixelRatio, StyleSheet, View} from 'react-native';
import {WebView, type WebViewNavigation} from 'react-native-webview';
import type {ShouldStartLoadRequest} from 'react-native-webview/lib/WebViewTypes';
import {Text20} from './Text20';
import {color, space} from './tokens';

// 앱 안 웹 화면 본문(AU-07, 시안 P13_more '앱 정보 → 이용약관(앱 안 웹 화면)'). 문구는 props(ui 는 copy 를 모름).
// 보안(리뷰 대상): 정적 고지 페이지 전용 — JS·저장소·쿠키·파일 접근·여러 창 끔, https 만.
// 같은 호스트의 https 문서만 안에서 열고, 다른 https 주소·mailto 는 사용자가 누른 경우에만 휴대폰 앱(브라우저·메일)으로, 그 밖(intent·javascript·file·http)은 막는다.
// 글자 크기는 휴대폰 글자 배율을 따른다(textZoom).
export function hostOf(url: string): string | null {
  const m = /^https:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1].toLowerCase() : null;
}

/** 이 주소를 웹뷰 안에서 열지(true), 밖으로 넘길지·막을지(false) — 순수 함수, 테스트 대상 */
export function decideNavigation(url: string, allowedHost: string): 'load' | 'external' | 'block' {
  if (url === 'about:blank') {
    return 'load';
  }
  const host = hostOf(url);
  if (host && host === allowedHost) {
    return 'load';
  }
  if (host || /^mailto:[^\s]+$/i.test(url)) {
    return 'external';
  }
  return 'block';
}

type Props = {
  url: string;
  errorText: string;
  loadingLabel: string;
  testID?: string;
};

export function WebPage({url, errorText, loadingLabel, testID}: Props) {
  const allowedHost = hostOf(url);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const onShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      if (!allowedHost) {
        return false;
      }
      const d = decideNavigation(req.url, allowedHost);
      if (d === 'external' && req.isTopFrame !== false) {
        Linking.openURL(req.url).catch(() => {});
      }
      return d === 'load';
    },
    [allowedHost],
  );
  if (!allowedHost) {
    return null;
  }
  return (
    <View style={styles.box} testID={testID}>
      {state === 'error' ? (
        <Text20 accessibilityLiveRegion="polite" style={styles.error}>{errorText}</Text20>
      ) : (
        <WebView
          source={{uri: url}}
          style={styles.web}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadEnd={() => setState(s => (s === 'error' ? s : 'ready'))}
          onError={() => setState('error')}
          onHttpError={() => setState('error')}
          onNavigationStateChange={(_: WebViewNavigation) => {}}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          incognito
          cacheEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          geolocationEnabled={false}
          mediaPlaybackRequiresUserAction
          allowsInlineMediaPlayback={false}
          setBuiltInZoomControls={false}
          textZoom={Math.round(PixelRatio.getFontScale() * 100)}
        />
      )}
      {state === 'loading' ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={color.ink} accessibilityLabel={loadingLabel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {flex: 1, backgroundColor: color.paper},
  web: {flex: 1, backgroundColor: color.paper},
  loading: {...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center'},
  error: {padding: space.screenX, color: color.inkSub},
});
