// 속성 기반 테스트의 seed(#181 리뷰): 기본은 고정 seed 로 같은 입력을 돌린다(CI 에서 흔들리지 않게, 실패를 그대로 다시 재현).
// 로컬에서 새 입력을 찾고 싶으면 FC_RANDOM=1, 특정 실패를 재현하려면 FC_SEED=<숫자>.
import fc from 'fast-check';

declare const process: {env: Record<string, string | undefined>};
export const FC_SEED = Number(process.env.FC_SEED ?? 20261120);
if (process.env.FC_RANDOM !== '1') {
  fc.configureGlobal({seed: FC_SEED});
}
