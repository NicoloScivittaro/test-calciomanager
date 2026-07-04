import React, { useState } from 'react';
import { Bell, Euro, Calendar } from 'lucide-react';
import { NewsItem } from '../../types';

interface TopbarProps {
  currentTab: string;
  budget: number;
  currentMatchDate: string;
  news: NewsItem[];
  markNewsAsRead: (id: string) => void;
  activeDecisionCount?: number;
}

export default function Topbar({ currentTab, budget, currentMatchDate, news, markNewsAsRead, activeDecisionCount = 0 }: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Centro Operativo';
      case 'squad': return 'Gestione Rosa';
      case 'tactics': return 'Lavagna Tattica';
      case 'market': return 'Mercato & Trattative';
      case 'matches': return 'Calendario & Classifica';
      case 'history': return 'Storia del Club';
      case 'matchcenter': return 'Match Center';
      default: return 'CalcioManager';
    }
  };

  const unreadNews = news.filter(n => !n.read);

  // Format monetary value
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <header className="app-topbar" style={{
      height: 'var(--topbar-height)',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 90
    }}>
      {/* Page Title */}
      <div>
        <h2 className="topbar-title" style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          fontFamily: 'var(--font-heading)'
        }}>
          {getPageTitle(currentTab)}
        </h2>
      </div>

      {/* Center/Right widgets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        
        {/* Date Widget */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(34, 43, 54, 0.4)',
          border: '1px solid var(--border-light)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem'
        }}>
          <Calendar size={14} style={{ color: 'var(--color-pitch)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Prossimo Match:</span>
          <span style={{ color: 'var(--text-secondary)' }}>{currentMatchDate}</span>
        </div>

        {/* Budget Widget */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem'
        }}>
          <Euro size={14} style={{ color: 'var(--color-lime)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Budget Trasferimenti:</span>
          <span style={{ color: 'var(--color-lime)', fontWeight: 700 }}>{formatCurrency(budget)}</span>
        </div>

        {activeDecisionCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.24)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem'
          }}>
            <Bell size={14} style={{ color: 'var(--color-gold)' }} />
            <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>Decisioni aperte:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{activeDecisionCount}</span>
          </div>
        )}

        {/* Notifications Icon & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              position: 'relative',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Bell size={18} />
            {unreadNews.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-gold)',
                boxShadow: '0 0 6px var(--color-gold)'
              }} />
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '40px',
              right: 0,
              width: '320px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              padding: '16px',
              zIndex: 200
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Notifiche Società</h4>
                {unreadNews.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-gold)', fontWeight: 600 }}>{unreadNews.length} nuove</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {news.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>Nessuna notifica presente</p>
                ) : (
                  news.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNewsAsRead(n.id)}
                      style={{
                        padding: '8px',
                        borderRadius: '4px',
                        backgroundColor: n.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                        borderLeft: n.read ? 'none' : '2.5px solid var(--color-pitch)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = n.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: n.read ? 'var(--text-primary)' : 'var(--color-pitch)' }}>{n.title}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{n.date}</span>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
