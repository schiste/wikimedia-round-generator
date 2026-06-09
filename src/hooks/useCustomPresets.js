import { useCallback, useEffect, useState } from 'react';
import { createPresetId, readCustomPresets, writeCustomPresets } from '../utils/customPresets.js';

export function useCustomPresets() {
  const [presets, setPresets] = useState(readCustomPresets);

  useEffect(() => {
    writeCustomPresets(presets);
  }, [presets]);

  const savePreset = useCallback((name, config) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPresets((current) => [...current, { id: createPresetId(), name: trimmed, config }]);
  }, []);

  const deletePreset = useCallback((id) => {
    setPresets((current) => current.filter((preset) => preset.id !== id));
  }, []);

  // Append imported presets, re-keying ids to avoid collisions with existing ones.
  const importPresets = useCallback((incoming) => {
    setPresets((current) => [...current, ...incoming.map((preset) => ({ ...preset, id: createPresetId() }))]);
  }, []);

  return { presets, savePreset, deletePreset, importPresets };
}
