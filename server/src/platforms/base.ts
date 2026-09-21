export interface PlatformStatus {
  connected: boolean;
  channel?: string;
  error?: string;
  viewerCount?: number;
}

export abstract class BasePlatform {
  abstract readonly name: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(channel: string, message: string): Promise<boolean>;
  abstract isConnected(): boolean;
  abstract getStatus(): PlatformStatus;
}
