/* eslint-disable @typescript-eslint/no-namespace */
import { JsonValue } from '@prisma/client/runtime/library';
import { AuthenticationState, Contact, proto, WAConnectionState } from 'baileys';

/**
 * LID (Linked Identity Device) extensions for Baileys types.
 * The EvolutionAPI Baileys fork adds `remoteJidAlt` to message keys and
 * `lidJidAlt` to contacts when the original JID uses the @lid suffix.
 * These interfaces provide type-safe access to those fields.
 */
export interface LidMessageKey extends proto.IMessageKey {
  remoteJidAlt?: string;
}

export interface LidContact extends Contact {
  lidJidAlt?: string;
}

/**
 * Extended message key interface for LID addressing support in integrations.
 * Adds `addressingMode` and `participantAlt` on top of `LidMessageKey`
 * to enable proper LID → standard JID resolution in services like Chatwoot.
 */
export interface ExtendedIMessageKey extends LidMessageKey {
  addressingMode?: 'lid' | string;
  participantAlt?: string;
}

export enum Events {
  APPLICATION_STARTUP = 'application.startup',
  INSTANCE_CREATE = 'instance.create',
  INSTANCE_DELETE = 'instance.delete',
  QRCODE_UPDATED = 'qrcode.updated',
  CONNECTION_UPDATE = 'connection.update',
  STATUS_INSTANCE = 'status.instance',
  MESSAGES_SET = 'messages.set',
  MESSAGES_UPSERT = 'messages.upsert',
  MESSAGES_EDITED = 'messages.edited',
  MESSAGES_UPDATE = 'messages.update',
  MESSAGES_DELETE = 'messages.delete',
  SEND_MESSAGE = 'send.message',
  CONTACTS_SET = 'contacts.set',
  CONTACTS_UPSERT = 'contacts.upsert',
  CONTACTS_UPDATE = 'contacts.update',
  PRESENCE_UPDATE = 'presence.update',
  CHATS_SET = 'chats.set',
  CHATS_UPDATE = 'chats.update',
  CHATS_UPSERT = 'chats.upsert',
  CHATS_DELETE = 'chats.delete',
  GROUPS_UPSERT = 'groups.upsert',
  GROUPS_UPDATE = 'groups.update',
  GROUP_PARTICIPANTS_UPDATE = 'group-participants.update',
  CALL = 'call',
  TYPEBOT_START = 'typebot.start',
  TYPEBOT_CHANGE_STATUS = 'typebot.change-status',
  LABELS_EDIT = 'labels.edit',
  LABELS_ASSOCIATION = 'labels.association',
  CREDS_UPDATE = 'creds.update',
  MESSAGING_HISTORY_SET = 'messaging-history.set',
  REMOVE_INSTANCE = 'remove.instance',
  LOGOUT_INSTANCE = 'logout.instance',
}

export declare namespace wa {
  export type QrCode = {
    count?: number;
    pairingCode?: string;
    base64?: string;
    code?: string;
  };

  export type Instance = {
    id?: string;
    qrcode?: QrCode;
    pairingCode?: string;
    authState?: { state: AuthenticationState; saveCreds: () => void };
    name?: string;
    wuid?: string;
    profileName?: string;
    profilePictureUrl?: string;
    ownerJid?: string;
    token?: string;
    number?: string;
    integration?: string;
    businessId?: string;
  };

  export type LocalChatwoot = {
    enabled?: boolean;
    accountId?: string;
    token?: string;
    url?: string;
    nameInbox?: string;
    signMsg?: boolean;
    signDelimiter?: string;
    number?: string;
    reopenConversation?: boolean;
    conversationPending?: boolean;
    mergeBrazilContacts?: boolean;
    importContacts?: boolean;
    importMessages?: boolean;
    daysLimitImportMessages?: number;
  };

  export type LocalSettings = {
    rejectCall?: boolean;
    msgCall?: string;
    groupsIgnore?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
    wavoipToken?: string;
  };

  export type LocalEvent = {
    enabled?: boolean;
    events?: JsonValue;
  };

  export type LocalWebHook = LocalEvent & {
    url?: string;
    headers?: JsonValue;
    webhookByEvents?: boolean;
    webhookBase64?: boolean;
  };

  export type LocalPusher = LocalEvent & {
    appId?: string;
    key?: string;
    secret?: string;
    cluster?: string;
    useTLS?: boolean;
  };

  type Session = {
    remoteJid?: string;
    sessionId?: string;
    createdAt?: number;
  };

  export type LocalProxy = {
    enabled?: boolean;
    host?: string;
    port?: string;
    protocol?: string;
    username?: string;
    password?: string;
  };

  export type StateConnection = {
    instance?: string;
    state?: WAConnectionState | 'refused';
    statusReason?: number;
  };

  export type StatusMessage = 'ERROR' | 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'DELETED' | 'PLAYED';
}

/** Resolve a @lid JID to its @s.whatsapp.net alternative when available. */
export function resolveLidJid(key: LidMessageKey): string {
  return key.remoteJid?.includes('@lid') && key.remoteJidAlt ? key.remoteJidAlt : key.remoteJid;
}

/** Resolve a @lid contact ID to its @s.whatsapp.net alternative when available. */
export function resolveLidContact(contact: LidContact): string {
  return contact.id?.includes('@lid') && contact.lidJidAlt ? contact.lidJidAlt : contact.id;
}

export const TypeMediaMessage = [
  'imageMessage',
  'documentMessage',
  'audioMessage',
  'videoMessage',
  'stickerMessage',
  'ptvMessage',
];

export const MessageSubtype = [
  'ephemeralMessage',
  'documentWithCaptionMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
];

export const Integration = {
  WHATSAPP_BUSINESS: 'WHATSAPP-BUSINESS',
  WHATSAPP_BAILEYS: 'WHATSAPP-BAILEYS',
  EVOLUTION: 'EVOLUTION',
};
