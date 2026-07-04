import { Player, Tactic } from '../types';
import { getPlayerSlotFitScore, POSITION_PRESETS } from './tacticsEngine';

export const selectBestLineupForModule = (players: Player[], module: Tactic['module']) => {
  const slots = POSITION_PRESETS[module];
  const used = new Set<string>();

  const starters = slots.map(slot => {
    const candidates = players
      .filter(player => !used.has(player.id) && player.status !== 'Infortunato')
      .map(player => {
        const fit = getPlayerSlotFitScore(player, slot.role);
        const conditionScore = player.condition * 0.08;
        const formScore = player.form * 0.9;
        const roleBonus = fit >= 0.92 ? 8 : fit >= 0.7 ? 2.5 : -9;
        const fatiguePenalty = player.status === 'Stanco' ? 5 : 0;
        return {
          player,
          score: player.overall * fit + conditionScore + formScore + roleBonus - fatiguePenalty
        };
      })
      .sort((a, b) => b.score - a.score || b.player.overall - a.player.overall);

    const pick = candidates[0]?.player;
    if (pick) used.add(pick.id);
    return pick?.id;
  }).filter(Boolean) as string[];

  const bench = players
    .filter(player => !used.has(player.id))
    .sort((a, b) => {
      if (a.status === 'Infortunato' && b.status !== 'Infortunato') return 1;
      if (b.status === 'Infortunato' && a.status !== 'Infortunato') return -1;
      return b.overall - a.overall || b.condition - a.condition || b.potential - a.potential;
    })
    .map(player => player.id);

  return { starters, bench };
};
