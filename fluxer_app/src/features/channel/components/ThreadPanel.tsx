// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPanel.module.css';
import {ChannelChatLayout} from '@app/features/channel/components/ChannelChatLayout';
import {Messages} from '@app/features/channel/components/ChannelMessages';
import {ChannelTextarea} from '@app/features/channel/components/ChannelTextarea';
import Channels from '@app/features/channel/state/Channels';
import Threads from '@app/features/channel/state/Threads';
import * as MessageCommands from '@app/features/messaging/commands/MessageCommands';
import {ThreadIcon} from '@app/features/ui/components/icons/ThreadIcon';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {MAX_MESSAGES_PER_CHANNEL} from '@fluxer/constants/src/LimitConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

const CLOSE_DESCRIPTOR = msg({
	message: 'Close thread panel',
	comment: 'Accessible label on the close button in the thread side panel.',
});

interface ThreadPanelProps {
	threadId: string;
	onClose: () => void;
}

export const ThreadPanel = observer(({threadId, onClose}: ThreadPanelProps) => {
	const {i18n} = useLingui();
	const thread = Threads.getThread(threadId);
	const channel = Channels.getChannel(threadId);

	const threadName = thread?.name ?? channel?.name ?? '';

	useEffect(() => {
		void MessageCommands.fetchMessages(threadId, null, null, MAX_MESSAGES_PER_CHANNEL);
	}, [threadId]);

	return (
		<div className={styles.panel} data-flx="channel.thread-panel.panel">
			<div className={styles.header} data-flx="channel.thread-panel.header">
				<ThreadIcon size={16} className={styles.threadIcon} aria-hidden="true" data-flx="channel.thread-panel.thread-icon" />
				<span className={styles.threadName} data-flx="channel.thread-panel.thread-name">
					{threadName}
				</span>
				<FocusRing data-flx="channel.thread-panel.focus-ring">
					<button
						type="button"
						className={styles.closeButton}
						aria-label={i18n._(CLOSE_DESCRIPTOR)}
						onClick={onClose}
						data-flx="channel.thread-panel.close-button.click"
					>
						<XIcon size={18} />
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
