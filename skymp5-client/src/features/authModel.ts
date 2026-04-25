export interface RemoteAuthGameData {
  session: string;
  playSession?: string | null;
  masterApiId?: number | null;
  discordUsername?: string | null;
  discordDiscriminator?: string | null;
  discordAvatar?: string | null;
  accountId?: number | null;
  accountUsername?: string | null;
  selectedCharacterId?: number | null;
  selectedCharacterName?: string | null;
};

export interface LocalAuthGameData {
  profileId: number;
};

export interface AuthGameData {
  remote?: RemoteAuthGameData;
  local?: LocalAuthGameData;
};

export const authGameDataStorageKey = "authGameData";
