import React from 'react';
import {Linking} from 'react-native';
import {render, screen} from '@testing-library/react-native';
import {DEFAULT_ENV, APP_INFO_KEYS, type AppEnv} from '../src/lib/env';
import {missingAppInfo, readAppInfo, versionText} from '../src/lib/appInfo';
import {allowedWebUrl, openInAppWeb} from '../src/shared/appLink';
import {decideNavigation, hostOf, WebPage} from '../src/ui/WebPage';

const JS_URL = ['java', 'script:alert(1)'].join(''); // 린트 no-script-url 피함
// AU-07 앱 정보 상수(env 주입) + 앱 안 웹 화면(react-native-webview 17.1.0, 보안 리뷰 대상)
declare const __dirname: string;
const fs: {readFileSync(f: string, e: 'utf8'): string} = require('fs');
const path: {join(...p: string[]): string} = require('path');

const FULL: AppEnv = {
  ...DEFAULT_ENV,
  TERMS_URL: 'https://gahwa.example.kr/terms.html',
  PRIVACY_URL: 'https://gahwa.example.kr/privacy.html',
  CONTACT_EMAIL: 'help@gahwa.example.kr',
  BIZ_NAME: '가화만사성',
  BIZ_CEO: '홍길동',
  BIZ_REG_NO: '123-45-67890',
  BIZ_ADDRESS: '서울특별시 어딘가 1',
  VERSION_NAME: '1.0.0',
  VERSION_CODE: 132,
};

describe('앱 정보 값', () => {
  test('값이 다 있으면 행 전부, 버전은 "1.0.0 (n)"', () => {
    const i = readAppInfo(FULL);
    expect(i).toEqual({
      termsUrl: FULL.TERMS_URL,
      privacyUrl: FULL.PRIVACY_URL,
      contactEmail: FULL.CONTACT_EMAIL,
      business: {name: '가화만사성', ceo: '홍길동', regNo: '123-45-67890', address: '서울특별시 어딘가 1'},
      version: '1.0.0 (132)',
    });
    expect(missingAppInfo(FULL)).toEqual([]);
  });

  test('빈 값·형식이 틀린 값은 숨김(자리표시 금지), 사업자 정보는 넷 다 있어야', () => {
    const i = readAppInfo({...FULL, TERMS_URL: 'http://plain.kr/t', CONTACT_EMAIL: 'nope', BIZ_REG_NO: '12345'});
    expect(i.termsUrl).toBeNull(); // https 만
    expect(i.contactEmail).toBeNull();
    expect(i.business).toBeNull();
    expect(missingAppInfo({...FULL, TERMS_URL: JS_URL, BIZ_ADDRESS: ''})).toEqual(['TERMS_URL', 'BIZ_ADDRESS']);
    expect(missingAppInfo(DEFAULT_ENV)).toEqual([...APP_INFO_KEYS]);
  });

  test('버전: 개발 실행(값 없음)은 1.0.0, 코드 없으면 이름만', () => {
    expect(versionText({VERSION_NAME: '', VERSION_CODE: null})).toBe('1.0.0');
    expect(versionText({VERSION_NAME: '1.2.0', VERSION_CODE: null})).toBe('1.2.0');
  });

  test('Gradle 이 같은 키를 검사하고 env.generated 에 쓴다(빠지면 경고, production release 실패)', () => {
    const g = fs.readFileSync(path.join(__dirname, '../android/app/build.gradle'), 'utf8');
    for (const k of APP_INFO_KEYS) {
      expect(g).toMatch(new RegExp(`\\b${k}:`));
    }
    expect(g).toContain('allowMissingAppInfo');
    expect(g).toContain('APP_INFO_RULES.keySet().collectEntries');
  });
});

describe('앱 안 웹 화면 열기', () => {
  test('주소는 앱 정보 상수에서만(파라미터는 종류)', () => {
    const i = readAppInfo(FULL);
    expect(allowedWebUrl('terms', i)).toBe(FULL.TERMS_URL);
    expect(allowedWebUrl('privacy', readAppInfo(DEFAULT_ENV))).toBeNull();
  });

  test('값이 없으면 unavailable, 오프라인이면 열지 않음, 닿으면 Web 화면으로', async () => {
    const nav = jest.fn();
    expect(await openInAppWeb('terms', nav, async () => true)).toBe('unavailable');
    expect(await openInAppWeb('terms', nav, async () => false, readAppInfo(FULL))).toBe('offline');
    expect(nav).not.toHaveBeenCalled();
    const check = jest.fn(async () => true);
    expect(await openInAppWeb('privacy', nav, check, readAppInfo(FULL))).toBe('opened');
    expect(check).toHaveBeenCalledWith(FULL.PRIVACY_URL);
    expect(nav).toHaveBeenCalledWith('privacy');
  });

  test('링크 판단: 같은 호스트 https 만 안에서, 다른 https·mailto 는 밖으로, 나머지는 막음', () => {
    const h = 'gahwa.example.kr';
    expect(hostOf('https://GAHWA.example.kr/x')).toBe(h);
    expect(decideNavigation('https://gahwa.example.kr/privacy.html#a', h)).toBe('load');
    expect(decideNavigation('https://other.kr/', h)).toBe('external');
    expect(decideNavigation('mailto:help@gahwa.example.kr', h)).toBe('external');
    expect(decideNavigation('http://gahwa.example.kr/', h)).toBe('block');
    expect(decideNavigation('intent://x#Intent;end', h)).toBe('block');
    expect(decideNavigation(JS_URL, h)).toBe('block');
    expect(decideNavigation('file:///etc/hosts', h)).toBe('block');
    expect(decideNavigation('https://gahwa.example.kr.evil.com/', h)).toBe('external');
  });

  test('WebView 보안 설정: JS·저장소·쿠키·파일·여러 창 끔, https 만, 다른 호스트는 막고 밖으로', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    render(<WebPage url={FULL.PRIVACY_URL} errorText="x" loadingLabel="잠시만요" />);
    const w = screen.getByTestId('webview');
    expect(w.props).toMatchObject({
      source: {uri: FULL.PRIVACY_URL},
      originWhitelist: ['https://*'],
      javaScriptEnabled: false,
      domStorageEnabled: false,
      thirdPartyCookiesEnabled: false,
      sharedCookiesEnabled: false,
      incognito: true,
      allowFileAccess: false,
      allowFileAccessFromFileURLs: false,
      allowUniversalAccessFromFileURLs: false,
      mixedContentMode: 'never',
      setSupportMultipleWindows: false,
      geolocationEnabled: false,
    });
    expect(w.props.injectedJavaScript).toBeUndefined();
    expect(w.props.onMessage).toBeUndefined();
    const should = w.props.onShouldStartLoadWithRequest;
    expect(should({url: 'https://gahwa.example.kr/terms.html', isTopFrame: true})).toBe(true);
    expect(should({url: 'https://other.kr/', isTopFrame: true})).toBe(false);
    expect(open).toHaveBeenCalledWith('https://other.kr/');
    expect(should({url: 'intent://evil', isTopFrame: true})).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  test('https 가 아닌 주소는 그리지 않는다', () => {
    render(<WebPage url="http://gahwa.example.kr/" errorText="x" loadingLabel="잠시만요" />);
    expect(screen.queryByTestId('webview')).toBeNull();
  });
});
