// SPDX-License-Identifier: AGPL-3.0-or-later

import Threads from '@app/features/channel/state/Threads';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import type {ThreadResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

const logger = new Logger('Threads');

export interface CreateThreadParams {
	name: string;
	expires_in_ms?: number;
	source_message_id?: string;
}

export async function create(channelId: string, params: CreateThreadParams): Promise<ThreadResponse> {
	const response = await http.post<ThreadResponse>(
		`/channels/${channelId}/threads`,
		{body: params},
	);
	return response.body;
}

export async function update(
	channelId: string,
	threadId: string,
	params: {name?: string; state?: number; expires_in_ms?: number},
): Promise<ThreadResponse> {
	const response = await http.patch<ThreadResponse>(
		`/channels/${channelId}/threads/${threadId}`,
		{body: params},
	);
	return response.body;
}

export async function remove(channelId: string, threadId: string): Promise<void> {
	await http.delete(`/channels/${channelId}/threads/${threadId}`);
}

export async function fetchList(channelId: string): Promise<ThreadResponse[]> {
	try {
		const response = await http.get<ThreadResponse[]>(`/channels/${channelId}/threads`);
		const threads = response.body ?? [];
		for (const thread of threads) {
			Threads.handleThreadCreate(thread);
		}
		return threads;
	} catch (error) {
		logger.error(`Failed to fetch threads for channel ${channelId}:`, error);
		throw error;
	}
}

export async function join(channelId: string, threadId: string): Promise<void> {
	await http.post(`/channels/${channelId}/threads/${threadId}/members/@me`, {body: {}});
	Threads.handleThreadMemberAdd({threadId});
}

export async function leave(channelId: string, threadId: string): Promise<void> {
	await http.delete(`/channels/${channelId}/threads/${threadId}/members/@me`);
	Threads.handleThreadMemberRemove({threadId});
}
