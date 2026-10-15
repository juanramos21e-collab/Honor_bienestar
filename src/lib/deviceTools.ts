import { registerPlugin } from '@capacitor/core';
export const deviceTools = registerPlugin<{
  speak(options: { text: string }): Promise<void>;
  cue(): Promise<void>;
  requestMicrophone(): Promise<{ granted: boolean }>;
  listen(): Promise<{ transcript: string }>;
  stop(): Promise<void>;
  saveFile(options: { filename: string; mime: string; base64: string }): Promise<void>;
}>('DeviceTools');
