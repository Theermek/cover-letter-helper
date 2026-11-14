/**
 * Market statistics page (TASK §8, TASK2 §1.3).
 *
 * The counting moved to the server together with the code that does it, so this
 * page no longer loads every vacancy to add up skill names: it asks /stats for
 * the finished ranking and /vacancies for one page of the archive.
 */

import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STRINGS } from '../config/strings';
import { fetchStats } from '../api/stats';
import { deleteVacancy, fetchVacancies } from '../api/vacancies';
import { isAppErrorShape } from '../lib/errors';
import type { MarketStats, SkillStat } from '../../shared/dto/stats';
import type { VacancyDto } from '../../shared/dto/vacancy';
import '../ui/styles.css';

const PAGE_SIZE = 50;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [vacancies, setVacancies] = useState<VacancyDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  /** Reloads both halves: deleting a vacancy changes the ranking as well. */
  const load = useCallback(async (limit = PAGE_SIZE) => {
    try {
      const [nextStats, page] = await Promise.all([fetchStats(), fetchVacancies(limit, 0)]);
      setStats(nextStats);
      setVacancies(page.items);
      setTotal(page.total);
      setError(null);
    } catch (caught) {
      setError(isAppErrorShape(caught) ? caught.message : STRINGS.server.failed);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      if (!confirm(STRINGS.stats.confirmDelete)) return;
      try {
        await deleteVacancy(id);
      } catch (caught) {
        setError(isAppErrorShape(caught) ? caught.message : STRINGS.server.failed);
        return;
      }
      // Keep the page size the user had expanded to.
      await load(Math.max(vacancies.length, PAGE_SIZE));
    },
    [load, vacancies.length],
  );

  if (!loaded) return <p className="hint">{STRINGS.common.loading}</p>;

  if (error) {
    return (
      <main className="page stack">
        <h1>{STRINGS.stats.title}</h1>
        <p className="error">{error}</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => void load()}>
            {STRINGS.common.retry}
          </button>
        </div>
      </main>
    );
  }

  const totalVacancies = stats?.totalVacancies ?? 0;

  return (
    <main className="page stack">
      <div>
        <h1>{STRINGS.stats.title}</h1>
        <p className="hint">{STRINGS.stats.vacancyCount(totalVacancies)}</p>
      </div>

      {totalVacancies === 0 ? (
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

          {revealed && stats && (
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
          <>
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
            {vacancies.length < total && (
              <div className="row">
                <span className="hint">{STRINGS.stats.shown(vacancies.length, total)}</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void load(vacancies.length + PAGE_SIZE)}
                >
                  {STRINGS.stats.loadMore}
                </button>
              </div>
            )}
          </>
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
