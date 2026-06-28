// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPreviewCard.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import Threads from '@app/features/channel/state/Threads';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {ThreadIcon} from '@app/features/ui/components/icons/ThreadIcon';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const JOIN_THREAD_DESCRIPTOR = msg({
	message: 'Join Thread',
	comment: 'Call-to-action on the thread preview card when the user has not joined the thread.',
});
const OPEN_THREAD_DESCRIPTOR = msg({
	message: 'Open',
	comment: 'Call-to-action on the thread preview card when the user has already joined the thread.',
});
const CLOSED_DESCRIPTOR = msg({
	message: 'Closed',
	comment: 'Badge label for a closed thread in the thread preview card.',
});

interface ThreadPreviewCardProps {
	threadId: string;
	threadName: string;
	guildId?: string;
	parentChannelId: string;
}

export const ThreadPreviewCard = observer(({threadId, threadName, guildId, parentChannelId}: ThreadPreviewCardProps) => {
	const {i18n} = useLingui();
	const thread = Threads.getThread(threadId);
	const isJoined = Threads.isJoined(threadId);

	const name = thread?.name ?? threadName;
	const preview = thread?.preview;
	const isClosed = thread ? !thread.isOpen() : false;

	const handleClick = useCallback(async () => {
		if (!isJoined) {
			await ThreadCommands.join(parentChannelId, threadId);
		}
		if (guildId) {
			NavigationCommands.selectChannel(guildId, threadId);
		}
	}, [threadId, parentChannelId, guildId, isJoined]);

	const avatarUrl =
		preview?.lastMessageAuthorId && preview.lastMessageAuthorAvatar
			? AvatarUtils.getUserAvatarURL({
					id: preview.lastMessageAuthorId,
					avatar: preview.lastMessageAuthorAvatar,
				})
			: null;

	return (
		<div
			role="button"
			tabIndex={0}
			className={styles.card}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					void handleClick();
				}
			}}
			data-flx="channel.thread-preview-card.card.click"
		>
			<div className={styles.header} data-flx="channel.thread-preview-card.header">
				<ThreadIcon size={16} className={styles.icon} data-flx="channel.thread-preview-card.icon" />
				<span className={styles.name} data-flx="channel.thread-preview-card.name">
					{name}
				</span>
				{isClosed && (
					<span className={styles.closedBadge} data-flx="channel.thread-preview-card.closed-badge">
						{i18n._(CLOSED_DESCRIPTOR)}
					</span>
				)}
				<span className={styles.joinHint} data-flx="channel.thread-preview-card.join-hint">
					{isJoined ? i18n._(OPEN_THREAD_DESCRIPTOR) : i18n._(JOIN_THREAD_DESCRIPTOR)}
				</span>
			</div>
			{preview?.lastMessagePreview && (
				<div className={styles.meta} data-flx="channel.thread-preview-card.meta">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt=""
							className={styles.avatar}
							data-flx="channel.thread-preview-card.avatar"
						/>
					) : (
						<div className={styles.avatarPlaceholder} data-flx="channel.thread-preview-card.avatar-placeholder" />
					)}
					<span className={styles.preview} data-flx="channel.thread-preview-card.preview">
						{preview.lastMessagePreview}
					</span>
				</div>
			)}
		</div>
	);
});
