import React from 'react';
import {Platform, StyleSheet, TextInput} from 'react-native';
import {color, radius} from '../../ui/tokens';
import {copy} from '../../copy/copy';

// 메일 인증번호 6자리: 기본 숫자 키보드(어르신용 큰 키패드 아님), 일회용 번호 자동 채우기.
export function OtpField({value, onChange}: {value: string; onChange: (v: string) => void}) {
  return (
    <TextInput
      accessibilityLabel={copy.login.code_label}
      value={value}
      onChangeText={v => onChange(v.replace(/[^0-9]/g, '').slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
      maxLength={6}
      autoFocus
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  // 채울 자리: 옅은 면 + 굵은 아래 선(키·버튼과 다른 모양)
  input: {minHeight: 72, fontSize: 34, letterSpacing: 12, textAlign: 'center', fontWeight: 'bold', color: color.ink, backgroundColor: color.paperSoft, borderBottomWidth: 4, borderColor: color.action, borderRadius: radius.input, marginVertical: 12},
});
