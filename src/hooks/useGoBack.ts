// ----------------------------------------------------------------------------
// 저장·취소 뒤에 돌아가기
// ----------------------------------------------------------------------------
// 예전에는 저장하고 나서 목록 주소로 replace 했다.
//
//   [라이브러리] → [도안 목록] → [새 도안]
//   저장하면 '새 도안' 자리를 '도안 목록' 으로 갈아 끼운다
//   [라이브러리] → [도안 목록] → [도안 목록]     ← 같은 화면이 두 번
//
// 그래서 뒤로가기를 누르면 같은 화면으로 가고, 눌린 티는 나는데 아무것도
// 안 바뀐 것처럼 보였다. 한 번 더 눌러야 라이브러리로 나갔다.
//
// 지금은 그냥 왔던 길로 되돌아간다. 쌓인 자리가 하나 줄어들 뿐이라
// 뒤로가기가 늘 한 번에 먹는다.
//
// ⚠️ 알림이나 링크로 곧장 들어와 앞 화면이 없을 수도 있다. 그때 뒤로가기를
//    하면 앱 밖으로 나가버리므로, 그 경우에만 목록 주소로 대신 보낸다.

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useGoBack() {
  const nav = useNavigate();
  const location = useLocation();

  return useCallback(
    (fallback: string) => {
      // react-router 는 앱에서 처음 열린 화면의 key 를 'default' 로 둔다.
      // 그 화면이면 되돌아갈 앞 화면이 없다는 뜻이다.
      if (location.key !== 'default') nav(-1);
      else nav(fallback, { replace: true });
    },
    [nav, location.key],
  );
}
