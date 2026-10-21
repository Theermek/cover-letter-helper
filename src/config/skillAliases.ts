/**
 * Canonical names for hard skills (TASK §7.1).
 *
 * The model is instructed to normalise names itself; this dictionary is the
 * safety net. It is applied on READ as well as on write, so extending it also
 * improves statistics over vacancies that were saved earlier.
 *
 * Keys are compared case-insensitively with punctuation and spaces stripped,
 * so "React.js", "react js" and "ReactJS" all collapse to the same lookup key.
 */

const RAW_ALIASES: Readonly<Record<string, string>> = {
  reactjs: 'React',
  'react.js': 'React',
  'react js': 'React',
  ts: 'TypeScript',
  'type script': 'TypeScript',
  js: 'JavaScript',
  'java script': 'JavaScript',
  ecmascript: 'JavaScript',
  nodejs: 'Node.js',
  'node js': 'Node.js',
  node: 'Node.js',
  vuejs: 'Vue',
  'vue.js': 'Vue',
  nextjs: 'Next.js',
  'next js': 'Next.js',
  nuxtjs: 'Nuxt',
  angularjs: 'Angular',
  postgres: 'PostgreSQL',
  psql: 'PostgreSQL',
  mongo: 'MongoDB',
  k8s: 'Kubernetes',
  'c#': 'C#',
  csharp: 'C#',
  'c++': 'C++',
  cpp: 'C++',
  golang: 'Go',
  py: 'Python',
  python3: 'Python',
  'rest api': 'REST',
  restful: 'REST',
  'ci cd': 'CI/CD',
  cicd: 'CI/CD',
  'git hub': 'GitHub',
  'gitlab ci': 'GitLab CI',
  html5: 'HTML',
  css3: 'CSS',
  sass: 'SCSS',
  'react native': 'React Native',
  rtl: 'React Testing Library',
  'unit tests': 'Unit testing',
  'unit testing': 'Unit testing',
  тестирование: 'Testing',
  вёрстка: 'HTML/CSS',
  верстка: 'HTML/CSS',
};

/** Normalises a skill name into the dictionary lookup key. */
export const aliasKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[._\-/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ALIASES: ReadonlyMap<string, string> = new Map(
  Object.entries(RAW_ALIASES).map(([key, value]) => [aliasKey(key), value]),
);

/** Returns the canonical spelling, or the trimmed input when unknown. */
export const canonicalSkillName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return ALIASES.get(aliasKey(trimmed)) ?? trimmed;
};
