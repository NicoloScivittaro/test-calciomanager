import React, { useRef, useState } from 'react';
import { Bell, Euro, Calendar, Download, Upload, Menu } from 'lucide-react';
import { NewsItem } from '../../types';
import {
  createCareerBackup,
  downloadCareerBackup,
  parseCareerBackupFile,
  restoreCareerBackup,
  validateCareerBackup
} from '../../utils/careerBackup';

interface TopbarProps {
  currentTab: string;
  budget: number;
  currentMatchDate: string;
  news: NewsItem[];
  markNewsAsRead: (id: string) => void;
  activeDecisionCount?: number;
  careerStorageKeys: string[];
  appDataVersion: string;
  clubName?: string;
  onOpenMobileMenu?: () => void;
}

export default function Topbar({ currentTab, budget, currentMatchDate, news, markNewsAsRead, activeDecisionCount = 0, careerStorageKeys, appDataVersion, clubName, onOpenMobileMenu }: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showBackupMessage = (message: { type: 'success' | 'error'; text: string }) => {
    setBackupMessage(message);
    window.setTimeout(() => setBackupMessage(current => (current === message ? null : current)), 6000);
  };

  const handleExportBackup = () => {
    try {
      const backup = createCareerBackup(careerStorageKeys, appDataVersion, clubName);
      downloadCareerBackup(backup);
      showBackupMessage({ type: 'success', text: 'Salvataggio esportato correttamente.' });
    } catch {
      showBackupMessage({ type: 'error', text: 'Esportazione non riuscita. Riprova.' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = await parseCareerBackupFile(file);
      const validation = validateCareerBackup(backup, appDataVersion);
      if (!validation.ok) {
        showBackupMessage({ type: 'error', text: validation.reason ?? 'File di backup non valido.' });
        return;
      }

      const confirmed = window.confirm(
        'Caricando questo salvataggio verrà sostituita la carriera attuale.\nVuoi continuare?'
      );
      if (!confirmed) return;

      try {
        restoreCareerBackup(backup, careerStorageKeys);
        window.location.reload();
      } catch {
        showBackupMessage({ type: 'error', text: 'Ripristino non riuscito: la carriera attuale è stata mantenuta.' });
      }
    } catch (error) {
      showBackupMessage({ type: 'error', text: error instanceof Error ? error.message : 'File di backup non valido.' });
    }
  };

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
      <div className="topbar-title-row">
        <button
          type="button"
          className="sidebar-menu-toggle"
          onClick={onOpenMobileMenu}
          aria-label="Apri menu di navigazione"
        >
          <Menu size={18} />
        </button>
        <h2 className="topbar-title" style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          fontFamily: 'var(--font-heading)'
        }}>
          {getPageTitle(currentTab)}
        </h2>
      </div>

      {/* Center/Right widgets */}
      <div className="topbar-widgets" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>

        {/* Date Widget */}
        <div className="ui-stat-pill" style={{ alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
          <Calendar size={14} style={{ color: 'var(--color-pitch)' }} />
          <span className="topbar-widget-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Prossimo Match:</span>
          <span>{currentMatchDate}</span>
        </div>

        {/* Budget Widget */}
        <div className="ui-stat-pill" style={{
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(16, 185, 129, 0.05)',
          borderColor: 'rgba(16, 185, 129, 0.2)'
        }}>
          <Euro size={14} style={{ color: 'var(--color-lime)' }} />
          <span className="topbar-widget-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Budget Trasferimenti:</span>
          <strong style={{ color: 'var(--color-lime)' }}>{formatCurrency(budget)}</strong>
        </div>

        {activeDecisionCount > 0 && (
          <div className="ui-stat-pill" style={{
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.24)'
          }}>
            <Bell size={14} style={{ color: 'var(--color-gold)' }} />
            <span className="topbar-widget-label" style={{ fontWeight: 700, color: 'var(--color-gold)' }}>Decisioni aperte:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{activeDecisionCount}</strong>
          </div>
        )}

        {/* Career Backup Controls */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportBackup}
            className="btn-secondary"
            style={{ padding: '7px 10px', fontSize: '0.72rem', gap: '6px' }}
            title="Scarica un file JSON con l'intera carriera attuale"
          >
            <Download size={13} />
            Esporta Salvataggio
          </button>
          <button
            onClick={handleImportClick}
            className="btn-secondary"
            style={{ padding: '7px 10px', fontSize: '0.72rem', gap: '6px' }}
            title="Carica un file JSON di backup esportato in precedenza"
          >
            <Upload size={13} />
            Carica Salvataggio
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
          />

          {backupMessage && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '260px',
              maxWidth: '340px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              lineHeight: 1.35,
              zIndex: 210,
              border: `1px solid ${backupMessage.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
              background: backupMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: backupMessage.type === 'success' ? 'var(--color-pitch)' : 'var(--color-danger)'
            }}>
              {backupMessage.text}
            </div>
          )}
        </div>

        {/* Notifications Icon & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifiche"
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
