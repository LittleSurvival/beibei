import { createRoot } from 'react-dom/client';
import { weatherEvents } from './weather-events';
import './styles.css';
import './history.css';

const day = Number(new URLSearchParams(location.search).get('day'));
const back = Number.isFinite(day) && day > 0 ? `./?day=${day}` : './';

function slideshowDay(date: string) {
  return 1 + (Date.parse(date.slice(0, 10)) - Date.parse('2024-03-18')) / 86_400_000;
}

function History() {
  return <>
    <header className="top">
      <a href={back} className="brand"><span className="dot" /> 被被觀察日記</a>
      <a className="history-back" href={back}>← 回到被被</a>
    </header>
    <main className="history-page">
      <h1>被被都經歷了什麼</h1>
      <ol className="weather-tree" aria-label="天氣事件時間線">
        {weatherEvents.map(([date, event]) => <li key={date} className={`weather-event year-${date.slice(0, 4)}`}>
          <span className="event-node" aria-hidden="true" />
          <div className="event-content">
            <a className="event-date" href={`./?day=${slideshowDay(date)}`}
              aria-label={`${date}，查看 Day ${slideshowDay(date)} 的被被`}>{date}</a>
            <p>{event}</p>
          </div>
        </li>)}
      </ol>
    </main>
  </>;
}

createRoot(document.getElementById('root')!).render(<History />);
