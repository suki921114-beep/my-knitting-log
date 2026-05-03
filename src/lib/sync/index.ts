// ----------------------------------------------------------------------------
// sync 모듈 진입점 (barrel re-export)
// ----------------------------------------------------------------------------
// 기존 import 코드(`@/lib/sync`)와의 하위 호환을 위해 모든 entity별
// sync 함수와 공통 타입을 한곳에서 다시 내보낸다.
//
// 신규 코드에서는 entity별 모듈을 직접 import 하는 것도 권장한다.
//   import { calculateYarnSyncDiff } from '@/lib/sync/yarn';

export * from './common';
export * from './yarn';
export * from './pattern';
export * from './needle';
export * from './notion';
export * from './project';
