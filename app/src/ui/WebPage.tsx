import React, {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, Linking, PixelRatio, StyleSheet, View} from 'react-native';
import {WebView} from 'react-native-webview';
import type {ShouldStartLoadRequest, WebViewNavigation} from 'react-native-webview/lib/WebViewTypes';
import {URL as SafeURL} from 'react-native-url-polyfill';
import {Text20} from './Text20';
import {color, space} from './tokens';

// 앱 안 웹 화면 본문(AU-07, 시안 P13_more '앱 정보 → 이용약관(앱 안 웹 화면)'). 문구는 props(ui 는 copy 를 모름).
// 보안(웹뷰 리뷰 2026-11-18): 정적 고지 페이지 전용 — JS·저장소·쿠키·파일 접근·여러 창 끔, https 만.
// - 안에서 여는 주소: URL 로 읽어 https + hostname 정확 일치 + 사용자 정보·포트 없음(M1: `허용호스트:x@evil` 우회 차단).
// - 밖으로: mailto 와 호출부가 준 허용 호스트만(L1: 안드로이드는 사용자가 눌렀는지 알려 주지 않아 리다이렉트로도 열릴 수 있음).
//   그 밖(다른 호스트·intent·javascript·file·http·data)은 막는다.
// - 두 번째 관문(M2): 라이브러리는 판단 응답이 250ms 안에 안 오면 로드를 허용한다 → 로드 시작·탐색 상태 변화 때 주소를 다시 보고
//   아니면 stopLoading + 내용을 숨기고 오류 줄(리다이렉트·meta refresh 도 여기서 걸림).
// 글자 크기는 휴대폰 글자 배율을 따른다(textZoom). RN 기본 URL 은 hostname 등을 구현하지 않아 polyfill 의 URL 을 쓴다.
type Parsed = {protocol: string; username: string; password: string; port: string; hostname: string};
function parse(url: string): Parsed | null {
  try {
    return new SafeURL(url) as unknown as Parsed;
  } catch {
    return null;
  }
}

/** 안에서 열어도 되는 https 주소의 호스트(사용자 정보·포트가 있으면 null) */
export function hostOf(url: string): string | null {
  const u = parse(url);
  if (!u || u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname) {
    return null;
  }
  return u.hostname.toLowerCase();
}

/** 이 주소를 웹뷰 안에서 열지·밖(휴대폰 앱)으로 넘길지·막을지 — 순수 함수, 테스트 대상 */
export function decideNavigation(url: string, allowedHost: string, externalHosts: readonly string[] = []): 'load' | 'external' | 'block' {
  if (url === 'about:blank') {
    return 'load';
  }
  const host = hostOf(url);
  if (host && host === allowedHost) {
    return 'load';
  }
  if (host && externalHosts.includes(host)) {
    return 'external';
  }
  if (/^mailto:[^\s/?#@]+@[^\s/?#@]+$/i.test(url)) {
    return 'external';
  }
  return 'block';
}

type Props = {
  url: string;
  errorText: string;
  loadingLabel: string;
  /** 밖(휴대폰 브라우저)으로 보내도 되는 호스트. 기본 없음 */
  externalHosts?: readonly string[];
  testID?: string;
};

export function WebPage({url, errorText, loadingLabel, externalHosts = [], testID}: Props) {
  const allowedHost = hostOf(url);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const ref = useRef<WebView>(null);
  const onShouldStart = useCallback(
    (req: ShouldStartLoadRequest) => {
      if (!allowedHost) {
        return false;
      }
      const d = decideNavigation(req.url, allowedHost, externalHosts);
      if (d === 'external') {
        Linking.openURL(req.url).catch(() => {});
      }
      return d === 'load';
    },
    [allowedHost, externalHosts],
  );
  // 두 번째 관문: 허용 주소가 아니면 멈추고 내용을 숨긴다(웹뷰를 내리고 오류 줄)
  const guard = useCallback(
    (next: string | undefined) => {
      if (!allowedHost || !next || decideNavigation(next, allowedHost) === 'load') {
        return;
      }
      ref.current?.stopLoading();
      setState('error');
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
          ref={ref}
          source={{uri: url}}
          style={styles.web}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadStart={e => guard(e.nativeEvent.url)}
          onNavigationStateChange={(n: WebViewNavigation) => guard(n.url)}
          onLoadEnd={() => setState(s => (s === 'error' ? s : 'ready'))}
          onError={() => setState('error')}
          onHttpError={() => setState('error')}
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
          <ActivityIndicator color={color.inkSub} accessibilityLabel={loadingLabel} />
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
