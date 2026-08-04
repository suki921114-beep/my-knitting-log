import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_VERSION } from '@/lib/appVersion';

/**
 * 앱 버전이 세 곳에서 어긋나는 것을 막는다.
 * 버그 신고에 찍히는 버전과 스토어에 올라간 버전이 다르면
 * 어느 빌드에서 난 오류인지 추적할 수 없다.
 */
describe('앱 버전 일관성', () => {
  const gradle = readFileSync(resolve(__dirname, '../../android/app/build.gradle'), 'utf-8');

  it('APP_VERSION 이 build.gradle 의 versionName 과 같다', () => {
    const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
    expect(versionName, 'build.gradle 에서 versionName 을 찾지 못했습니다').toBeDefined();
    expect(APP_VERSION).toBe(versionName);
  });

  it('versionCode 는 1 이상의 정수다', () => {
    const code = gradle.match(/versionCode\s+(\d+)/)?.[1];
    expect(code).toBeDefined();
    expect(Number(code)).toBeGreaterThanOrEqual(1);
  });

  it('APP_VERSION 이 x.y.z 형식이다', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
