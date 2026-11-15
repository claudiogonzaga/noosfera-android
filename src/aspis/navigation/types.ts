import type { FeedSource } from '../types';

export type RootStackParamList = {
  /** `source`: a aba (YouTube ou X) ao voltar da aba Bluesky. */
  Feed: { source?: FeedSource } | undefined;
  Bluesky: undefined;
  Share: { sharedText: string };
  Settings: undefined;
  PillarEdit: { pillarId?: string };
  Notes: undefined;
  NoteReader: { fileId: string; name: string };
  Player: { videoId: string; kind: 'audio' | 'video' };
  Media: undefined;
  XLogin: { logout?: boolean } | undefined;
};
