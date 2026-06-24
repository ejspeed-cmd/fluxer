// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createTestAccount} from '../../auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '../../test/ApiTestHarness';
import {HTTP_STATUS} from '../../test/TestConstants';
import {createBuilder} from '../../test/TestRequestBuilder';
import {
	acceptInvite,
	createChannel,
	createChannelInvite,
	createGuild,
	createThread,
	deleteThread,
	getThread,
	joinThread,
	leaveThread,
	listThreads,
} from './ChannelTestUtils';

describe('Thread Lifecycle', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});

	it('guild owner can create a thread in a text channel', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Test Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');

		const thread = await createThread(harness, owner.token, channel.id, 'My First Thread');

		expect(thread.type).toBe(11);
		expect(thread.name).toBe('My First Thread');
		expect(thread.thread_parent_channel_id).toBe(channel.id);
		expect(thread.thread_state).toBe(0);
	});

	it('created thread appears in list', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread List Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');

		await createThread(harness, owner.token, channel.id, 'Thread Alpha');
		await createThread(harness, owner.token, channel.id, 'Thread Beta');

		const threads = await listThreads(harness, owner.token, channel.id);

		expect(threads).toHaveLength(2);
		const names = threads.map((t) => t.name as string);
		expect(names).toContain('Thread Alpha');
		expect(names).toContain('Thread Beta');
	});

	it('can fetch a specific thread', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Get Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const thread = await createThread(harness, owner.token, channel.id, 'Fetchable Thread');

		const fetched = await getThread(harness, owner.token, channel.id, thread.id as string);

		expect(fetched.id).toBe(thread.id);
		expect(fetched.name).toBe('Fetchable Thread');
	});

	it('member can join and leave a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Join Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Joinable Thread');

		await joinThread(harness, member.token, channel.id, thread.id as string);
		await leaveThread(harness, member.token, channel.id, thread.id as string);
	});

	it('owner can delete a thread', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Delete Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const thread = await createThread(harness, owner.token, channel.id, 'Deletable Thread');

		await deleteThread(harness, owner.token, channel.id, thread.id as string);

		await createBuilder(harness, owner.token)
			.get(`/channels/${channel.id}/threads/${thread.id}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('member without CREATE_THREADS cannot create a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Perm Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, member.token)
			.post(`/channels/${channel.id}/threads`)
			.body({name: 'Unauthorized Thread'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('member without MANAGE_CHANNELS cannot delete a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Delete Perm Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Protected Thread');

		await createBuilder(harness, member.token)
			.delete(`/channels/${channel.id}/threads/${thread.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('returns 404 for thread belonging to different channel', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Isolation Guild');
		const channelA = await createChannel(harness, owner.token, guild.id, 'channel-a');
		const channelB = await createChannel(harness, owner.token, guild.id, 'channel-b');
		const thread = await createThread(harness, owner.token, channelA.id, 'Thread in A');

		await createBuilder(harness, owner.token)
			.get(`/channels/${channelB.id}/threads/${thread.id}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('thread name is required', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Validation Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');

		await createBuilder(harness, owner.token)
			.post(`/channels/${channel.id}/threads`)
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('update thread name', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Update Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const thread = await createThread(harness, owner.token, channel.id, 'Old Name');

		const updated = await createBuilder<Record<string, unknown>>(harness, owner.token)
			.patch(`/channels/${channel.id}/threads/${thread.id}`)
			.body({name: 'New Name'})
			.execute();

		expect(updated.name).toBe('New Name');
	});

	it('cannot create thread in a category channel', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Category Guild');
		const category = await createChannel(harness, owner.token, guild.id, 'my-category', 4);

		await createBuilder(harness, owner.token)
			.post(`/channels/${category.id}/threads`)
			.body({name: 'Thread in Category'})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
