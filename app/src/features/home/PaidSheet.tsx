import React, {useEffect, useRef, useState, type RefObject} from 'react';
import {StyleSheet, View} from 'react-native';
import {BottomSheet} from '../../ui/BottomSheet';
import {Text20} from '../../ui/Text20';
import {announce} from '../../ui/a11y';
import {copy} from '../../copy/copy';
import {color, radius} from '../../ui/tokens';
import {defaultStore, type KeyValueStore} from '../../lib/kvStore';
import {isQuietEventFailure, type EventName} from '../../api/contract/events';
import type {Api} from '../types';

const t = copy.paid;
export const PAID_INTEREST_KEY = 'paid_interest_v1';

// 예정 가격(법률 §2: "예정 가격"으로만). 결제는 빌드 1 밖이라 표시만 한다.
// TODO(가격 확정): biz.md 가정값(월 3,900원·연 34,900원). 선물 이용권 가격은 정해진 값이 없어 한 달 값으로 둠 — 리드·사업 확인 필요
export const PAID_PRICES = {monthly: '3,900원', yearly: '34,900원', gift: '3,900원'} as const;

// 계측은 기다리지 않고 실패해도 화면은 그대로(course/track 과 같은 규칙, 기능 간 import 금지라 여기 둔다)
function track(api: Api, name: EventName) {
  api
    .logEvent(name)
    .then(r => {
      if (!r.ok && !isQuietEventFailure(r) && __DEV__) {
        console.warn(`[log_event] ${name}: ${r.reason}`);
      }
    })
    .catch(() => {});
}

const price = (tpl: string, v: string) => tpl.split('{가격}').join(v);

// C6 곧 유료 시트(빌드 1 축소형, DECISIONS 148): 예정 가격 3안(고르기 없음, 누르는 모양 아님) + '관심 있어요' 한 버튼.
// 결제·연락처·푸시 동의 없음. 누르면 관심 표시(paid_interest_tapped) 후 버튼은 '관심 남김'(비활성), 이 기기에 기억한다.
// 시안은 시트 위 토스트지만 시트(Modal) 위에는 토스트가 그려지지 않고 U2 가 시트 동안 토스트를 숨기므로 같은 문장을 시트 안 한 줄로 보인다.
export function PaidSheet({
  api,
  visible,
  onClose,
  returnFocusRef,
  store: given,
}: {
  api: Api;
  visible: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<unknown>;
  store?: KeyValueStore;
}) {
  const store = useRef(given ?? defaultStore()).current;
  const [done, setDone] = useState(false);
  const [justNow, setJustNow] = useState(false);

  useEffect(() => {
    store
      .getItem(PAID_INTEREST_KEY)
      .then(v => setDone(v === '1'))
      .catch(() => {});
  }, [store]);

  useEffect(() => {
    if (visible) {
      setJustNow(false);
      track(api, 'paid_sheet_opened');
    }
  }, [visible, api]);

  const interest = () => {
    if (done) {
      return;
    }
    setDone(true);
    setJustNow(true);
    track(api, 'paid_interest_tapped'); // 고르기가 없어 plan 은 싣지 않는다
    store.setItem(PAID_INTEREST_KEY, '1').catch(() => {});
    announce(t.toast);
  };

  return (
    <BottomSheet
      testID="paid-sheet"
      visible={visible}
      title={t.title}
      body={t.body}
      closeLabel={t.close}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      primary={{label: done ? t.button_done : t.button, onPress: interest, disabled: done}}>
      <Text20 weight="bold" style={styles.notice}>{t.notice}</Text20>
      <View testID="paid-prices" style={styles.prices} accessible>
        <Text20 weight="bold" style={styles.label}>{t.price_label}</Text20>
        <Text20>{price(t.plan_month, PAID_PRICES.monthly)}</Text20>
        <Text20>{price(t.plan_year, PAID_PRICES.yearly)}</Text20>
        <Text20>{price(t.plan_gift, PAID_PRICES.gift)}</Text20>
        <Text20 style={styles.label}>{t.plan_gift_sub}</Text20>
      </View>
      {justNow ? (
        <Text20 testID="paid-done" weight="bold">
          {t.toast}
        </Text20>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  notice: {color: color.inkTitle},
  prices: {backgroundColor: color.paperSoft, borderRadius: radius.card, padding: 16, gap: 4, marginTop: 8},
  label: {color: color.inkSub},
});
