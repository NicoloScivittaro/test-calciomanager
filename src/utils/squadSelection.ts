import { Player, SlotInstruction, Tactic } from '../types';
import { getDefaultSlotInstructions, getInstructionCompatibility, getPlayerSlotFitScore, POSITION_PRESETS } from './tacticsEngine';

// T2: la scelta automatica considera anche il ruolo/compito assegnato allo slot, non solo il ruolo
// base del modulo — cosi' non mette sempre il miglior overall se e' inadatto al compito richiesto
// (es. un centrale lento non diventa mai il wingback_attack ideale solo perche' ha overall alto).
export const selectBestLineupForModule = (
  players: Player[],
  module: Tactic['module'],
  slotInstructions?: Record<string, SlotInstruction>
) => {
  const slots = POSITION_PRESETS[module];
  const instructions = slotInstructions ?? getDefaultSlotInstructions(module);
  const used = new Set<string>();

  const starters = slots.map((slot, index) => {
    const instruction = instructions[`slot_${index}`];
    const candidates = players
      .filter(player => !used.has(player.id) && player.status !== 'Infortunato')
      .map(player => {
        const fit = getPlayerSlotFitScore(player, slot.role);
        const instructionFit = instruction ? getInstructionCompatibility(player, instruction.role).score : fit;
        // Media dei due fit: il ruolo base del modulo conta quanto il compito specifico assegnato.
        const combinedFit = (fit + instructionFit) / 2;
        const conditionScore = player.condition * 0.08;
        const formScore = player.form * 0.9;
        const roleBonus = combinedFit >= 0.92 ? 8 : combinedFit >= 0.7 ? 2.5 : -9;
        const fatiguePenalty = player.status === 'Stanco' ? 5 : 0;
        return {
          player,
          score: player.overall * combinedFit + conditionScore + formScore + roleBonus - fatiguePenalty
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
