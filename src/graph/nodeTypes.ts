import {
  node_sine_osc, node_saw_osc, node_square_osc, node_triangle_osc, node_phase_osc,
  node_adsr_env, node_gain, node_pan, node_mixer, node_output,
  node_lowpass, node_highpass, node_bandpass, node_notch,
  node_lfo, node_transport, node_delay, node_reverb, node_audio_player,
  param_freq, param_detune, param_pulse_width, param_mode,
  param_gain, param_pan,
  param_attack, param_decay, param_sustain, param_release,
  param_attack_curve, param_decay_curve, param_release_curve,
  param_cutoff, param_resonance, param_key_tracking,
  param_rate, param_depth, param_waveform,
  param_time, param_feedback, param_mix, param_reverb_decay, param_damping,
  param_osc_key_tracking, param_pitch_offset, param_stereo_detune,
  param_shape, param_algorithm, param_po_feedback, param_formant,
  param_po_key_tracking, param_pitch_ratio_num, param_pitch_ratio_den, param_po_detune,
} from 'hyasynth-engine';
import type { NodeTemplate, ParamTemplate, PortTemplate } from './types';

const AUDIO = 'audio';

/** Category → default body color used for port tints, etc. */
const COLOR = {
  osc:     [0.204, 0.667, 0.482] as [number, number, number],
  mod:     [0.831, 0.627, 0.216] as [number, number, number],
  util:    [0.227, 0.482, 0.835] as [number, number, number],
  output:  [0.914, 0.271, 0.376] as [number, number, number],
  filter:  [0.482, 0.369, 0.655] as [number, number, number],
  lfo:     [0.788, 0.710, 0.184] as [number, number, number],
  fx:      [0.176, 0.620, 0.620] as [number, number, number],
  sampler: [0.620, 0.400, 0.176] as [number, number, number],
};

function port(name: string, index: number): PortTemplate {
  return { name, dataType: AUDIO, index };
}

function param(paramId: number, name: string, defaultValue: number, min: number, max: number, step: number): ParamTemplate {
  return { paramId, name, defaultValue, min, max, step };
}

// Shared port/param groups — keep in sync with the engine's oscillator contract.
const OSC_INPUTS: PortTemplate[] = [port('pitch in', 0), port('phase in', 1), port('retrig in', 2)];
const OSC_OUTPUT: PortTemplate[] = [port('out', 0)];

const oscBaseParams = (): ParamTemplate[] => [
  param(param_freq(),   'freq',   440, 20, 20000, 1),
  param(param_detune(), 'detune', 0,  -100, 100,  1),
];

const oscTailParams = (): ParamTemplate[] => [
  param(param_osc_key_tracking(), 'key trk',    1,   0, 1,  0.01),
  param(param_pitch_offset(),     'pitch ofs',  0, -48, 48, 1),
  param(param_stereo_detune(),    'stereo det', 0,   0, 1,  0.01),
];

const filterInputs = (): PortTemplate[] => [port('in', 0), port('cut in', 1)];

const filterParams = (): ParamTemplate[] => [
  param(param_cutoff(),       'cutoff',    1000, 20, 20000, 1),
  param(param_resonance(),    'resonance', 0.5,  0, 1,      0.01),
  param(param_key_tracking(), 'key trk',   0,    0, 2,      0.01),
];

function osc(type: string, label: string, typeId: number, extraParams: ParamTemplate[] = []): NodeTemplate {
  return {
    type, label, typeId,
    inputs: OSC_INPUTS,
    outputs: OSC_OUTPUT,
    color: COLOR.osc,
    params: [...oscBaseParams(), ...extraParams, ...oscTailParams()],
  };
}

function filter(type: string, label: string, typeId: number): NodeTemplate {
  return {
    type, label, typeId,
    inputs: filterInputs(),
    outputs: OSC_OUTPUT,
    color: COLOR.filter,
    params: filterParams(),
  };
}

function monoFx(type: string, label: string, typeId: number, params: ParamTemplate[]): NodeTemplate {
  return {
    type, label, typeId,
    inputs: [port('in', 0)],
    outputs: [port('out', 0)],
    color: COLOR.fx,
    params,
  };
}

export function getNodeTemplates(): NodeTemplate[] {
  return [
    // Oscillators
    osc('sine_osc',     'Sine Osc',   node_sine_osc()),
    osc('saw_osc',      'Saw Osc',    node_saw_osc()),
    osc('square_osc',   'Square Osc', node_square_osc(), [
      param(param_pulse_width(), 'pw', 0.5, 0.01, 0.99, 0.01),
    ]),
    osc('triangle_osc', 'Tri Osc',    node_triangle_osc()),

    // Phase-distortion osc — dedicated param set, no shared tail
    {
      type: 'phase_osc', label: 'Phase Osc', typeId: node_phase_osc(),
      inputs: OSC_INPUTS, outputs: OSC_OUTPUT,
      color: COLOR.osc,
      params: [
        param(param_shape(),            'shape',     0, 0, 1,  0.01),
        param(param_algorithm(),        'algorithm', 0, 0, 5,  1),
        param(param_po_feedback(),      'feedback',  0, 0, 1,  0.01),
        param(param_formant(),          'formant',   1, 1, 9,  1),
        param(param_po_key_tracking(),  'key trk',   1, 0, 1,  0.01),
        param(param_pitch_ratio_num(),  'ratio num', 1, 0, 99, 1),
        param(param_pitch_ratio_den(),  'ratio den', 1, 1, 99, 1),
        param(param_pitch_offset(),     'pitch ofs', 0, -48, 48, 1),
        param(param_stereo_detune(),    'stereo det', 0, 0, 1, 0.01),
        param(param_po_detune(),        'detune',    0, -27, 27, 0.1),
      ],
    },

    // Envelope
    {
      type: 'adsr_env', label: 'ADSR', typeId: node_adsr_env(),
      inputs: [port('in', 0)], outputs: [port('out', 0)],
      color: COLOR.mod,
      params: [
        param(param_attack(),         'attack',  0.01, 0.001, 10, 0.001),
        param(param_decay(),          'decay',   0.1,  0.001, 10, 0.001),
        param(param_sustain(),        'sustain', 0.7,  0,     1,  0.01),
        param(param_release(),        'release', 0.3,  0.001, 10, 0.001),
        param(param_attack_curve(),   'atk crv', 0.5,  0,     1,  0.01),
        param(param_decay_curve(),    'dec crv', 0.5,  0,     1,  0.01),
        param(param_release_curve(),  'rel crv', 0.5,  0,     1,  0.01),
      ],
    },

    // Utility
    {
      type: 'gain', label: 'Gain', typeId: node_gain(),
      inputs: [port('in', 0)], outputs: [port('out', 0)],
      color: COLOR.util,
      params: [param(param_gain(), 'gain', 0, -60, 12, 0.1)],
    },
    {
      type: 'pan', label: 'Pan', typeId: node_pan(),
      inputs: [port('in', 0)], outputs: [port('out', 0)],
      color: COLOR.util,
      params: [param(param_pan(), 'pan', 0, -1, 1, 0.01)],
    },
    {
      type: 'mixer', label: 'Mixer', typeId: node_mixer(),
      inputs: [port('in', 0)], outputs: [port('out', 0)],
      color: COLOR.util,
      params: [param(param_gain(), 'gain', 0, -60, 12, 0.1)],
    },
    {
      type: 'output', label: 'Output', typeId: node_output(),
      inputs: [port('L', 0), port('R', 1)],
      outputs: [],
      color: COLOR.output,
      params: [param(param_gain(), 'master', 0, -60, 6, 0.1)],
    },

    // Filters
    filter('lowpass',  'Lowpass',  node_lowpass()),
    filter('highpass', 'Highpass', node_highpass()),
    filter('bandpass', 'Bandpass', node_bandpass()),
    filter('notch',    'Notch',    node_notch()),

    // Modulation
    {
      type: 'lfo', label: 'LFO', typeId: node_lfo(),
      inputs: [], outputs: [port('out', 0)],
      color: COLOR.lfo,
      params: [
        param(param_rate(),     'rate',  1, 0.01, 100, 0.01),
        param(param_depth(),    'depth', 1, 0,    1,   0.01),
        param(param_waveform(), 'wave',  0, 0,    4,   1),
      ],
    },
    {
      type: 'transport', label: 'Transport', typeId: node_transport(),
      inputs: [],
      outputs: [port('phase', 0), port('trigger', 1)],
      color: COLOR.lfo,
      params: [
        param(param_rate(), 'rate', 1, 0.0625, 16, 0.0625),
        param(param_mode(), 'mode', 0, 0,      1,  1),
      ],
    },

    // Effects
    monoFx('delay', 'Delay', node_delay(), [
      param(param_time(),     'time',     0.25, 0.001, 2,    0.01),
      param(param_feedback(), 'feedback', 0.4,  0,     0.99, 0.01),
      param(param_mix(),      'mix',      0.5,  0,     1,    0.01),
    ]),
    monoFx('reverb', 'Reverb', node_reverb(), [
      param(param_reverb_decay(), 'decay',   0.5, 0, 0.99, 0.01),
      param(param_damping(),      'damping', 0.5, 0, 1,    0.01),
      param(param_mix(),          'mix',     0.3, 0, 1,    0.01),
    ]),

    // Samplers
    {
      type: 'audio_player', label: 'Audio Player', typeId: node_audio_player(),
      inputs: [port('in', 0)], outputs: [port('out', 0)],
      color: COLOR.sampler,
      params: [param(param_gain(), 'gain', 1, 0, 2, 0.01)],
    },
  ];
}
