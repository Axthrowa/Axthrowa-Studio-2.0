/** Emote sözlüğü — isim → CDN URL */

export type EmoteEntry = {
  name: string;
  url: string;
};

export type EmoteLookup = (token: string) => EmoteEntry | undefined;

export type EmoteDictionary = Map<string, EmoteEntry>;
