import React from 'react';
import {Text20} from '../../ui/Text20';
import {BigButton} from '../../ui/BigButton';
import type {Message} from '../../copy/copy';

export function StepError({error, onRetry}: {error: Message | null; onRetry: () => void}) {
  if (!error) {
    return null;
  }
  return (
    <>
      <Text20 size={24} weight="bold" accessibilityLiveRegion="polite">{error.title}</Text20>
      <Text20>{error.body}</Text20>
      <BigButton variant="secondary" label={error.button} onPress={onRetry} />
    </>
  );
}
