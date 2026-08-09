import { describe, it, expect } from 'vitest';
import { isProAccount, accountEmail } from '@/lib/entitlement';

// ----------------------------------------------------------------------------
// 클라우드 백업 이용 권한
// ----------------------------------------------------------------------------
// 이 판단이 헐거우면 두 가지가 어긋난다.
//   · 권한 없는 사람에게 열리면 보관 비용이 그만큼 늘어난다.
//   · 권한 있는 사람에게 안 열리면 돈을 받고 못 쓰게 하는 셈이 된다.

describe('이용 권한', () => {
  it('명단에 있는 계정은 열린다', () => {
    expect(isProAccount({ email: 'suki921114@gmail.com' })).toBe(true);
  });

  it('대소문자와 앞뒤 공백은 무시한다', () => {
    // 구글이 주는 값이 늘 소문자라는 보장이 없다
    expect(isProAccount({ email: 'Suki921114@Gmail.com' })).toBe(true);
    expect(isProAccount({ email: '  suki921114@gmail.com  ' })).toBe(true);
  });

  it('명단에 없으면 안 열린다', () => {
    expect(isProAccount({ email: 'someone@gmail.com' })).toBe(false);
  });

  it('로그인하지 않았으면 안 열린다', () => {
    // 누구의 저장 공간인지 알 수 없으니 열어 줄 수가 없다
    expect(isProAccount(null)).toBe(false);
    expect(isProAccount(undefined)).toBe(false);
    expect(isProAccount({ email: null })).toBe(false);
    expect(isProAccount({ email: '' })).toBe(false);
    expect(isProAccount({ email: '   ' })).toBe(false);
  });

  it('비슷하게 생긴 주소는 다른 주소다', () => {
    expect(isProAccount({ email: 'suki921114@gmail.com.kr' })).toBe(false);
    expect(isProAccount({ email: 'xsuki921114@gmail.com' })).toBe(false);
  });
});

describe('화면에 보여줄 주소', () => {
  it('다듬어서 돌려준다 — 신청할 때 이 주소를 알려야 한다', () => {
    expect(accountEmail({ email: '  Suki921114@Gmail.com ' })).toBe('suki921114@gmail.com');
    expect(accountEmail(null)).toBe('');
  });
});
