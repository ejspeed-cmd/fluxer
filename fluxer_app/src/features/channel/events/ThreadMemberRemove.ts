// SPDX-License-Identifier: AGPL-3.0-or-later

import Threads from '@app/features/channel/state/Threads';
import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';

interface ThreadMemberRemovePayload {
	thread_id: string;
	user_id: string;
}

export function handleThreadMemberRemove(data: ThreadMemberRemovePayload, _context: GatewayHandlerContext): void {
	Threads.handleThreadMemberRemove({threadId: data.thread_id});
}
