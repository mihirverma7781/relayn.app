import {useState} from 'react';
import {Sliders, SlidersHorizontal, SunMedium, Clock, RotateCcw, X} from 'lucide-react';
import {
  EQUALIZER_PRESETS,
  type VideoAdjustments,
  initialVideoAdjustments
} from '../player';
import type {PlayerController} from '../usePlayer';

interface EffectsModalProps {
  player: PlayerController;
  adjustments: VideoAdjustments;
  setAdjustments: React.Dispatch<React.SetStateAction<VideoAdjustments>>;
  audioDelay: number;
  setAudioDelay: (val: number) => void;
  subDelay: number;
  setSubDelay: (val: number) => void;
  equalizerBands: number[];
  setEqualizerBands: (bands: number[]) => void;
  equalizerPreset: string;
  setEqualizerPreset: (preset: string) => void;
  onClose: () => void;
}

export default function EffectsModal({
  adjustments,
  setAdjustments,
  audioDelay,
  setAudioDelay,
  subDelay,
  setSubDelay,
  equalizerBands,
  setEqualizerBands,
  equalizerPreset,
  setEqualizerPreset,
  onClose
}: EffectsModalProps) {
  const [tab, setTab] = useState<'eq' | 'video' | 'sync'>('eq');

  const FREQUENCIES = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz', '14kHz', '16kHz'];

  const applyPreset = (key: string) => {
    setEqualizerPreset(key);
    const preset = EQUALIZER_PRESETS[key];
    if (preset) {
      setEqualizerBands([...preset.bands]);
    }
  };

  const updateBand = (idx: number, val: number) => {
    const next = [...equalizerBands];
    next[idx] = val;
    setEqualizerBands(next);
    setEqualizerPreset('custom');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="effects-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title-group">
            <Sliders size={18} className="dialog-icon" />
            <h3>Adjustments & Effects</h3>
          </div>
          <button className="icon-button small" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="effects-tabs">
          <button
            className={`effects-tab-button ${tab === 'eq' ? 'active' : ''}`}
            onClick={() => setTab('eq')}
          >
            <SlidersHorizontal size={15} /> Graphic Equalizer
          </button>
          <button
            className={`effects-tab-button ${tab === 'video' ? 'active' : ''}`}
            onClick={() => setTab('video')}
          >
            <SunMedium size={15} /> Video Adjustments
          </button>
          <button
            className={`effects-tab-button ${tab === 'sync' ? 'active' : ''}`}
            onClick={() => setTab('sync')}
          >
            <Clock size={15} /> Synchronization
          </button>
        </div>

        <div className="dialog-content">
          {/* TAB 1: 10-Band Graphic Equalizer */}
          {tab === 'eq' && (
            <div className="effects-section">
              <div className="eq-topbar">
                <div className="eq-preset-select">
                  <label htmlFor="eq-presets">Preset</label>
                  <select
                    id="eq-presets"
                    value={equalizerPreset}
                    onChange={e => applyPreset(e.target.value)}
                  >
                    {Object.entries(EQUALIZER_PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.name}</option>
                    ))}
                    {equalizerPreset === 'custom' && <option value="custom">Custom</option>}
                  </select>
                </div>

                <button
                  className="button secondary small"
                  onClick={() => applyPreset('flat')}
                >
                  <RotateCcw size={13} /> Reset EQ
                </button>
              </div>

              {/* 10 Vertical Sliders */}
              <div className="equalizer-grid">
                {FREQUENCIES.map((freq, idx) => {
                  const db = equalizerBands[idx] || 0;
                  return (
                    <div key={freq} className="eq-slider-col">
                      <span className="mono eq-db">{db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)}</span>
                      <div className="eq-range-wrapper">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={db}
                          onChange={e => updateBand(idx, parseFloat(e.target.value))}
                          aria-label={`Equalizer ${freq}`}
                        />
                      </div>
                      <span className="mono eq-freq">{freq}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Video Adjustments */}
          {tab === 'video' && (
            <div className="effects-section video-adjustments-section">
              <div className="control-row">
                <div className="control-label">
                  <span>Brightness</span>
                  <span className="mono value">{adjustments.brightness > 0 ? `+${adjustments.brightness}%` : `${adjustments.brightness}%`}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.brightness}
                  onChange={e => setAdjustments(prev => ({...prev, brightness: Number(e.target.value)}))}
                />
              </div>

              <div className="control-row">
                <div className="control-label">
                  <span>Contrast</span>
                  <span className="mono value">{adjustments.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={adjustments.contrast}
                  onChange={e => setAdjustments(prev => ({...prev, contrast: Number(e.target.value)}))}
                />
              </div>

              <div className="control-row">
                <div className="control-label">
                  <span>Saturation</span>
                  <span className="mono value">{adjustments.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  value={adjustments.saturation}
                  onChange={e => setAdjustments(prev => ({...prev, saturation: Number(e.target.value)}))}
                />
              </div>

              <div className="control-row">
                <div className="control-label">
                  <span>Gamma</span>
                  <span className="mono value">{adjustments.gamma.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.05"
                  value={adjustments.gamma}
                  onChange={e => setAdjustments(prev => ({...prev, gamma: Number(e.target.value)}))}
                />
              </div>

              <div className="control-row">
                <div className="control-label">
                  <span>Hue Rotate</span>
                  <span className="mono value">{adjustments.hue}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={adjustments.hue}
                  onChange={e => setAdjustments(prev => ({...prev, hue: Number(e.target.value)}))}
                />
              </div>

              <div className="video-actions-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={adjustments.invert}
                    onChange={e => setAdjustments(prev => ({...prev, invert: e.target.checked}))}
                  />
                  <span>Invert Colors</span>
                </label>

                <button
                  className="button secondary small"
                  onClick={() => setAdjustments(initialVideoAdjustments)}
                >
                  <RotateCcw size={13} /> Reset Video
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Synchronization (Audio & Subtitle Delay) */}
          {tab === 'sync' && (
            <div className="effects-section sync-section">
              <div className="sync-box">
                <div className="sync-header">
                  <h4>Audio Delay</h4>
                  <span className="mono sync-value">{audioDelay > 0 ? `+${audioDelay} ms` : `${audioDelay} ms`}</span>
                </div>
                <p className="sync-hint">Fine-tune if speech is ahead or behind video lipsync (Keys: J / K).</p>
                <div className="sync-controls">
                  <button className="button secondary small" onClick={() => setAudioDelay(audioDelay - 50)}>-50 ms</button>
                  <input
                    type="range"
                    min="-5000"
                    max="5000"
                    step="50"
                    value={audioDelay}
                    onChange={e => setAudioDelay(Number(e.target.value))}
                  />
                  <button className="button secondary small" onClick={() => setAudioDelay(audioDelay + 50)}>+50 ms</button>
                  <button className="icon-button small" title="Reset delay" onClick={() => setAudioDelay(0)}>
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>

              <div className="sync-box">
                <div className="sync-header">
                  <h4>Subtitle Delay</h4>
                  <span className="mono sync-value">{subDelay > 0 ? `+${subDelay} ms` : `${subDelay} ms`}</span>
                </div>
                <p className="sync-hint">Adjust subtitle appearance if titles appear early or late (Keys: H / G).</p>
                <div className="sync-controls">
                  <button className="button secondary small" onClick={() => setSubDelay(subDelay - 50)}>-50 ms</button>
                  <input
                    type="range"
                    min="-5000"
                    max="5000"
                    step="50"
                    value={subDelay}
                    onChange={e => setSubDelay(Number(e.target.value))}
                  />
                  <button className="button secondary small" onClick={() => setSubDelay(subDelay + 50)}>+50 ms</button>
                  <button className="icon-button small" title="Reset delay" onClick={() => setSubDelay(0)}>
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
