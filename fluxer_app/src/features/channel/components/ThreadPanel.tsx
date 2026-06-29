// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPanel.module.css';
import {ChannelChatLayout} from '@app/features/channel/components/ChannelChatLayout';
import {Messages} from '@app/features/channel/components/ChannelMessages';
import {ChannelTextarea} from '@app/features/channel/components/ChannelTextarea';
import Channels from '@app/features/channel/state/Channels';
import Threads from '@app/features/channel/state/Threads';
import * as MessageCommands from '@app/features/messaging/commands/MessageCommands';
import {http} from '@app/features/platform/transport/RestTransport';
import {ThreadIcon} from '@app/features/ui/components/icons/ThreadIcon';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {MAX_MESSAGES_PER_CHANNEL} from '@fluxer/constants/src/LimitConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

const CLOSE_DESCRIPTOR = msg({
	message: 'Close thread panel',
	comment: 'Accessible label on the close button in the thread side panel.',
});
const STARTED_BY_DESCRIPTOR = msg({
	message: 'Started by {username}',
	comment: 'Subtitle shown under the thread title in the thread side panel.',
});

interface ThreadPanelProps {
	threadId: string;
	onClose: () => void;
}

export const ThreadPanel = observer(({threadId, onClose}: ThreadPanelProps) => {
	const {i18n} = useLingui();
	const thread = Threads.getThread(threadId);
	const channel = Channels.getChannel(threadId);
	const [sourceMessage, setSourceMessage] = useState<Message | null>(null);

	const name = thread?.name ?? channel?.name ?? '';
	const creatorUsername = thread?.threadCreatorUsername ?? null;
	const parentChannelId = thread?.threadParentChannelId ?? null;
	const sourceMessageId = thread?.threadSourceMessageId ?? null;

	useEffect(() => {
		void MessageCommands.fetchMessages(threadId, null, null, MAX_MESSAGES_PER_CHANNEL);
	}, [threadId]);

	useEffect(() => {
		if (!parentChannelId || !sourceMessageId) {
			setSourceMessage(null);
			return;
		}
		http
			.get<Message>(`/channels/${parentChannelId}/messages/${sourceMessageId}`)
			.then((res) => setSourceMessage(res.body))
			.catch(() => setSourceMessage(null));
	}, [parentChannelId, sourceMessageId]);

	return (
		<div className={styles.panel} data-flx="channel.thread-panel.panel">
			<div className={styles.header} data-flx="channel.thread-panel.header">
				<ThreadIcon size={20} className={styles.headerIcon} data-flx="channel.thread-panel.header-icon" />
				<div className={styles.headerText}>
					<div className={styles.headerTitle} data-flx="channel.thread-panel.header-title">
						{name}
					</div>
					{creatorUsername && (
						<div className={styles.headerStartedBy} data-flx="channel.thread-panel.header-started-by">
							{i18n._(STARTED_BY_DESCRIPTOR, {username: ''})}
							<span className={styles.headerStartedByAuthor}>{creatorUsername}</span>
						</div>
					)}
				</div>
				<FocusRing data-flx="channel.thread-panel.focus-ring">
					<button
						type="button"
						className={styles.closeButton}
						aria-label={i18n._(CLOSE_DESCRIPTOR)}
						onClick={onClose}
						data-flx="channel.thread-panel.close-button.click"
					>
						<XIcon size={20} />
					</button>
				</FocusRing>
			</div>
			{sourceMessage && (
				<div className={styles.sourceMessage} data-flx="channel.thread-panel.source-message">
					<span className={styles.sourceMessageAuthor}>{sourceMessage.author.username}</span>
					<span className={styles.sourceMessageContent}>{sourceMessage.content}</span>
				</div>
			)}
			{channel && (
				<div className={styles.content} data-flx="channel.thread-panel.content">
					<ChannelChatLayout
						channel={channel}
						messages={
							<Messages
								key={threadId}
								channel={channel}
								data-flx="channel.thread-panel.messages"
							/>
						}
						textarea={
							<ChannelTextarea
								channel={channel}
								data-flx="channel.thread-panel.channel-textarea"
							/>
						}
						data-flx="channel.thread-panel.channel-chat-layout"
					/>
				</div>
			)}
		</div>
	);
});
