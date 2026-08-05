import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// ----------------------------------------------------------------------------
// 2단계 확인이 실제로 2단계로 동작하는지
// ----------------------------------------------------------------------------
// 전체 삭제는 [다음] → [전체 삭제] 두 번을 눌러야 실행된다.
// ConfirmDialog 가 확인 직후 무조건 닫아 버리면, 1단계가 켠 2단계 상태를
// 곧바로 되돌려서 아무 일도 일어나지 않는다. 실제로 그 버그가 있었다.

function TwoStep({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  return (
    <>
      <button onClick={() => setStep(1)}>전체 삭제</button>

      <ConfirmDialog
        open={step === 1}
        onOpenChange={o => !o && setStep(0)}
        title="모든 데이터를 삭제할까요?"
        confirmLabel="다음"
        closeOnConfirm={false}
        onConfirm={() => setStep(2)}
      />

      <ConfirmDialog
        open={step === 2}
        onOpenChange={o => !o && setStep(0)}
        title="되돌릴 수 없어요. 계속할까요?"
        confirmLabel="정말 삭제"
        onConfirm={onDone}
      />
    </>
  );
}

describe('전체 삭제 2단계 확인', () => {
  it('[다음] 을 누르면 2단계가 뜨고, 거기서 확인해야 실행된다', async () => {
    const onDone = vi.fn();
    render(<TwoStep onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: '전체 삭제' }));
    expect(await screen.findByText('모든 데이터를 삭제할까요?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    // 여기가 핵심 — 1단계가 닫히면서 2단계까지 같이 사라지면 안 된다
    expect(await screen.findByText('되돌릴 수 없어요. 계속할까요?')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '정말 삭제' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('중간에 취소하면 실행되지 않는다', async () => {
    const onDone = vi.fn();
    render(<TwoStep onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: '전체 삭제' }));
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
    await screen.findByText('되돌릴 수 없어요. 계속할까요?');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() => expect(onDone).not.toHaveBeenCalled());
  });
});
