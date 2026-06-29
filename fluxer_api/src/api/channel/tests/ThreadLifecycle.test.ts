// SPDX-License-Identifier: AGPL-3.0-or-later

import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {createTestAccount} from '../../auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '../../test/ApiTestHarness';
import {HTTP_STATUS} from '../../test/TestConstants';
import {createBuilder} from '../../test/TestRequestBuilder';
import {
	acceptInvite,
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createPermissionOverwrite,
	createRole,
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

	it('member without MANAGE_THREADS cannot delete a thread', async () => {
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

	it('member with MANAGE_THREADS can delete a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Manage Threads Grant Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const modRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			permissions: Permissions.MANAGE_THREADS.toString(),
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, modRole.id);

		const thread = await createThread(harness, owner.token, channel.id, 'Deletable by Mod');

		await createBuilder(harness, member.token)
			.delete(`/channels/${channel.id}/threads/${thread.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	it('member with MANAGE_THREADS can rename a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Rename Thread Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const modRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			permissions: Permissions.MANAGE_THREADS.toString(),
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, modRole.id);

		const thread = await createThread(harness, owner.token, channel.id, 'Old Name');

		const updated = await createBuilder<Record<string, unknown>>(harness, member.token)
			.patch(`/channels/${channel.id}/threads/${thread.id}`)
			.body({name: 'Renamed by Mod'})
			.execute();

		expect(updated.name).toBe('Renamed by Mod');
	});

	it('member without MANAGE_THREADS cannot rename a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'No Rename Thread Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Locked Name');

		await createBuilder(harness, member.token)
			.patch(`/channels/${channel.id}/threads/${thread.id}`)
			.body({name: 'Attempted Rename'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('member without SEND_MESSAGES_IN_THREADS cannot post in a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Msg Perm Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Restricted Thread');
		await joinThread(harness, member.token, channel.id, thread.id as string);

		await createPermissionOverwrite(harness, owner.token, thread.id as string, member.userId, {
			type: 1,
			allow: '0',
			deny: Permissions.SEND_MESSAGES_IN_THREADS.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${thread.id}/messages`)
			.body({content: 'should be blocked'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('member with SEND_MESSAGES_IN_THREADS can post in a thread', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Msg Allow Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Open Thread');
		await joinThread(harness, member.token, channel.id, thread.id as string);

		const message = await createBuilder<Record<string, unknown>>(harness, member.token)
			.post(`/channels/${thread.id}/messages`)
			.body({content: 'hello thread'})
			.execute();

		expect(message.content).toBe('hello thread');
		expect(message.channel_id).toBe(thread.id);
	});

	it('GET /channels/:thread_id/thread-members returns creator after creation', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Members Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const thread = await createThread(harness, owner.token, channel.id, 'Members Test Thread');

		const members = await createBuilder<Array<Record<string, unknown>>>(harness, owner.token)
			.get(`/channels/${thread.id}/thread-members`)
			.execute();

		expect(members).toHaveLength(1);
		expect(members[0].user_id).toBe(owner.userId);
		expect(members[0].thread_id).toBe(thread.id);
	});

	it('GET /channels/:thread_id/thread-members reflects joins and leaves', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Thread Members Join Guild');
		const channel = await createChannel(harness, owner.token, guild.id, 'general');
		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		const thread = await createThread(harness, owner.token, channel.id, 'Join Leave Thread');

		await joinThread(harness, member.token, channel.id, thread.id as string);

		const afterJoin = await createBuilder<Array<Record<string, unknown>>>(harness, owner.token)
			.get(`/channels/${thread.id}/thread-members`)
			.execute();
		expect(afterJoin).toHaveLength(2);

		await leaveThread(harness, member.token, channel.id, thread.id as string);

		const afterLeave = await createBuilder<Array<Record<string, unknown>>>(harness, owner.token)
			.get(`/channels/${thread.id}/thread-members`)
			.execute();
		expect(afterLeave).toHaveLength(1);
		expect(afterLeave[0].user_id).toBe(owner.userId);
	});
});
