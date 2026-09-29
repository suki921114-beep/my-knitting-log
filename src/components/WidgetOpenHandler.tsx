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
      // replace 를 쓰지 않는다. 뒤로가기로 원래 있던 화면에 돌아갈 수 있어야 한다.
      nav(`/projects/${projectId}`);
    });
  }, [nav]);

  return null;
}
