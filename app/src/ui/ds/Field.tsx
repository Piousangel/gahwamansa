import React, {useId} from 'react';
import {StyleSheet, TextInput, View, type KeyboardTypeOptions, type TextInputProps} from 'react-native';
import {Text} from './Text';
import {ds, minTouch, roleText} from './roles';
import {useAudience} from './audience';

export type FieldKind = 'text' | 'email' | 'otp' | 'word';
// placeholder 금지(SUMMARY 2-8·Q6): prop 자체가 없다. 안내는 칸 위 label + hint(여러 줄, 예시 포함)로, 자판이 열려도 보인다.
export type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  kind?: FieldKind;
  value: string;
  onChangeText: (v: string) => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
  maxLength?: number;
  testID?: string;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
};

const KIND: Record<FieldKind, {keyboardType: KeyboardTypeOptions; multiline: boolean; extra: Partial<TextInputProps>}> = {
  // 자유 글은 여러 줄로 늘어난다(한 줄 칸이 자르지 않게)
  text: {keyboardType: 'default', multiline: true, extra: {}},
  email: {keyboardType: 'email-address', multiline: false, extra: {autoCapitalize: 'none', autoCorrect: false, autoComplete: 'email', textContentType: 'emailAddress'}},
  otp: {keyboardType: 'number-pad', multiline: false, extra: {autoComplete: 'one-time-code', textContentType: 'oneTimeCode'}},
  word: {keyboardType: 'default', multiline: false, extra: {autoCorrect: false}},
};

const c = ds.color;

export function Field({label, hint, error, kind = 'text', value, onChangeText, onSubmitEditing, autoFocus, editable = true, maxLength, testID = 'field', inputRef}: FieldProps) {
  const a = useAudience();
  const k = KIND[kind];
  // 입력 글자는 fieldInput 역할(상한 1.5, 자판 열림과 상관없이). label·hint 는 각 역할 상한(2.0)
  const r = roleText('fieldInput', a);
  const id = useId();
  return (
    <View style={styles.wrap}>
      <Text role="label" nativeID={`${id}-label`}>
        {label}
      </Text>
      {hint ? (
        <Text role="sub" tone="muted" testID={`${testID}-hint`}>
          {hint}
        </Text>
      ) : null}
      <TextInput
        ref={inputRef}
        testID={testID}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={[hint, error].filter(Boolean).join(' ') || undefined}
        accessibilityState={{disabled: !editable}}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        editable={editable}
        maxLength={maxLength}
        keyboardType={k.keyboardType}
        multiline={k.multiline}
        {...k.extra}
        maxFontSizeMultiplier={r.maxFontSizeMultiplier}
        style={[r.style, styles.input, {minHeight: minTouch('primary', a)}, error ? styles.inputError : null]}
      />
      {error ? (
        <Text role="body" tone="danger" testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: ds.space.group, alignSelf: 'stretch'},
  input: {
    backgroundColor: c.card, borderWidth: 2, borderColor: c.line, borderRadius: ds.radius.input,
    paddingHorizontal: 16, paddingVertical: 12, textAlignVertical: 'center',
  },
  inputError: {borderColor: c.dangerInk, borderWidth: 3},
});
