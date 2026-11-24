import React from 'react';
import {Button, type ButtonProps} from './Button';

/**
 * 설정 들어가기(톱니 아이콘 + 글자) 하나 — 어르신 코스 홈 위 줄·자녀 상단 바(TopBar)·자녀 대기 화면이 같이 쓴다(오너 S25 P-3, 11-24).
 * 모양은 ds Button text(누르는 파랑 글자 + 밑줄)에 톱니 아이콘: R-08(파랑 글자는 아이콘·밑줄·면 중 하나 이상).
 * 크기는 audience(어르신·자녀)로 정해진다. 문구는 호출부가 copy 에서 넘긴다(ui 는 copy 를 모른다).
 */
export function SettingsLink({label, onPress, buttonRef, testID}: Pick<ButtonProps, 'label' | 'onPress' | 'buttonRef' | 'testID'>) {
  return <Button kind="text" size="inline" icon="icon-settings" label={label} onPress={onPress} buttonRef={buttonRef} testID={testID} />;
}
