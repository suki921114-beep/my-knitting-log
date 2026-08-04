import { Component, ErrorInfo, ReactNode } from 'react';
import { captureError } from '@/lib/errorLog';

/** componentStack 첫 줄만 뽑아 어느 컴포넌트에서 터졌는지 표시 */
function firstFrame(stack: string): string {
  return stack.trim().split('\n')[0]?.trim() ?? '';
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 렌더 중 예외가 나면 흰 화면 대신 안내를 보여준다.
 * (예: 컴포넌트 내부 ReferenceError — 예전 EntityPicker 의 qaInput 미정의 같은 케이스)
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // 버그 신고 화면에서 볼 수 있도록 로컬 로그에 남긴다
    captureError(error, `ErrorBoundary${info.componentStack ? ` @${firstFrame(info.componentStack)}` : ''}`);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-serif text-lg font-semibold text-ink">화면을 불러오지 못했어요</h1>
        <p className="text-sm text-muted-foreground">
          예기치 못한 오류가 발생했어요. 아래 버튼으로 다시 시도해 주세요.
        </p>
        <pre className="max-h-32 w-full max-w-md overflow-auto rounded-xl bg-secondary/60 p-3 text-left text-[11px] text-muted-foreground">
          {error.message}
        </pre>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            홈으로
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.location.assign('/settings/bug-report')}
          className="text-[12px] text-muted-foreground underline underline-offset-2"
        >
          이 오류 신고하기
        </button>
      </div>
    );
  }
}
