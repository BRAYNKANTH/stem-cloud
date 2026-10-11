import { useState } from 'preact/hooks';
import { COURSE_MAP, type Grade } from '../lib/home-content';

const TABS: { id: 'all' | Grade; label: string }[] = [
  { id: 'all', label: 'All Modules' },
  { id: '10', label: 'Grade 10' },
  { id: '11', label: 'Grade 11' },
  { id: 'exam', label: 'Past Papers' },
];

/** The Home page's course map with its grade filter. Every card is in the server-rendered HTML. */
export default function CourseMap() {
  const [tab, setTab] = useState<'all' | Grade>('all');
  return (
    <>
      <div class="syllabus-nav" role="group" aria-label="Show modules for">
        {TABS.map((t) => (
          <button type="button" class="s-tab-btn" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div class="s-grid">
        {COURSE_MAP.filter((c) => tab === 'all' || c.grade === tab).map((c) => (
          <div class="s-card">
            <div class="s-meta"><span>{c.meta[0]}</span> <span>{c.meta[1]}</span></div>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
