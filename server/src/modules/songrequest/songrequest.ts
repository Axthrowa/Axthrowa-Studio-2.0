import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { exec } from 'child_process';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { settingsCache } from '../../core/settings-cache.js';

export interface SongItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  requestedBy: string;
  platform: string;
  thumbnail?: string;
  sourceType?: 'youtube' | 'spotify' | 'ytmusic';
  createdAt: number;
  isPlayed: boolean;
}

export class SongRequestEngine {
  private currentSong: SongItem | null = null;
  private skipVotes: Set<string> = new Set();
  private requiredVotes: number = 3;
  // In-memory cache for fast search responses (0ms on repeated songs)
  private searchCache: Map<string, { videoId: string; title: string; thumbnail?: string }> = new Map();

  async handleSongRequest(message: ChatMessagePayload, args: string[]): Promise<string> {
    const rawQuery = args.join(' ').trim();
    if (!rawQuery) {
      return `@${message.user.displayName}, bir şarkı ismi, YouTube, Spotify veya YouTube Music linki girmelisin! Örnek: !sr Teoman Paramparça`;
    }

    let videoId = '';
    let title = rawQuery;
    let thumbnailUrl = '';
    let videoUrl = '';
    let sourceType: 'youtube' | 'spotify' | 'ytmusic' = 'youtube';

    // 1. Check if query is a Spotify Track URL or URI
    const spotifyMatch = rawQuery.match(/(?:https?:\/\/open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      const trackId = spotifyMatch[1];
      sourceType = 'spotify';
      videoUrl = `https://open.spotify.com/track/${trackId}`;
      
      // Fast oEmbed for Spotify title
      try {
        const oembedRes = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(videoUrl)}`, { timeout: 2500 });
        if (oembedRes.data?.title) {
          title = `${oembedRes.data.title} ${oembedRes.data.author_name ? '- ' + oembedRes.data.author_name : ''}`.trim();
          thumbnailUrl = oembedRes.data.thumbnail_url || '';
        }
      } catch {
        title = `Spotify Track (${trackId})`;
      }

      // Auto open in Spotify Desktop if configured
      this.checkAndAutoOpenDesktop('spotify', title, `spotify:track:${trackId}`);
    } 
    // 2. Check if query is YouTube Music URL
    else if (rawQuery.includes('music.youtube.com/watch')) {
      const ytMusicMatch = rawQuery.match(/v=([a-zA-Z0-9_-]{11})/);
      if (ytMusicMatch) {
        videoId = ytMusicMatch[1];
        sourceType = 'ytmusic';
        videoUrl = `https://music.youtube.com/watch?v=${videoId}`;
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } 
    // 3. Check if query is a standard YouTube URL
    else {
      const urlMatch = rawQuery.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (urlMatch) {
        videoId = urlMatch[1];
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // 4. If query is a text search (not a direct URL), check fast cache or search
    if (!videoUrl && !videoId) {
      const cacheKey = rawQuery.toLowerCase();
      if (this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey)!;
        videoId = cached.videoId;
        title = cached.title;
        thumbnailUrl = cached.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        try {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQuery)}`;
          const res = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
            },
            timeout: 2500
          });

          // Match first watch video
          const vidMatch = res.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
          if (vidMatch) {
            videoId = vidMatch[1];
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            // Try fast title extraction from HTML
            const titleMatch = res.data.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1];
            }

            // Cache result for 0ms future queries
            this.searchCache.set(cacheKey, { videoId, title, thumbnail: thumbnailUrl });
          }
        } catch (err: any) {
          console.warn('[SongRequest] Fast search fallback error:', err?.message || err);
        }
      }
    }

    if (!videoUrl && !videoId) {
      return `@${message.user.displayName}, şarkı bulunamadı. Lütfen doğrudan bir YouTube veya Spotify linki deneyin!`;
    }

    // If title is still raw query and we have videoId, fetch title via fast oembed
    if (title === rawQuery && videoId) {
      try {
        const oembed = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 1500 });
        if (oembed.data?.title) {
          title = oembed.data.title;
        }
      } catch {}
    }

    const songId = uuidv4();
    db.prepare(`
      INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(songId, title, videoUrl, 180, message.user.displayName, message.platform, thumbnailUrl, Date.now());

    // Auto open desktop player if enabled
    const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
    if (desktopTarget === 'spotify' || desktopTarget === 'ytmusic') {
      this.openDesktopPlayer(desktopTarget as any, title, videoUrl);
    }

    const queueCount = (db.prepare('SELECT COUNT(*) as count FROM song_queue WHERE is_played = 0').get() as { count: number }).count;

    return `🎵 @${message.user.displayName}, "${title}" sıraya eklendi! (Sıradaki #${queueCount})`;
  }

  /**
   * Launch Desktop Player on Windows (Spotify Desktop or YouTube Music Desktop)
   */
  openDesktopPlayer(player: 'spotify' | 'ytmusic', title: string, url?: string): boolean {
    try {
      if (player === 'spotify') {
        let spotifyUri = '';
        if (url && (url.includes('spotify.com/track/') || url.startsWith('spotify:track:'))) {
          const match = url.match(/(?:track\/|track:)([a-zA-Z0-9]+)/);
          if (match) {
            spotifyUri = `spotify:track:${match[1]}`;
          }
        }
        if (!spotifyUri) {
          // Use Windows Spotify search protocol (opens Spotify desktop app and queries the song)
          spotifyUri = `spotify:search:${encodeURIComponent(title)}`;
        }

        console.log(`[SongRequest] Opening in Spotify Desktop: ${spotifyUri}`);
        exec(`start "" "${spotifyUri}"`, { windowsHide: true });
        return true;
      } 
      else if (player === 'ytmusic') {
        let ytMusicUrl = '';
        if (url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
          const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (match) {
            ytMusicUrl = `https://music.youtube.com/watch?v=${match[1]}`;
          }
        }
        if (!ytMusicUrl) {
          ytMusicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(title)}`;
        }

        console.log(`[SongRequest] Opening in YouTube Music: ${ytMusicUrl}`);
        // Windows start command opens YouTube Music in default browser or desktop PWA app
        exec(`start "" "${ytMusicUrl}"`, { windowsHide: true });
        return true;
      }
    } catch (err: any) {
      console.error('[SongRequest] Error opening desktop player:', err?.message || err);
      return false;
    }
    return false;
  }

  private checkAndAutoOpenDesktop(player: 'spotify' | 'ytmusic', title: string, url: string) {
    const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
    if (desktopTarget === player) {
      this.openDesktopPlayer(player, title, url);
    }
  }

  getCurrentSong(): SongItem | null {
    if (this.currentSong && !this.currentSong.isPlayed) {
      return this.currentSong;
    }
    const row = db.prepare('SELECT * FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC LIMIT 1').get() as any;
    if (!row) return null;

    this.currentSong = {
      id: row.id,
      title: row.title,
      url: row.url,
      duration: row.duration,
      requestedBy: row.requested_by,
      platform: row.platform,
      thumbnail: row.thumbnail,
      createdAt: row.created_at,
      isPlayed: false
    };
    return this.currentSong;
  }

  skipSong(force: boolean = false, userTag?: string): { skipped: boolean; message: string } {
    const current = this.getCurrentSong();
    if (!current) {
      return { skipped: false, message: 'Şu anda çalan bir şarkı yok.' };
    }

    if (force) {
      db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(current.id);
      this.currentSong = null;
      this.skipVotes.clear();
      const next = this.getCurrentSong();
      if (next) {
        const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
        if (desktopTarget === 'spotify' || desktopTarget === 'ytmusic') {
          this.openDesktopPlayer(desktopTarget as any, next.title, next.url);
        }
      }
      return {
        skipped: true,
        message: `⏭️ Şarkı atlandı! ${next ? `Sıradaki: "${next.title}"` : 'Sırada başka şarkı yok.'}`
      };
    }

    if (userTag) {
      this.skipVotes.add(userTag.toLowerCase());
      if (this.skipVotes.size >= this.requiredVotes) {
        db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(current.id);
        this.currentSong = null;
        this.skipVotes.clear();
        const next = this.getCurrentSong();
        if (next) {
          const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
          if (desktopTarget === 'spotify' || desktopTarget === 'ytmusic') {
            this.openDesktopPlayer(desktopTarget as any, next.title, next.url);
          }
        }
        return {
          skipped: true,
          message: `⏭️ Yeterli oy toplandı (${this.requiredVotes} oy)! Şarkı atlandı.`
        };
      } else {
        return {
          skipped: false,
          message: `🗳️ Şarkı atlama oyu verildi (${this.skipVotes.size}/${this.requiredVotes}).`
        };
      }
    }

    return { skipped: false, message: 'Oylama kaydedilemedi.' };
  }

  getQueueList(): SongItem[] {
    const rows = db.prepare('SELECT * FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC LIMIT 15').all() as any[];
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      duration: r.duration,
      requestedBy: r.requested_by,
      platform: r.platform,
      thumbnail: r.thumbnail,
      createdAt: r.created_at,
      isPlayed: false
    }));
  }
}

export const songRequest = new SongRequestEngine();
export default songRequest;
