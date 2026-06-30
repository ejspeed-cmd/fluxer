// SPDX-License-Identifier: AGPL-3.0-or-later

import {ChannelTypes, Permissions, ThreadStates} from '@fluxer/constants/src/ChannelConstants';
import type {ThreadState} from '@fluxer/constants/src/ChannelConstants';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {InvalidChannelTypeError} from '@fluxer/errors/src/domains/channel/InvalidChannelTypeError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import type {CreateThreadRequest, UpdateThreadRequest} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';
import type {ThreadResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {ChannelID, GuildID, UserID} from '../../BrandedTypes';
import {createChannelID, createMessageID} from '../../BrandedTypes';
import type {IGatewayService} from '../../infrastructure/IGatewayService';
import type {ISnowflakeService} from '../../infrastructure/ISnowflakeService';
import type {RequestCache} from '../../middleware/RequestCacheMiddleware';
import type {Channel} from '../../models/Channel';
import type {IUserRepository} from '../../user/IUserRepository';
import type {IChannelRepositoryAggregate} from '../repositories/IChannelRepositoryAggregate';
import type {ChannelAuthService} from './channel_data/ChannelAuthService';

const DEFAULT_THREAD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const THREAD_ELIGIBLE_CHANNEL_TYPES = new Set<number>([ChannelTypes.GUILD_TEXT, ChannelTypes.GUILD_VOICE]);

export class ThreadService {
	constructor(
		private readonly channelRepository: IChannelRepositoryAggregate,
		private readonly userRepository: IUserRepository,
		private readonly gatewayService: IGatewayService,
		private readonly snowflakeService: ISnowflakeService,
		private readonly channelAuth: ChannelAuthService,
	) {}

	async createThread(params: {
		userId: UserID;
		channelId: ChannelID;
		data: CreateThreadRequest;
		requestCache: RequestCache;
	}): Promise<Channel> {
		const {userId, channelId, data} = params;
		const {channel, guild, checkPermission} = await this.channelAuth.getChannelAuthenticated({userId, channelId});

		if (!guild) throw new MissingPermissionsError();
		if (!THREAD_ELIGIBLE_CHANNEL_TYPES.has(channel.type)) throw new InvalidChannelTypeError();

		await checkPermission(Permissions.CREATE_THREADS);

		if (data.source_message_id) {
			const existingThread = await this.findThreadForSourceMessage(channelId, data.source_message_id.toString());
			if (existingThread) throw new InvalidChannelTypeError();
		}

		const threadId = createChannelID(await this.snowflakeService.generate());
		const expiresAt = new Date(Date.now() + (data.expires_in_ms ?? DEFAULT_THREAD_EXPIRY_MS));

		const user = await this.userRepository.findUnique(userId);
		const username = user?.username ?? null;

		const threadRow = {
			...channel.toRow(),
			channel_id: threadId,
			type: ChannelTypes.GUILD_THREAD as number,
			name: data.name,
			last_message_id: null,
			last_pin_timestamp: null,
			position: 0,
			parent_id: channelId,
			thread_parent_channel_id: channelId,
			owner_id: userId,
			thread_creator_username: username,
			thread_state: ThreadStates.OPEN as ThreadState,
			thread_expires_at: expiresAt,
			thread_source_message_id: data.source_message_id ? createMessageID(BigInt(data.source_message_id.toString())) : null,
			soft_deleted: false,
			version: 1,
		};

		const thread = await this.channelRepository.channelData.upsert(threadRow);

		await this.channelRepository.channelData.upsertThreadByChannel(channelId, threadId);
		await this.addThreadMember(threadId, userId);

		if (data.source_message_id) {
			const sourceMessageId = createMessageID(BigInt(data.source_message_id.toString()));
			const sourceMessage = await this.channelRepository.messages.getMessage(channelId, sourceMessageId);
			if (sourceMessage) {
				await this.channelRepository.messages.upsertMessage(
					{
						...sourceMessage.toRow(),
						thread_id: threadId,
						thread_name: data.name,
					},
					sourceMessage.toRow(),
				);
			}
		}

		if (thread.guildId) {
			await this.gatewayService.dispatchGuild({
				guildId: thread.guildId as GuildID,
				event: 'THREAD_CREATE',
				data: mapThreadToResponse(thread),
			});
		}

		return thread;
	}

	async getThread(params: {userId: UserID; channelId: ChannelID; threadId: ChannelID}): Promise<Channel> {
		const {userId, channelId, threadId} = params;
		await this.channelAuth.getChannelAuthenticated({userId, channelId});

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();
		if (thread.threadParentChannelId !== channelId) throw new UnknownChannelError();

		return thread;
	}

	async listThreads(params: {
		userId: UserID;
		channelId: ChannelID;
		stateFilter: 'open' | 'closed' | 'archived' | 'all';
		limit: number;
		before?: ChannelID;
	}): Promise<Array<Channel>> {
		const {userId, channelId, stateFilter, limit, before} = params;
		await this.channelAuth.getChannelAuthenticated({userId, channelId});

		const threadIds = await this.channelRepository.channelData.listThreadsByChannel(channelId, limit, before);
		if (threadIds.length === 0) return [];

		const threads = await this.channelRepository.channelData.listChannels(threadIds);

		const stateMap: Record<string, number> = {
			open: ThreadStates.OPEN,
			closed: ThreadStates.CLOSED,
			archived: ThreadStates.ARCHIVED,
		};

		return threads.filter((thread) => {
			if (thread.type !== ChannelTypes.GUILD_THREAD) return false;
			if (stateFilter === 'all') return true;
			return thread.threadState === stateMap[stateFilter];
		});
	}	async updateThread(params: {
		userId: UserID;
		channelId: ChannelID;
		threadId: ChannelID;
		data: UpdateThreadRequest;
		requestCache: RequestCache;
	}): Promise<Channel> {
		const {userId, channelId, threadId, data} = params;
		const {guild, checkPermission} = await this.channelAuth.getChannelAuthenticated({userId, channelId});
		if (!guild) throw new MissingPermissionsError();

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();
		if (thread.threadParentChannelId !== channelId) throw new UnknownChannelError();

		if (data.state !== undefined || data.name !== undefined) {
			await checkPermission(Permissions.MANAGE_THREADS);
		}

		const updated = await this.channelRepository.channelData.upsert({
			...thread.toRow(),
			name: data.name ?? thread.name,
			thread_state: data.state !== undefined ? (data.state as ThreadState) : thread.threadState,
			thread_expires_at:
				data.expires_in_ms !== undefined ? new Date(Date.now() + data.expires_in_ms) : thread.threadExpiresAt,
		});

		if (updated.guildId) {
			await this.gatewayService.dispatchGuild({
				guildId: updated.guildId as GuildID,
				event: 'THREAD_UPDATE',
				data: mapThreadToResponse(updated),
			});
		}

		return updated;
	}

	async deleteThread(params: {
		userId: UserID;
		channelId: ChannelID;
		threadId: ChannelID;
		requestCache: RequestCache;
	}): Promise<void> {
		const {userId, channelId, threadId} = params;
		const {guild, checkPermission} = await this.channelAuth.getChannelAuthenticated({userId, channelId});
		if (!guild) throw new MissingPermissionsError();

		await checkPermission(Permissions.MANAGE_THREADS);

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();
		if (thread.threadParentChannelId !== channelId) throw new UnknownChannelError();

		await this.channelRepository.messages.deleteAllChannelMessages(threadId);
		await this.channelRepository.channelData.deleteThreadByChannel(channelId, threadId);
		await this.channelRepository.channelData.delete(threadId, thread.guildId ?? undefined);

		if (thread.guildId) {
			await this.gatewayService.dispatchGuild({
				guildId: thread.guildId as GuildID,
				event: 'THREAD_DELETE',
				data: {id: threadId.toString(), channel_id: channelId.toString(), guild_id: thread.guildId.toString()},
			});
		}
	}

	async joinThread(params: {userId: UserID; channelId: ChannelID; threadId: ChannelID}): Promise<void> {
		const {userId, channelId, threadId} = params;
		await this.channelAuth.getChannelAuthenticated({userId, channelId});

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();
		if (thread.threadParentChannelId !== channelId) throw new UnknownChannelError();
		if (thread.threadState === ThreadStates.ARCHIVED) throw new MissingPermissionsError();

		await this.addThreadMember(threadId, userId);

		if (thread.guildId) {
			await this.gatewayService.dispatchGuild({
				guildId: thread.guildId as GuildID,
				event: 'THREAD_MEMBER_ADD',
				data: {thread_id: threadId.toString(), user_id: userId.toString(), joined_at: new Date().toISOString()},
			});
		}
	}

	async leaveThread(params: {userId: UserID; channelId: ChannelID; threadId: ChannelID}): Promise<void> {
		const {userId, channelId, threadId} = params;

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();
		if (thread.threadParentChannelId !== channelId) throw new UnknownChannelError();
		if (thread.threadState === ThreadStates.ARCHIVED) throw new MissingPermissionsError();

		await this.channelRepository.channelData.removeThreadMember(threadId, userId);

		if (thread.guildId) {
			await this.gatewayService.dispatchGuild({
				guildId: thread.guildId as GuildID,
				event: 'THREAD_MEMBER_REMOVE',
				data: {thread_id: threadId.toString(), user_id: userId.toString()},
			});
		}
	}

	async enrichThreadsWithLastMessage(threads: Array<Channel>): Promise<Array<ThreadResponse>> {
		return Promise.all(
			threads.map(async (thread) => {
				try {
					const messages = await this.channelRepository.messages.listMessages(thread.id, undefined, 50);
					const last = messages[0] ?? null;
					const count = messages.length;
					if (!last || !last.authorId) {
						return {...mapThreadToResponse(thread), thread_member_count: count};
					}
					const author = await this.userRepository.findUnique(last.authorId);
					const snowflakeMs = Number(BigInt(last.id.toString()) >> 22n) + 1420070400000;
					return {
						...mapThreadToResponse(thread, {
							content: last.content,
							authorId: last.authorId.toString(),
							authorUsername: author?.username ?? '',
							authorAvatar: author?.avatarHash ?? null,
							timestamp: new Date(snowflakeMs),
						}),
						thread_member_count: count,
					};
				} catch {
					return mapThreadToResponse(thread);
				}
			}),
		);
	}

	async listThreadMembers(params: {userId: UserID; threadId: ChannelID}): Promise<Array<{userId: UserID; joinedAt: Date}>> {
		const {userId, threadId} = params;
		await this.channelAuth.getChannelAuthenticated({userId, channelId: threadId});

		const thread = await this.channelRepository.channelData.findUnique(threadId);
		if (!thread || thread.type !== ChannelTypes.GUILD_THREAD) throw new UnknownChannelError();

		return this.channelRepository.channelData.listThreadMembers(threadId);
	}

	private async addThreadMember(threadId: ChannelID, userId: UserID): Promise<void> {
		await this.channelRepository.channelData.upsertThreadMember({
			threadId,
			userId,
			joinedAt: new Date(),
			notificationOverride: null,
		});
	}

	private async findThreadForSourceMessage(channelId: ChannelID, sourceMessageId: string): Promise<Channel | null> {
		const threadIds = await this.channelRepository.channelData.listThreadsByChannel(channelId, 1000);
		if (threadIds.length === 0) return null;
		const threads = await this.channelRepository.channelData.listChannels(threadIds);
		return threads.find((t) => t.threadSourceMessageId?.toString() === sourceMessageId) ?? null;
	}
}

export function mapThreadToResponse(thread: Channel, lastMessage?: {
	content: string | null;
	authorId: string;
	authorUsername: string;
	authorAvatar: string | null;
	timestamp: Date;
} | null): ThreadResponse {
	return {
		id: thread.id.toString(),
		type: thread.type,
		guild_id: thread.guildId?.toString(),
		name: thread.name ?? undefined,
		parent_id: thread.threadParentChannelId?.toString() ?? null,
		last_message_id: thread.lastMessageId?.toString() ?? null,
		last_pin_timestamp: thread.lastPinTimestamp?.toISOString() ?? null,
		permission_overwrites: Array.from(thread.permissionOverwrites).map(([id, ow]) => ({
			id: id.toString(),
			type: ow.type as 0 | 1,
			allow: (ow.allow ?? 0n).toString(),
			deny: (ow.deny ?? 0n).toString(),
		})),
		thread_state: thread.threadState ?? ThreadStates.OPEN,
		thread_parent_channel_id: thread.threadParentChannelId?.toString() ?? '',
		thread_creator_id: thread.ownerId?.toString() ?? null,
		thread_creator_username: thread.threadCreatorUsername ?? null,
		thread_expires_at: thread.threadExpiresAt?.toISOString() ?? null,
		thread_source_message_id: thread.threadSourceMessageId?.toString() ?? null,
		last_message_preview: lastMessage?.content ? lastMessage.content.slice(0, 100) : null,
		last_message_at: lastMessage?.timestamp.toISOString() ?? null,
		last_message_author_id: lastMessage?.authorId ?? null,
		last_message_author_username: lastMessage?.authorUsername ?? null,
		last_message_author_avatar: lastMessage?.authorAvatar ?? null,
	};
}
