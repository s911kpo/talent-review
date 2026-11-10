import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TopControls } from '../../components/AppShell';

const TOTAL = 4;

export function Tour({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const uid = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby={uid}>
      <div className="card w-full max-w-md p-6">
        <p className="text-sm text-muted">{t('tour.stepOf', { n: step, total: TOTAL })}</p>
        <h2 id={uid} className="mt-1 text-lg font-semibold">{t(`tour.title${step}`)}</h2>
        <p className="mt-2 text-sm leading-relaxed">{t(`tour.body${step}`)}</p>
        {step === 1 && <div className="mt-3"><TopControls /></div>}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button type="button" className="text-sm text-muted underline" onClick={onClose}>{t('tour.skip')}</button>
          <div className="flex gap-2">
            {step > 1 && <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>{t('tour.prev')}</button>}
            {step < TOTAL
              ? <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>{t('tour.next')}</button>
              : <button type="button" className="btn-primary" onClick={onClose}>{t('tour.done')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
