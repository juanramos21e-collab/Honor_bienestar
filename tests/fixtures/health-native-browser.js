(() => {
  const model = {
    state: 'available', granted: [], installed: false, sources: [{ id: 'com.hihonor.health', label: 'Salud de HONOR' }],
    entries: [], calls: [], denied: false, readError: false,
  };
  const status = () => ({ availability: model.state, device: { manufacturer: 'Xiaomi', model: 'Dispositivo de prueba', androidVersion: '14' }, apps: [{ id: 'com.hihonor.health', label: 'Salud de HONOR', installed: model.installed }], granted: model.granted });
  window.__health = model; window.androidBridge = {};
  window.Capacitor = {
    PluginHeaders: [{ name: 'HealthData', methods: ['status', 'requestAccess', 'openSetup', 'sources', 'read', 'googleSignIn'].map(name => ({ name, rtype: 'promise' })) }, { name: 'DeviceTools', methods: ['stop', 'speak', 'listen', 'saveFile', 'cue', 'requestMicrophone'].map(name => ({ name, rtype: 'promise' })) }],
    nativePromise: async (plugin, method, options) => {
      model.calls.push({ plugin, method, options });
      if (plugin === 'DeviceTools') return method === 'requestMicrophone' ? { granted: true } : {};
      if (method === 'status') return status();
      if (method === 'requestAccess') { model.granted = model.denied ? [] : ['READ_STEPS', 'READ_SLEEP', 'READ_HEART_RATE']; return status(); }
      if (method === 'openSetup') return {};
      if (method === 'sources') return { sources: model.sources };
      if (method === 'read') {
        if (model.readError) throw new Error('Health Connect denegó el acceso. Revisa los permisos de lectura.');
        return { ...options, entries: model.entries, warnings: [], readAt: new Date().toISOString() };
      }
      throw new Error('Método no previsto: ' + method);
    },
  };
})();
