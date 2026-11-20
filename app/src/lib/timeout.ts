// 시간 제한 도우미(#208 리뷰 H1). React·RN 을 모른다(lib 규칙).
// - withTimeout: ms 안에 끝나지 않으면 onTimeout() 의 오류로 거절한다(원래 약속은 계속 돌지만 결과는 버린다).
// - settleWithin: 결과와 상관없이 ms 안에 끝난다(실패·지연을 삼킨다). 꼭 기다릴 필요는 없는 정리 작업에 쓴다.

export function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([p, limit]).finally(() => {
    if (t) {
      clearTimeout(t);
    }
  });
}

export function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>(resolve => {
    t = setTimeout(resolve, ms);
  });
  return Promise.race([p.then(
    () => {},
    () => {},
  ), limit]).finally(() => {
    if (t) {
      clearTimeout(t);
    }
  });
}
