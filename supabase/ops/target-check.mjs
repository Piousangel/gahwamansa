// 운영 스크립트 공용: 실제 대상(SUPABASE_URL 호스트)이 입력한 환경과 같은지 app/env/<환경>.env의 SUPABASE_PROJECT_REF로 대조한다
// (scripts/db-push.sh와 같은 기준, 리뷰 C-M1). local은 127.0.0.1·localhost만. production은 호스트를 한 번 더 입력받는다.
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline/promises';

/** 순수 검사(테스트용): 문제 문장 또는 null */
export function targetProblem(envName, host, envFileText) {
  if (!['local', 'staging', 'production'].includes(envName)) return '환경 이름은 local·staging·production 중 하나예요';
  const isLocal = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
  if (envName === 'local') return isLocal ? null : `local이라고 했지만 대상이 ${host}예요`;
  if (isLocal) return `${envName}이라고 했지만 대상이 로컬(${host})이에요`;
  const ref = /^SUPABASE_PROJECT_REF=(\S+)/m.exec(envFileText ?? '')?.[1];
  if (!ref) return `app/env/${envName}.env에 SUPABASE_PROJECT_REF가 없어요`;
  if (host !== `${ref}.supabase.co`) return `대상 ${host}가 ${envName}(${ref}.supabase.co)과 달라요`;
  return null;
}

/** 대화형 확인. 맞지 않으면 프로세스를 멈춘다. 돌려주는 값: 환경 이름 */
export async function confirmTarget(root, url, purpose) {
  const host = new URL(url).host;
  console.log(`대상: ${host}  (${purpose})`);
  const rl = createInterface({input: process.stdin, output: process.stdout});
  const envName = (await rl.question('이 대상의 환경 이름을 입력하세요(local|staging|production): ')).trim();
  const envFile = join(root, 'app/env', `${envName}.env`);
  const problem = targetProblem(envName, host, envName !== 'local' && existsSync(envFile) ? readFileSync(envFile, 'utf8') : '');
  if (problem) {
    rl.close();
    console.error(`멈춥니다: ${problem}`);
    process.exit(2);
  }
  if (envName === 'production' && (await rl.question('production입니다. 호스트를 그대로 입력하세요: ')).trim() !== host) {
    rl.close();
    console.error('호스트가 달라 멈춥니다.');
    process.exit(2);
  }
  rl.close();
  return envName;
}
