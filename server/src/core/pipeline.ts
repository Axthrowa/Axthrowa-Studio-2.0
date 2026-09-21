import { eventBus, ChatMessagePayload } from './event-bus.js';
import { autoMod } from '../modules/automod/automod.js';
import { commandManager } from '../modules/commands/command-manager.js';
import { db } from '../db/index.js';
import { ttsEngine } from '../modules/tts/tts.js';
import { gamesEngine } from '../modules/games/games.js';
import { triviaEngine } from '../modules/games/trivia-engine.js';
import { economy } from '../modules/economy/economy.js';
import { settingsCache } from './settings-cache.js';
import { shieldModeService } from '../modules/moderation/shield-mode.js';
import { chatRescueService } from '../modules/ai/chat-rescue.js';

export class MessagePipeline {
  private recentBotOutputs: Set<string> = new Set();

  constructor() {
    this.setupListeners();
  }

  init() {
    console.log('[MessagePipeline] Chat message processing pipeline initialized and listening to events.');
  }

  setupListeners() {
    eventBus.on('chat', async (message: ChatMessagePayload) => {
      await this.handleIncomingMessage(message);
    });

    eventBus.on('bot_message', (payload) => {
      if (payload?.message) {
        const text = payload.message.trim();
        this.recentBotOutputs.add(text);
        setTimeout(() => {
          this.recentBotOutputs.delete(text);
        }, 15000);
      }
    });
  }

  async handleIncomingMessage(message: ChatMessagePayload) {
    const rawText = (message.message || '').trim();
    if (!rawText) return;

    // Prevent echoing automated bot outputs
    if (this.recentBotOutputs.has(rawText)) {
      return;
    }

    // Ignore known external chat-bot accounts so their output is not reprocessed
    const u = message.user.username.toLowerCase();
    if (u === 'botrix' || u === 'nightbot' || u === 'streamlabs') {
      return;
    }

    // Check Kick Shared Global Ban List
    if (shieldModeService.isUserBanned(message.user.username)) {
      console.warn(`[ShieldMode] Blocked message from banned user: @${message.user.username}`);
      return;
    }

    // Shield Mode Active Check
    const shield = shieldModeService.getSettings();
    if (shield.isActive) {
      if (shield.subOnly && !message.user.isSub && !message.user.isBroadcaster && !message.user.isMod) {
        return; // Silent suppress in sub-only shield mode
      }
      if (shield.blockLinks && /(https?:\/\/|www\.)\S+/i.test(rawText)) {
        return; // Block links strictly in shield mode
      }
    }

    // Notify Chat Rescue of active conversation
    chatRescueService.recordChatMessage();

    // Record Loyalty (Messages count, watch time activity, loyalty tier, points)
    economy.recordMessage(message);


    // 1. AutoMod Check
    const violation = autoMod.checkMessage(message);
    if (violation) {
      // Send warning to chat
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: `🛡️ AutoMod: @${message.user.displayName}, ${violation.reason}`
      });
      return;
    }

    // 1.5 Bil Bakalım Live Question Vote Check
    if (triviaEngine.getState().status === 'question_active') {
      const voteResult = triviaEngine.submitVote(
        {
          username: message.user.username,
          displayName: message.user.displayName,
          platform: message.platform
        },
        message.message
      );
      if (voteResult.accepted) {
        // Vote registered and overlay updated in real time. Skip command execution for answer letters.
        return;
      }
    }

    // 2. Chat Minigames Check (Live Trivia & Anagram unscramble answers)
    const gameReply = gamesEngine.checkChatMessage(message);
    if (gameReply) {
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: gameReply
      });
      return;
    }

    // 3. Command Processing
    const commandReply = await commandManager.processMessage(message);
    if (commandReply) {
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: commandReply
      });
      return;
    }

    // 3. TTS Trigger (e.g. if !tts or normal chat if configured)
    if (message.message.startsWith('!tts ')) {
      const speechText = message.message.replace('!tts ', '').trim();
      ttsEngine.enqueue(speechText, message.user.displayName);
    }

    // 4. Cross-Chat Relay (Instant in-memory lookup)
    const isCrossChatEnabled = settingsCache.getBoolean('cross_chat_enabled', true);

    if (isCrossChatEnabled) {
      const format = settingsCache.get('cross_chat_format', '[$platform] $user: $message');

      const relayText = format
        .replace('$platform', message.platform.toUpperCase())
        .replace('$user', message.user.displayName || message.user.username)
        .replace('$message', message.message);

      // Emit relay message to all platforms except the origin
      eventBus.emit('cross_chat_relay', {
        originPlatform: message.platform,
        originChannel: message.channel,
        text: relayText
      });
    }
  }
}

export const messagePipeline = new MessagePipeline();
export default messagePipeline;
