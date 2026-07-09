import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { ClubHistoryState, Player, PlayerConversationState, PlayerDialogueQuickReply, PlayerSeasonStat } from '../../types';
import { getPlayerProjectRole } from '../../utils/playerProjectRole';
import {
  appendManagerMessage,
  appendPlayerReply,
  applyQuickReply,
  buildRequestContext,
  closeConversation,
  createPlayerDialoguePersona,
  markConversationRead,
  openManualConversation
} from '../../utils/playerDialogue';
import { isRemoteDialogueConfigured, PlayerDialogueProviderMode, requestPlayerDialogue } from '../../utils/playerDialogueProvider';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface PlayerConversationModalProps {
  player: Player;
  playerStats: PlayerSeasonStat[];
  clubHistory?: ClubHistoryState;
  currentRound: number;
  conversationState: PlayerConversationState;
  setConversationState: React.Dispatch<React.SetStateAction<PlayerConversationState>>;
  onApplyMoraleDelta: (playerId: string, delta: number) => void;
  onClose: () => void;
}

const TOPIC_LABELS: Record<string, string> = {
  playing_time: 'Minutaggio',
  project_role: 'Ruolo nel progetto',
  promise: 'Promessa di minutaggio',
  match_reaction: 'Reazione alla partita',
  morale: 'Morale',
  training: 'Allenamento',
  injury_return: 'Rientro da infortunio',
  transfer_interest: 'Interesse di mercato',
  contract_expectation: 'Aspettative di contratto',
  team_conflict: 'Tensioni nello spogliatoio'
};

const toneColor = (tone: string) => (
  tone === 'grateful' ? 'var(--color-pitch)' :
  tone === 'frustrated' ? 'var(--color-danger)' :
  tone === 'confident' ? 'var(--color-gold)' :
  tone === 'direct' ? 'var(--text-primary)' :
  'var(--text-secondary)'
);

export default function PlayerConversationModal({
  player,
  playerStats,
  clubHistory,
  currentRound,
  conversationState,
  setConversationState,
  onApplyMoraleDelta,
  onClose
}: PlayerConversationModalProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedReplies, setSuggestedReplies] = useState<PlayerDialogueQuickReply[]>([]);
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);
  const [useRemote, setUseRemote] = useState(false);
  const [lastUsedFallback, setLastUsedFallback] = useState(false);

  const role = getPlayerProjectRole(player, { seasonStats: playerStats, clubHistory, round: currentRound });
  const stat = playerStats.find(row => row.playerId === player.id);
  const remoteAvailable = isRemoteDialogueConfigured();

  useEffect(() => {
    const result = openManualConversation(conversationState, player, playerStats, clubHistory, currentRound);
    const readState = markConversationRead(result.state, result.conversation.id);
    setConversationState(readState);
    setConversationId(result.conversation.id);
    if (result.suggestedReplies.length > 0) setSuggestedReplies(result.suggestedReplies);
    // Runs once per opened player, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  const conversation = conversationId ? conversationState.conversations.find(c => c.id === conversationId) : undefined;

  const handleSend = async () => {
    const text = freeText.trim();
    if (!text || !conversationId || sending || !conversation) return;
    setSending(true);

    const withManager = appendManagerMessage(conversationState, conversationId, text);
    setConversationState(withManager);
    setFreeText('');

    const updatedConversation = withManager.conversations.find(c => c.id === conversationId)!;
    const persona = conversationState.personas.find(p => p.playerId === player.id) ?? createPlayerDialoguePersona(player, role);
    const requestCtx = buildRequestContext({
      persona, player, role, stat, topic: updatedConversation.topic, problemSummary: updatedConversation.summary,
      conversation: updatedConversation, managerMessage: text
    });
    const mode: PlayerDialogueProviderMode = useRemote && remoteAvailable ? 'remote' : 'local';
    const result = await requestPlayerDialogue(mode, requestCtx);
    setLastUsedFallback(result.usedFallback);

    setConversationState(current => appendPlayerReply(current, conversationId, result.response, false));
    setSuggestedReplies(result.response.suggestedReplies);
    setSending(false);
  };

  const handleQuickReply = (reply: PlayerDialogueQuickReply) => {
    if (!conversationId) return;
    const result = applyQuickReply(conversationState, conversationId, reply, player, playerStats, clubHistory, currentRound);
    setConversationState(result.state);
    if (result.moraleDelta !== 0) onApplyMoraleDelta(player.id, result.moraleDelta);
    setSuggestedReplies(result.suggestedReplies);
    setLastUsedFallback(false);
  };

  const handleCloseConversation = () => {
    if (!conversationId) return;
    setConversationState(current => closeConversation(current, conversationId));
    setSuggestedReplies([]);
  };

  useModalBehavior(true, onClose);

  return (
    <ModalPortal>
    <AnimatePresence>
      <div
        className="player-profile-backdrop quick"
        style={{ zIndex: 4300 }}
        onClick={event => { event.stopPropagation(); onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', damping: 24, stiffness: 230 }}
          className="player-profile-card quick"
          style={{ width: 'min(560px, calc(100vw - 28px))', display: 'flex', flexDirection: 'column', gap: '12px' }}
          onClick={event => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <span className="selection-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageCircle size={13} /> Colloquio con il giocatore
              </span>
              <h3 style={{ marginTop: '6px', fontSize: '1.1rem' }}>{player.name}</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {role.label} · {conversation ? TOPIC_LABELS[conversation.topic] : ''}
              </p>
            </div>
            <button className="btn-secondary" onClick={onClose} aria-label="Chiudi conversazione" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center' }}>
              <X size={15} />
            </button>
          </div>

          {conversation?.relatedPromiseId && player.playingTimePromise && (
            <div style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Promessa collegata: {player.playingTimePromise.currentMinutes}' / {player.playingTimePromise.targetMinutes}' ({player.playingTimePromise.status})
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', padding: '4px 2px' }}>
            {conversation?.messages.map(message => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.sender === 'manager' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '8px 11px',
                  borderRadius: 'var(--radius-sm)',
                  background: message.sender === 'manager' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${message.sender === 'manager' ? 'rgba(16,185,129,0.28)' : 'var(--border-light)'}`
                }}
              >
                {message.isImportant && (
                  <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-gold)', marginBottom: '3px', textTransform: 'uppercase' }}>
                    Messaggio importante
                  </span>
                )}
                <p style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>{message.text}</p>
                <span style={{ fontSize: '0.6rem', color: toneColor(message.tone) }}>{message.tone}</span>
              </div>
            ))}
          </div>

          {lastUsedFallback && (
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Risposta generata localmente (IA remota non disponibile).</span>
          )}

          {suggestedReplies.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {suggestedReplies.map(reply => (
                <button
                  key={reply.label}
                  className="btn-secondary"
                  style={{ padding: '6px 9px', fontSize: '0.68rem' }}
                  onClick={() => handleQuickReply(reply)}
                >
                  {reply.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={freeText}
              onChange={event => setFreeText(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') handleSend(); }}
              placeholder="Scrivi un messaggio al giocatore..."
              disabled={sending}
              style={{
                flex: 1, padding: '9px 11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                background: 'rgba(11,15,20,0.4)', color: 'var(--text-primary)', fontSize: '0.78rem'
              }}
            />
            <button className="btn-primary" onClick={handleSend} disabled={sending || !freeText.trim()} style={{ padding: '9px 12px' }}>
              <Send size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {remoteAvailable ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={useRemote} onChange={event => setUseRemote(event.target.checked)} />
                Usa IA remota
              </label>
            ) : <span />}
            <button className="btn-secondary" onClick={handleCloseConversation} style={{ padding: '7px 10px', fontSize: '0.7rem' }}>
              Chiudi conversazione
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </ModalPortal>
  );
}
