import React, { useMemo, useState } from 'react';
import type { Project } from '../types';
import { differenceInDays, addDays, format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Props {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export default function ProjectGantt({ projects, onProjectClick }: Props) {
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const daysToShow = 21; // 3週間分表示
  
  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }).map((_, i) => addDays(baseDate, i));
  }, [baseDate]);

  const projectsWithDates = useMemo(() => {
    return projects.map(p => {
      // Dummy logic: Start date is last activity, end date is 1-3 days later based on probability
      const start = new Date(p.lastActivityAt);
      const end = addDays(start, p.probability === 'A' ? 3 : p.probability === 'B' ? 5 : 7);
      return { ...p, start, end };
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [projects]);

  return (
    <div className="card" style={{ padding: '1rem', overflowX: 'auto', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>ガントチャート（向こう3週間）</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setBaseDate(addDays(baseDate, -7))}>先週へ</button>
          <button className="btn btn-outline" onClick={() => setBaseDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}>今週</button>
          <button className="btn btn-outline" onClick={() => setBaseDate(addDays(baseDate, 7))}>次週へ</button>
        </div>
      </div>
      
      <div style={{ minWidth: '800px', display: 'grid', gridTemplateColumns: `200px repeat(${daysToShow}, 1fr)` }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #cbd5e1', padding: '0.5rem', fontWeight: 'bold' }}>プロジェクト名</div>
        {dates.map((d, i) => (
          <div key={i} style={{ 
            borderBottom: '2px solid #cbd5e1', 
            borderLeft: '1px solid #e2e8f0', 
            padding: '0.5rem 0', 
            textAlign: 'center', 
            fontSize: '0.75rem',
            backgroundColor: d.getDay() === 0 ? '#fee2e2' : d.getDay() === 6 ? '#e0f2fe' : 'transparent',
            color: d.getDay() === 0 ? '#ef4444' : d.getDay() === 6 ? '#0ea5e9' : 'inherit'
          }}>
            <div>{format(d, 'M/d')}</div>
            <div>{format(d, 'E', { locale: ja })}</div>
          </div>
        ))}

        {/* Rows */}
        {projectsWithDates.map(p => (
          <React.Fragment key={p.id}>
            <div 
              style={{ borderBottom: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => onProjectClick(p)}
              title={p.clinicName}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.probability === 'A' ? '#ef4444' : p.probability === 'B' ? '#f59e0b' : '#3b82f6', marginRight: '0.5rem', flexShrink: 0 }}></div>
              {p.clinicName}
            </div>
            
            {dates.map((d, i) => {
              const isStart = isSameDay(d, p.start);
              const isEnd = isSameDay(d, p.end);
              const isBetween = d > p.start && d < p.end;
              const isActive = isStart || isEnd || isBetween;

              return (
                <div key={i} style={{ 
                  borderBottom: '1px solid #e2e8f0', 
                  borderLeft: '1px solid #e2e8f0',
                  backgroundColor: d.getDay() === 0 ? '#fef2f2' : d.getDay() === 6 ? '#f0f9ff' : 'transparent',
                  position: 'relative',
                  cursor: 'pointer'
                }} onClick={() => onProjectClick(p)}>
                  {isActive && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '25%', 
                      bottom: '25%',
                      left: isStart ? '10%' : '0',
                      right: isEnd ? '10%' : '0',
                      backgroundColor: p.status === '設置・完了' || p.status === '完了' ? '#10b981' : '#3b82f6',
                      borderRadius: isStart && isEnd ? '4px' : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                      opacity: 0.8
                    }}></div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}