import { useEffect, useState } from 'react';
import { listCycles } from '../../data/admin';
import type { Cycle } from '../../data/team';

/** Cycles for a selector, defaulting to the open one. */
export function useCycleSelection() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listCycles()
      .then((list) => {
        setCycles(list);
        setCycleId((list.find((c) => c.status === 'open') ?? list[0])?.id ?? '');
      })
      .catch(() => setFailed(true));
  }, []);

  return { cycles, cycleId, setCycleId, failed };
}
