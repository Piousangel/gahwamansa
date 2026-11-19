import React, {useEffect, useRef, useState, type RefObject} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Sheet, Text} from '../../ui/ds';
import {ds} from '../../ui/ds/roles';
import {Icon} from '../../ui/assets/icons';
import {announce} from '../../ui/a11y';
import {copy} from '../../copy/copy';
import {defaultStore, type KeyValueStore} from '../../lib/kvStore';
import {accountKey, PAID_INTEREST_KEY} from '../../lib/accountStore';
import {isQuietEventFailure, type EventName} from '../../api/contract/events';
import type {Api} from '../types';

const t = copy.paid;

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
// 확인 표시는 시트 위 토스트 대신 시트 안 버튼 위 한 줄(디자인 판정 11-18 ③ 수용, 시안 갱신됨).
// v4: 부품만 ui/ds(Sheet·Text·Button). 문구·가격·이벤트는 오너 결정(O-10) 전이라 그대로. 버튼·확인 줄은 시트 footer(스크롤 밖 고정)
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
  const fallbackFocus = useRef(null); // ds Sheet 는 돌려줄 포커스가 필수 — 호출부가 안 주면(단독 테스트) 빈 ref

  useEffect(() => {
    let alive = true;
    api
      .accountTag()
      .then(tag => (tag ? store.getItem(accountKey(PAID_INTEREST_KEY, tag)) : null))
      .then(v => {
        if (alive && v === '1') {
          setDone(true); // 켜기만(늦게 온 읽기가 방금 누른 '관심 남김'을 되돌리지 않게)
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [store, api]);

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
    api
      .accountTag()
      .then(tag => (tag ? store.setItem(accountKey(PAID_INTEREST_KEY, tag), '1') : undefined))
      .catch(() => {});
    announce(t.toast);
  };

  return (
    <Sheet
      testID="paid-sheet"
      visible={visible}
      title={t.title}
      sub={t.body}
      closeLabel={t.close}
      onClose={onClose}
      returnFocusRef={returnFocusRef ?? fallbackFocus}
      footer={
        <>
          {justNow ? (
            // 디자인 판정 11-18 ③: 버튼 바로 위 초록 면 + 체크 한 줄. 화면 읽기는 announce 1회(포커스 이동 없음), 다시 열면 없음
            <View testID="paid-done" style={styles.done}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="icon-check" size={22} color={ds.color.doneInk} />
              </View>
              <View style={styles.doneText}>
                <Text role="body" tone="done">
                  {t.toast}
                </Text>
              </View>
            </View>
          ) : null}
          <Button kind="primary" size="dock" label={done ? t.button_done : t.button} onPress={interest} disabled={done} />
        </>
      }>
      <Text role="bodyLg">{t.notice}</Text>
      <View testID="paid-prices" style={styles.prices} accessible>
        <Text role="sub" tone="muted">
          {t.price_label}
        </Text>
        <Text role="body">{price(t.plan_month, PAID_PRICES.monthly)}</Text>
        <Text role="body">{price(t.plan_year, PAID_PRICES.yearly)}</Text>
        <Text role="body">{price(t.plan_gift, PAID_PRICES.gift)}</Text>
        <Text role="sub" tone="muted">
          {t.plan_gift_sub}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  prices: {backgroundColor: ds.color.paperSoft, borderRadius: ds.radius.card, padding: 16, gap: 4, alignSelf: 'stretch'},
  done: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ds.color.doneSoft, borderRadius: ds.radius.card, paddingVertical: 10, paddingHorizontal: 14},
  doneText: {flex: 1},
});
