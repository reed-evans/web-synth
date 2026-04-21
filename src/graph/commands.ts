import type { AudioState } from '../audio';

/**
 * Typed command protocol spoken to the audio worklet.
 *
 * Centralised here so every producer (store, transport) shares one shape
 * and the worklet contract is visible in one place.
 */
export type EngineCommand =
  | { type: 'add_node'; uiId: string; typeId: number; x: number; y: number }
  | { type: 'remove_node'; uiId: string }
  | { type: 'set_output'; uiId: string }
  | { type: 'set_param'; uiId: string; paramId: number; value: number }
  | { type: 'connect'; srcUiId: string; srcPort: number; dstUiId: string; dstPort: number }
  | { type: 'disconnect'; srcUiId: string; srcPort: number; dstUiId: string; dstPort: number }
  | { type: 'add_mod_route'; routeId: string; srcUiId: string; srcPort: number; dstUiId: string; dstParam: number; depth: number }
  | { type: 'remove_mod_route'; routeId: string }
  | { type: 'set_mod_depth'; routeId: string; depth: number }
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'note_on'; note: number; velocity: number }
  | { type: 'note_off'; note: number };

export function sendCommand(audio: AudioState, cmd: EngineCommand): void {
  audio.send(cmd);
}
