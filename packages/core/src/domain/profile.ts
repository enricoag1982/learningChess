/** Fields on every stored record (sync-ready). Timestamps are ISO 8601 strings. */
export interface StoredRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Profile extends StoredRecord {
  readonly accountId: string;
  readonly nickname: string;
  /** Animal avatar id, e.g. `fox`. */
  readonly avatar: string;
  /** BCP 47 language tag, e.g. `en`. */
  readonly locale: string;
}
