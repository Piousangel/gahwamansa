import React, {useState} from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Text20} from '../../ui/Text20';
import {Banner} from '../../ui/Banner';
import {SettingsRow} from '../../ui/SettingsRow';
import {color, radius} from '../../ui/tokens';
import {useInAppWeb} from '../../shared/useInAppWeb';
import {readAppInfo} from '../../lib/appInfo';
import {getAppEnv} from '../../lib/env';
import {bgmAsset} from '../../lib/bgmAsset';
import {copy} from '../../copy/copy';

const ai = copy.app_info;
// 값이 비었을 때 개발·staging 에서만 보이는 표시(사용자 문구 아님 — production 은 빌드가 막는다, 디자인 판정 M8)
const NEEDS_SETUP = '[설정 필요]';

// P13 '앱' 구역 = 앱 정보 한 목록(법률 in-app-notices §3 순서, 디자인 판정 M8, AP-06).
//  1 이용약관 · 2 개인정보 처리방침(앱 안 웹 화면, useInAppWeb: 인터넷 확인 동안 진행 표시·두 번 누름 막기, 안 닿으면 한 줄)
//  3 오픈소스 라이선스(Oss) · 4 AI 안내(사진, 배경 음악은 음원이 있을 때만) · 5 병원 앱 아님 · 6 사업자 정보(누르면 펼침)
//  7 문의하기(법률 Q4: 열람·정정·삭제 요청 경로) — 버전 줄은 호출부(개발자 메뉴 관문과 함께)
// 약관·방침·오픈소스·AI·병원·버전은 값과 무관하게 늘 보인다. 값이 빈 행은 개발·staging 에서 빨간 '[설정 필요]'(숨기지 않음).
export function AppInfoRows() {
  // 라우트 Web·Oss 는 어르신·자녀 스택 공통 이름(app/ 를 import 하지 않으려 여기서 최소 타입만 둔다, 레이어 기준선)
  const navigation = useNavigation<NativeStackNavigationProp<{Web: {target: 'terms' | 'privacy'}; Oss: undefined}>>();
  const info = readAppInfo();
  const dev = getAppEnv().APP_ENV !== 'production';
  const [offline, setOffline] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const web = useInAppWeb(target => navigation.navigate('Web', {target}));
  const open = async (target: 'terms' | 'privacy') => {
    setOffline(false);
    const r = await web.open(target);
    if (r === 'offline') {
      setOffline(true);
    }
  };
  const missing = dev ? NEEDS_SETUP : undefined;
  return (
    <>
      <SettingsRow
        testID="settings-row-terms"
        title={ai.terms}
        sub={info.termsUrl ? (web.busy === 'terms' ? copy.app.loading : undefined) : missing}
        onPress={info.termsUrl ? () => open('terms') : undefined}
      />
      <SettingsRow
        testID="settings-row-privacy"
        title={ai.privacy}
        sub={info.privacyUrl ? (web.busy === 'privacy' ? copy.app.loading : undefined) : missing}
        onPress={info.privacyUrl ? () => open('privacy') : undefined}
      />
      {offline ? <Banner testID="app-info-offline" kind="offline" text={ai.link_offline} /> : null}
      <SettingsRow testID="settings-row-oss" title={ai.oss} sub={ai.oss_intro} onPress={() => navigation.navigate('Oss')} />
      <View testID="settings-ai-notice" accessible style={styles.notice}>
        <Text20 weight="bold">{ai.ai_title}</Text20>
        <Text20>{ai.ai_photo}</Text20>
        {bgmAsset() !== null ? <Text20>{ai.ai_music}</Text20> : null}
      </View>
      <View testID="settings-not-medical" accessible style={styles.notice}>
        <Text20>{ai.not_medical}</Text20>
      </View>
      {info.business ? (
        <>
          <SettingsRow
            testID="settings-row-business"
            title={ai.business_title}
            onPress={() => setBizOpen(o => !o)}
            noChevron
          />
          {bizOpen ? (
            <View testID="settings-business" accessible style={styles.business}>
              <Text20>{`${ai.business.name} ${info.business.name}`}</Text20>
              <Text20>{`${ai.business.ceo} ${info.business.ceo}`}</Text20>
              <Text20>{`${ai.business.reg_no} ${info.business.regNo}`}</Text20>
              <Text20>{`${ai.business.address} ${info.business.address}`}</Text20>
            </View>
          ) : null}
        </>
      ) : (
        <SettingsRow testID="settings-row-business" title={ai.business_title} sub={missing} />
      )}
      <ContactRow mail={info.contactEmail} dev={dev} />
    </>
  );
}

// '문의하기'(법률 Q4, 2026-11-19): 열람·정정·삭제 요청도 이 경로로 받는다(시행령 제41조②2호 — 수집 창구와 같은 쉬운 경로).
// 메일 앱을 열 때 제목 "[가화만사성] 내 정보 보기·지우기 요청"을 채운다. 주소가 아직 없으면 행은 보이되
// 누를 수 없고 '준비하고 있어요' 한 줄(+ 개발·staging 은 '[설정 필요]').
function ContactRow({mail, dev}: {mail: string | null; dev: boolean}) {
  if (!mail) {
    return (
      <SettingsRow
        testID="settings-row-contact"
        title={ai.contact}
        sub={`${dev ? `${NEEDS_SETUP} ` : ''}${ai.contact_pending}\n${ai.contact_request_hint}`}
      />
    );
  }
  const open = () => {
    Linking.openURL(`mailto:${mail}?subject=${encodeURIComponent(ai.contact_request_subject)}`).catch(() => {});
  };
  return (
    <SettingsRow
      testID="settings-row-contact"
      title={ai.contact}
      sub={`${ai.contact_sub} · ${mail}\n${ai.contact_request_hint}`}
      accessibilityHint={ai.contact_request_hint}
      onPress={open}
    />
  );
}

const styles = StyleSheet.create({
  notice: {backgroundColor: color.noticeSoft, borderRadius: radius.card, padding: 16, gap: 6},
  business: {backgroundColor: color.card, borderRadius: radius.card, padding: 16, gap: 4},
});
