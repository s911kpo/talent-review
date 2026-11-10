import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useRef_ } from './referenceData';
import type { Question } from '../../lib/review/types';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

/** Renders the small markdown subset used by the guidance bank, as elements rather than raw HTML. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(list.ordered
      ? <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
      : <ul key={blocks.length} className="list-disc space-y-1 pl-5">{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const bullet = line.match(/^-\s+(.*)$/);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flush();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((ordered ?? bullet)![1]);
      continue;
    }
    if (line === '') {
      flush();
      continue;
    }
    flush();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push(heading
      ? <p key={blocks.length} className="mt-3 font-semibold">{inline(heading[1])}</p>
      : <p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

export function GuidePanel({ question, onClose }: { question: Question; onClose: () => void }) {
  const { t } = useTranslation();
  const { pick } = useRef_();
  const sections = [
    { title: t('wizard.guideWhy'), body: pick(question.guide_zh, question.guide_en), tone: '' },
    { title: t('wizard.guideGood'), body: pick(question.good_example_zh, question.good_example_en), tone: 'bg-ok-bg text-ok-fg' },
    { title: t('wizard.guideWeak'), body: pick(question.weak_example_zh, question.weak_example_en), tone: 'bg-warn-bg text-warn-fg' },
    { title: t('wizard.guidePitfalls'), body: pick(question.pitfalls_zh, question.pitfalls_en), tone: '' },
  ].filter((s) => s.body);

  return (
    <aside
      aria-label={t('wizard.guide')}
      className="card fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-b-none p-4 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none xl:static xl:z-auto xl:w-auto xl:rounded-card xl:self-start"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{pick(question.title_zh, question.title_en)}</h2>
        <button type="button" className="btn-secondary px-2 py-1" aria-label={t('wizard.closeGuide')} onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 space-y-4">
        {sections.map((s) => (
          <section key={s.title} className={s.tone ? `rounded-card p-3 ${s.tone}` : ''}>
            <h3 className="mb-1 text-sm font-medium">{s.title}</h3>
            <Markdown text={s.body} />
          </section>
        ))}
      </div>
    </aside>
  );
}
