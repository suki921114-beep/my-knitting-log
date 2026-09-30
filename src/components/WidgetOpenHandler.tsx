import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onWidgetOpen } from '@/lib/widget';

/**
 * 위젯을 누르면 그 프로젝트 화면으로 보낸다.
 *
 * 라우터 안에 있어야 한다 — navigate 를 쓴다.
 * 웹에서는 아무 일도 하지 않는다 (홈 화면 위젯이라는 것이 없다).
 */
export default function WidgetOpenHandler() {
  const nav = useNavigate();

  useEffect(() => {
    return onWidgetOpen(projectId => {
      // 바로 '도안 보며 뜨기' 로 보낸다. 위젯을 누르는 순간은 대개 다시 뜨려는
      // 순간이라, 프로젝트 화면을 한 번 더 거치게 하면 그만큼이 걸림돌이 된다.
      // 도안이 없는 프로젝트는 그 화면이 알아서 안내한다.
      //
      // replace 를 쓰지 않는다. 뒤로가기로 원래 있던 화면에 돌아갈 수 있어야 한다.
      nav(`/projects/${projectId}/knit`);
    });
  }, [nav]);

  return null;
}
