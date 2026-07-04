import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Sliders, DollarSign, Calendar, Trophy, Zap, RotateCcw, BookOpen } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  coachName: string;
  teamName: string;
  onRestartCareer: () => void;
}

export default function Sidebar({ currentTab, setCurrentTab, coachName, teamName, onRestartCareer }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'squad', label: 'Rosa Giocatori', icon: Users },
    { id: 'tactics', label: 'Lavagna Tattica', icon: Sliders },
    { id: 'market', label: 'Calciomercato', icon: DollarSign },
    { id: 'matches', label: 'Classifica & Calendario', icon: Calendar },
    { id: 'history', label: 'Storia del Club', icon: BookOpen },
  ];

  return (
    <aside className="app-sidebar" style={{
      width: 'var(--sidebar-width)',
      height: '100%',
      backgroundColor: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      zIndex: 100
    }}>
      {/* Brand Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '40px',
        padding: '0 8px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--color-pitch) 0%, var(--color-lime) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
        }}>
          <Trophy size={20} color="#042F1A" strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)'
          }}>
            CALCIO<span style={{ color: 'var(--color-pitch)' }}>MANAGER</span>
          </h1>
          <span style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700
          }}>
            HQ Tactical Suite
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={() => setCurrentTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                border: 'none',
                background: 'none',
                borderRadius: 'var(--radius-sm)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                position: 'relative',
                transition: 'color 0.2s ease',
                fontFamily: 'var(--font-body)'
              }}
            >
              {/* Active Background Slide Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--color-pitch)',
                    zIndex: -1
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <Icon
                size={18}
                style={{
                  color: isActive ? 'var(--color-pitch)' : 'var(--text-muted)',
                  transition: 'color 0.2s ease'
                }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        onClick={onRestartCareer}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '12px',
          padding: '10px 12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.76rem',
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-heading)'
        }}
      >
        <RotateCcw size={14} />
        Ricomincia carriera
      </button>

      {/* Coach Info Profile Panel */}
      <div style={{
        marginTop: 'auto',
        backgroundColor: 'rgba(26, 33, 42, 0.4)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          color: '#1e1b4b',
          fontSize: '0.9rem'
        }}>
          {coachName[0]}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <p style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden'
          }}>
            {coachName}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.65rem',
            color: 'var(--color-pitch)'
          }}>
            <Zap size={10} fill="var(--color-pitch)" />
            <span>{teamName} Manager</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
