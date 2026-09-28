// Chess's own backup zod fields, behind a dynamic import so zod never loads until a backup is
// actually built or parsed (`SubjectCore.settings.loadBackupShape`).
import { z } from 'zod';
import type { SettingsBackupShape } from '@learn/platform-core/domain/subject';

export const chessSettingsBackupShape: SettingsBackupShape = {
  computerLevel: z.union([z.literal('auto'), z.number().int().min(1).max(5)]),
  pieceStyle: z.union([z.literal('animal'), z.literal('classic')]),
};
