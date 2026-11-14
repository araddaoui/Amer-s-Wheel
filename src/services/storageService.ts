import {
  AuditLogEntry,
  ConfigHistoryEntry,
  GameConfig,
  PlayerState,
  PlayerStats,
} from '../types/game';
import { DEFAULT_LIMITS, DEFAULT_SEGMENTS } from './probabilityEngine';
import { generateSecureHex } from './randomService';

const STORAGE_KEYS = {
  CONFIG: 'fw_pro_config_v1',
  PLAYER: 'fw_pro_player_v1',
  AUDIT: 'fw_pro_audit_v1',
  CONFIG_HISTORY: 'fw_pro_config_history_v1',
};

export function createInitialStats(): PlayerStats {
  return {
    totalSpins: 0,
    totalWagered: 0,
    totalPayout: 0,
    netProfit: 0,
    winsCount: 0,
    breakEvenCount: 0,
    lossesCount: 0,
    biggestWin: 0,
    biggestMultiplier: 0,
    currentStreak: 0,
  };
}

export function createDefaultConfig(): GameConfig {
  return {
    segments: DEFAULT_SEGMENTS.map((s) => ({ ...s })),
    limits: { ...DEFAULT_LIMITS },
    operatorPin: '1234',
    updatedAt: Date.now(),
  };
}

export function createDefaultPlayerState(defaultBalance = DEFAULT_LIMITS.defaultBalance): PlayerState {
  return {
    balance: defaultBalance,
    clientSeed: generateSecureHex(8),
    nonce: 1,
    stats: createInitialStats(),
    history: [],
  };
}

export function loadConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return createDefaultConfig();
    const parsed = JSON.parse(raw) as Partial<GameConfig>;
    if (!Array.isArray(parsed.segments) || parsed.segments.length < 2 || !parsed.limits) {
      return createDefaultConfig();
    }
    return {
      segments: parsed.segments,
      limits: {
        minBet: Number(parsed.limits.minBet) || DEFAULT_LIMITS.minBet,
        maxBet: Number(parsed.limits.maxBet) || DEFAULT_LIMITS.maxBet,
        defaultBalance: Number(parsed.limits.defaultBalance) || DEFAULT_LIMITS.defaultBalance,
      },
      operatorPin: typeof parsed.operatorPin === 'string' && parsed.operatorPin.length >= 4
        ? parsed.operatorPin
        : '1234',
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return createDefaultConfig();
  }
}

export function saveConfig(config: GameConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadPlayerState(defaultBalance = DEFAULT_LIMITS.defaultBalance): PlayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYER);
    if (!raw) return createDefaultPlayerState(defaultBalance);
    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    return {
      balance: typeof parsed.balance === 'number' ? parsed.balance : defaultBalance,
      clientSeed: typeof parsed.clientSeed === 'string' && parsed.clientSeed.length > 0
        ? parsed.clientSeed
        : generateSecureHex(8),
      nonce: typeof parsed.nonce === 'number' && parsed.nonce >= 1 ? parsed.nonce : 1,
      stats: parsed.stats ? { ...createInitialStats(), ...parsed.stats } : createInitialStats(),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return createDefaultPlayerState(defaultBalance);
  }
}

export function savePlayerState(player: PlayerState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify(player));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAuditLog(entries: AuditLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(entries.slice(0, 500)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadConfigHistory(): ConfigHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConfigHistory(entries: ConfigHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG_HISTORY, JSON.stringify(entries.slice(0, 100)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
