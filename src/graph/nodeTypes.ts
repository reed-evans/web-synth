import {
  node_sine_osc, node_saw_osc, node_square_osc, node_triangle_osc,
  node_adsr_env, node_gain, node_pan, node_mixer, node_output,
  node_lowpass, node_highpass, node_bandpass, node_notch,
  node_lfo, node_transport, node_delay, node_reverb, node_audio_player,
  param_freq, param_detune, param_phase, param_pulse_width, param_mode,
  param_gain, param_pan,
  param_attack, param_decay, param_sustain, param_release,
  param_attack_curve, param_decay_curve, param_release_curve,
  param_cutoff, param_resonance, param_key_tracking,
  param_rate, param_depth, param_waveform,
  param_time, param_feedback, param_mix, param_reverb_decay, param_damping,
} from 'hyasynth-engine';
import type { NodeTemplate } from './types';

const audio = 'audio';

// Raw param IDs not yet exported by WASM — from engine's params module
const OSC_KEY_TRACKING = 4;
const PITCH_OFFSET = 7;
const STEREO_DETUNE = 8;
// Phase osc node type and params
const PHASE_OSC_TYPE = 5;
const PO_SHAPE = 0;
const PO_ALGORITHM = 1;
const PO_FEEDBACK = 2;
const PO_FORMANT = 3;
const PO_KEY_TRACKING = 4;
const PO_PITCH_RATIO_NUM = 5;
const PO_PITCH_RATIO_DEN = 6;
const PO_DETUNE = 9;

const oscInputs = () => [
  { name: 'pitch in', dataType: audio, index: 0 },
  { name: 'phase in', dataType: audio, index: 1 },
  { name: 'retrig in', dataType: audio, index: 2 },
];

const oscExtraParams = () => [
  { paramId: OSC_KEY_TRACKING, name: 'key trk', defaultValue: 1, min: 0, max: 1, step: 0.01 },
  { paramId: PITCH_OFFSET, name: 'pitch ofs', defaultValue: 0, min: -48, max: 48, step: 1 },
  { paramId: STEREO_DETUNE, name: 'stereo det', defaultValue: 0, min: 0, max: 1, step: 0.01 },
];

const filterParams = () => [
  { paramId: param_cutoff(), name: 'cutoff', defaultValue: 1000, min: 20, max: 20000, step: 1 },
  { paramId: param_resonance(), name: 'resonance', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
  { paramId: param_key_tracking(), name: 'key trk', defaultValue: 0, min: 0, max: 2, step: 0.01 },
];

export function getNodeTemplates(): NodeTemplate[] {
  return [
    // Oscillators
    {
      type: 'sine_osc', label: 'Sine Osc', typeId: node_sine_osc(),
      inputs: oscInputs(), outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.204, 0.667, 0.482],
      params: [
        { paramId: param_freq(), name: 'freq', defaultValue: 440, min: 20, max: 20000, step: 1 },
        { paramId: param_detune(), name: 'detune', defaultValue: 0, min: -100, max: 100, step: 1 },
        ...oscExtraParams(),
      ],
    },
    {
      type: 'saw_osc', label: 'Saw Osc', typeId: node_saw_osc(),
      inputs: oscInputs(), outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.204, 0.667, 0.482],
      params: [
        { paramId: param_freq(), name: 'freq', defaultValue: 440, min: 20, max: 20000, step: 1 },
        { paramId: param_detune(), name: 'detune', defaultValue: 0, min: -100, max: 100, step: 1 },
        ...oscExtraParams(),
      ],
    },
    {
      type: 'square_osc', label: 'Square Osc', typeId: node_square_osc(),
      inputs: oscInputs(), outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.204, 0.667, 0.482],
      params: [
        { paramId: param_freq(), name: 'freq', defaultValue: 440, min: 20, max: 20000, step: 1 },
        { paramId: param_detune(), name: 'detune', defaultValue: 0, min: -100, max: 100, step: 1 },
        { paramId: param_pulse_width(), name: 'pw', defaultValue: 0.5, min: 0.01, max: 0.99, step: 0.01 },
        ...oscExtraParams(),
      ],
    },
    {
      type: 'triangle_osc', label: 'Tri Osc', typeId: node_triangle_osc(),
      inputs: oscInputs(), outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.204, 0.667, 0.482],
      params: [
        { paramId: param_freq(), name: 'freq', defaultValue: 440, min: 20, max: 20000, step: 1 },
        { paramId: param_detune(), name: 'detune', defaultValue: 0, min: -100, max: 100, step: 1 },
        ...oscExtraParams(),
      ],
    },
    // Phase Distortion Oscillator
    {
      type: 'phase_osc', label: 'Phase Osc', typeId: PHASE_OSC_TYPE,
      inputs: oscInputs(), outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.204, 0.667, 0.482],
      params: [
        { paramId: PO_SHAPE, name: 'shape', defaultValue: 0, min: 0, max: 1, step: 0.01 },
        { paramId: PO_ALGORITHM, name: 'algorithm', defaultValue: 0, min: 0, max: 5, step: 1 },
        { paramId: PO_FEEDBACK, name: 'feedback', defaultValue: 0, min: 0, max: 1, step: 0.01 },
        { paramId: PO_FORMANT, name: 'formant', defaultValue: 1, min: 1, max: 9, step: 1 },
        { paramId: PO_KEY_TRACKING, name: 'key trk', defaultValue: 1, min: 0, max: 1, step: 0.01 },
        { paramId: PO_PITCH_RATIO_NUM, name: 'ratio num', defaultValue: 1, min: 0, max: 99, step: 1 },
        { paramId: PO_PITCH_RATIO_DEN, name: 'ratio den', defaultValue: 1, min: 1, max: 99, step: 1 },
        { paramId: PITCH_OFFSET, name: 'pitch ofs', defaultValue: 0, min: -48, max: 48, step: 1 },
        { paramId: STEREO_DETUNE, name: 'stereo det', defaultValue: 0, min: 0, max: 1, step: 0.01 },
        { paramId: PO_DETUNE, name: 'detune', defaultValue: 0, min: -27, max: 27, step: 0.1 },
      ],
    },
    // Envelope
    {
      type: 'adsr_env', label: 'ADSR', typeId: node_adsr_env(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.831, 0.627, 0.216],
      params: [
        { paramId: param_attack(), name: 'attack', defaultValue: 0.01, min: 0.001, max: 10, step: 0.001 },
        { paramId: param_decay(), name: 'decay', defaultValue: 0.1, min: 0.001, max: 10, step: 0.001 },
        { paramId: param_sustain(), name: 'sustain', defaultValue: 0.7, min: 0, max: 1, step: 0.01 },
        { paramId: param_release(), name: 'release', defaultValue: 0.3, min: 0.001, max: 10, step: 0.001 },
        { paramId: param_attack_curve(), name: 'atk crv', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
        { paramId: param_decay_curve(), name: 'dec crv', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
        { paramId: param_release_curve(), name: 'rel crv', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
      ],
    },
    // Utility
    {
      type: 'gain', label: 'Gain', typeId: node_gain(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.227, 0.482, 0.835],
      params: [{ paramId: param_gain(), name: 'gain', defaultValue: 0, min: -60, max: 12, step: 0.1 }],
    },
    {
      type: 'pan', label: 'Pan', typeId: node_pan(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.227, 0.482, 0.835],
      params: [{ paramId: param_pan(), name: 'pan', defaultValue: 0, min: -1, max: 1, step: 0.01 }],
    },
    {
      type: 'mixer', label: 'Mixer', typeId: node_mixer(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.227, 0.482, 0.835],
      params: [{ paramId: param_gain(), name: 'gain', defaultValue: 0, min: -60, max: 12, step: 0.1 }],
    },
    {
      type: 'output', label: 'Output', typeId: node_output(),
      inputs: [
        { name: 'L', dataType: audio, index: 0 },
        { name: 'R', dataType: audio, index: 1 },
      ],
      outputs: [],
      color: [0.914, 0.271, 0.376],
      params: [{ paramId: param_gain(), name: 'master', defaultValue: 0, min: -60, max: 6, step: 0.1 }],
    },
    // Filters
    {
      type: 'lowpass', label: 'Lowpass', typeId: node_lowpass(),
      inputs: [
        { name: 'in', dataType: audio, index: 0 },
        { name: 'cut in', dataType: audio, index: 1 },
      ],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.482, 0.369, 0.655], params: filterParams(),
    },
    {
      type: 'highpass', label: 'Highpass', typeId: node_highpass(),
      inputs: [
        { name: 'in', dataType: audio, index: 0 },
        { name: 'cut in', dataType: audio, index: 1 },
      ],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.482, 0.369, 0.655], params: filterParams(),
    },
    {
      type: 'bandpass', label: 'Bandpass', typeId: node_bandpass(),
      inputs: [
        { name: 'in', dataType: audio, index: 0 },
        { name: 'cut in', dataType: audio, index: 1 },
      ],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.482, 0.369, 0.655], params: filterParams(),
    },
    {
      type: 'notch', label: 'Notch', typeId: node_notch(),
      inputs: [
        { name: 'in', dataType: audio, index: 0 },
        { name: 'cut in', dataType: audio, index: 1 },
      ],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.482, 0.369, 0.655], params: filterParams(),
    },
    // Modulation
    {
      type: 'lfo', label: 'LFO', typeId: node_lfo(),
      inputs: [],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.788, 0.710, 0.184],
      params: [
        { paramId: param_rate(), name: 'rate', defaultValue: 1, min: 0.01, max: 100, step: 0.01 },
        { paramId: param_depth(), name: 'depth', defaultValue: 1, min: 0, max: 1, step: 0.01 },
        { paramId: param_waveform(), name: 'wave', defaultValue: 0, min: 0, max: 4, step: 1 },
      ],
    },
    {
      type: 'transport', label: 'Transport', typeId: node_transport(),
      inputs: [],
      outputs: [
        { name: 'phase', dataType: audio, index: 0 },
        { name: 'trigger', dataType: audio, index: 1 },
      ],
      color: [0.788, 0.710, 0.184],
      params: [
        { paramId: param_rate(), name: 'rate', defaultValue: 1, min: 0.0625, max: 16, step: 0.0625 },
        { paramId: param_mode(), name: 'mode', defaultValue: 0, min: 0, max: 1, step: 1 },
      ],
    },
    // Effects
    {
      type: 'delay', label: 'Delay', typeId: node_delay(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.176, 0.620, 0.620],
      params: [
        { paramId: param_time(), name: 'time', defaultValue: 0.25, min: 0.001, max: 2, step: 0.01 },
        { paramId: param_feedback(), name: 'feedback', defaultValue: 0.4, min: 0, max: 0.99, step: 0.01 },
        { paramId: param_mix(), name: 'mix', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
      ],
    },
    {
      type: 'reverb', label: 'Reverb', typeId: node_reverb(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.176, 0.620, 0.620],
      params: [
        { paramId: param_reverb_decay(), name: 'decay', defaultValue: 0.5, min: 0, max: 0.99, step: 0.01 },
        { paramId: param_damping(), name: 'damping', defaultValue: 0.5, min: 0, max: 1, step: 0.01 },
        { paramId: param_mix(), name: 'mix', defaultValue: 0.3, min: 0, max: 1, step: 0.01 },
      ],
    },
    // Samplers
    {
      type: 'audio_player', label: 'Audio Player', typeId: node_audio_player(),
      inputs: [{ name: 'in', dataType: audio, index: 0 }],
      outputs: [{ name: 'out', dataType: audio, index: 0 }],
      color: [0.620, 0.400, 0.176],
      params: [{ paramId: param_gain(), name: 'gain', defaultValue: 1, min: 0, max: 2, step: 0.01 }],
    },
  ];
}
