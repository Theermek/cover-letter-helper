/** Market statistics page (TASK §8). Counting happens locally, with no LLM call. */

import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STRINGS } from '../config/strings';
import { computeMarketStats, type MarketStats, type SkillStat } from '../lib/statistics';
import { deleteVacancy, listVacancies } from '../storage/db';
import type { VacancyRecord } from '../storage/types';
import '../ui/styles.css';

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SkillRow = ({ skill, total }: { skill: SkillStat; total: number }) => (
  <li className="skill">
    <div className="row-between">
      <strong>{skill.label}</strong>
      <span className="badge">
        {STRINGS.stats.occurrence(skill.vacancyCount, total, skill.percent)}
      </span>
    </div>
    <p className="hint">{STRINGS.stats.requiredShare(skill.requiredPercent)}</p>
    {skill.topContexts.length > 0 && (
      <p className="hint">
        {STRINGS.stats.contextsTitle}: {skill.topContexts.map((c) => c.text).join('; ')}
      </p>
    )}
  </li>
);

const SkillList = ({
  title,
  skills,
  total,
}: {
  title: string;
  skills: SkillStat[];
  total: number;
}) => (
  <section className="card">
    <h2>{title}</h2>
    {skills.length === 0 ? (
      <p className="hint">{STRINGS.stats.empty}</p>
    ) : (
      <ol className="skill-list">
        {skills.map((skill) => (
          <SkillRow key={skill.name} skill={skill} total={total} />
        ))}
      </ol>
    )}
  </section>
);

const Stats = () => {
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(() => {
    void listVacancies().then((records) => {
      setVacancies(records);
      setLoaded(true);
    });
  }, []);

  useEffect(load, [load]);

  // Recomputed from the records, so deleting a vacancy updates the ranking.
  const stats: MarketStats = useMemo(() => computeMarketStats(vacancies), [vacancies]);

  const remove = useCallback(
    async (id: string) => {
      if (!confirm(STRINGS.stats.confirmDelete)) return;
      await deleteVacancy(id);
      load();
    },
    [load],
  );

  if (!loaded) return <p className="hint">{STRINGS.common.loading}</p>;

  return (
    <main className="page stack">
      <div>
        <h1>{STRINGS.stats.title}</h1>
        <p className="hint">{STRINGS.stats.vacancyCount(stats.totalVacancies)}</p>
      </div>

      {stats.totalVacancies === 0 ? (
        <p className="hint">{STRINGS.stats.empty}</p>
      ) : (
        <>
          {!revealed && (
            <div className="row">
              <button type="button" className="primary" onClick={() => setRevealed(true)}>
                {STRINGS.stats.show}
              </button>
            </div>
          )}

          {revealed && (
            <>
              {stats.lowSample && <div className="notice">{STRINGS.stats.lowSample}</div>}
              <SkillList
                title={STRINGS.stats.hardTitle}
                skills={stats.hard}
                total={stats.totalVacancies}
              />
              <SkillList
                title={STRINGS.stats.softTitle}
                skills={stats.soft}
                total={stats.totalVacancies}
              />
            </>
          )}
        </>
      )}

      <section className="card">
        <h2>{STRINGS.stats.vacancyListTitle}</h2>
        {vacancies.length === 0 ? (
          <p className="hint">{STRINGS.stats.empty}</p>
        ) : (
          <ul className="vacancy-list">
            {vacancies.map((vacancy) => (
              <li key={vacancy.id} className="row-between vacancy">
                <span>
                  <strong>{vacancy.company ?? STRINGS.stats.noCompany}</strong>
                  {' — '}
                  {vacancy.title ?? STRINGS.stats.noTitle}
                  <span className="hint"> {formatDate(vacancy.createdAt)}</span>
                </span>
                <button
                  type="button"
                  className="danger icon"
                  onClick={() => void remove(vacancy.id)}
                >
                  {STRINGS.common.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <Stats />
  </StrictMode>,
);
