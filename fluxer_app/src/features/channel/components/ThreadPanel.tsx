// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPanel.module.css';
import {ChannelChatLayout} from '@app/features/channel/components/ChannelChatLayout';
import {Messages} from '@app/features/channel/components/ChannelMessages';
import {ChannelTextarea} from '@app/features/channel/components/ChannelTextarea';
import Channels from '@app/features/channel/state/Channels';
import Threads from '@app/features/channel/state/Threads';
import {ThreadIcon} from '@app/features/ui/components/icons/ThreadIcon';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

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

	const name = thread?.name ?? channel?.name ?? '';
	const creatorUsername = thread?.threadCreatorUsername ?? null;

	return (
		<div className={styles.panel} data-flx="channel.thread-panel.panel">
			<div className={styles.header} data-flx="channel.thread-panel.header">
				<ThreadIcon size={20} className={styles.headerIcon} data-flx="channel.thread-panel.header-icon" />
				<div>
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
