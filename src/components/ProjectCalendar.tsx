import React, { useState } from 'react';
import type { Project } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface Props {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

export default function ProjectCalendar({ projects, onProjectClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const jumpMonths = (months: number) => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth() + months, 1));
  };

  // Calendar logic
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  
  // Pad the grid to have 42 cells (6 weeks) to maintain consistent height
  const calendarCells = [];
  
  // Previous month padding
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true
    });
  }
  
  // Next month padding
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false
    });
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white' }}>
      
      {/* Calendar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={20} color="var(--primary)" />
            {year}年 {month + 1}月
          </h2>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', borderRadius: '0.25rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', border: 'none', borderRadius: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'white' }} onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn" style={{ padding: '0.25rem 1rem', border: 'none', borderRadius: 0, borderRight: '1px solid var(--border-color)', backgroundColor: 'white' }} onClick={goToToday}>
              今日
            </button>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', border: 'none', borderRadius: 0, backgroundColor: 'white' }} onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'white', border: '1px solid var(--border-color)' }} onClick={() => jumpMonths(1)}>+1ヶ月</button>
            <button className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'white', border: '1px solid var(--border-color)' }} onClick={() => jumpMonths(3)}>+3ヶ月</button>
            <button className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'white', border: '1px solid var(--border-color)' }} onClick={() => jumpMonths(6)}>+半年</button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>現地調査</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>設置工事</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
            <div key={day} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.875rem', color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'inherit' }}>
              {day}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, auto)' }}>
          {calendarCells.map((cell, i) => {
            const dateStr = formatDateString(cell.date);
            const today = isToday(cell.date);
            const isSunday = cell.date.getDay() === 0;
            const isSaturday = cell.date.getDay() === 6;
            
            // Find projects for this date
            const surveys = projects.filter(p => p.surveyDate === dateStr);
            const installs = projects.filter(p => p.installationDate === dateStr);
            
            const renderProject = (p: Project, type: 'survey' | 'install') => {
              const pm = p.pipelineMap || {};
              const hasCashless = !!(pm.creditStatus || pm.emoneyStatus || pm.qrStatus);
              const colorDone = !!pm.bodyColor;
              const isInstall = type === 'install';
              
              return (
                <div 
                  key={`${type}-${p.id}`}
                  onClick={() => onProjectClick(p)}
                  style={{ 
                    backgroundColor: isInstall ? '#ecfdf5' : '#eff6ff', 
                    borderLeft: `3px solid ${isInstall ? '#10b981' : '#3b82f6'}`, 
                    padding: '0.25rem 0.5rem', 
                    fontSize: '0.65rem', 
                    borderRadius: '0 0.25rem 0.25rem 0',
                    cursor: 'pointer',
                  }}
                  title={`【${isInstall ? '設置' : '調査'}】${p.clinicName}`}
                >
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ fontWeight: 600, color: isInstall ? '#10b981' : '#3b82f6', marginRight: '0.25rem' }}>{isInstall ? '設置' : '調査'}</span>
                    {p.clinicName}
                  </div>
                  {p.isImplementationProject && (
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '2px', fontSize: '9px' }}>
                      <span title="キャッシュレス">💳{hasCashless ? '✅' : '⏳'}</span>
                      <span title="カラー">🎨{colorDone ? '✅' : '⏳'}</span>
                    </div>
                  )}
                </div>
              );
            };
            
            return (
              <div 
                key={i} 
                style={{ 
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-color)' : 'none',
                  borderBottom: i < 35 ? '1px solid var(--border-color)' : 'none',
                  padding: '0.25rem',
                  backgroundColor: today ? '#fef3c7' : cell.isCurrentMonth ? 'white' : '#f8fafc',
                  opacity: cell.isCurrentMonth ? 1 : 0.5
                }}
              >
                <div style={{ 
                  textAlign: 'right', 
                  fontSize: '0.75rem', 
                  fontWeight: today ? 700 : 400,
                  marginBottom: '0.25rem',
                  color: today ? '#d97706' : isSunday ? '#ef4444' : isSaturday ? '#3b82f6' : 'inherit'
                }}>
                  {cell.date.getDate()}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {surveys.map(p => renderProject(p, 'survey'))}
                  {installs.map(p => renderProject(p, 'install'))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
