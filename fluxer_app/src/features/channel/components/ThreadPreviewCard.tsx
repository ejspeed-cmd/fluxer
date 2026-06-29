// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPreviewCard.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import Threads from '@app/features/channel/state/Threads';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import {getRelativeDateString} from '@app/features/user/utils/DateFormatting';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const MESSAGES_DESCRIPTOR = msg({
	message: '{count, plural, one {# Message} other {# Messages}}',
	comment: 'Message count badge on a thread preview card.',
});
const SEE_THREAD_DESCRIPTOR = msg({
	message: 'See thread ›',
	comment: 'Link text on thread preview card when no messages exist yet.',
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
	const messageCount = thread?.messageCount ?? 0;

	const handleClick = useCallback(async () => {
		if (!isJoined) {
			await ThreadCommands.join(parentChannelId, threadId);
		}
		if (guildId) {
			NavigationCommands.selectThread(guildId, parentChannelId, threadId);
		}
	}, [threadId, parentChannelId, guildId, isJoined]);

	const avatarUrl =
		preview?.lastMessageAuthorId && preview.lastMessageAuthorAvatar
			? AvatarUtils.getUserAvatarURL({
					id: preview.lastMessageAuthorId,
					avatar: preview.lastMessageAuthorAvatar,
				})
			: null;

	const timeAgo = preview?.lastMessageAt ? getRelativeDateString(preview.lastMessageAt, i18n) : null;

	return (
		<div className={styles.wrapper} data-flx="channel.thread-preview-card.wrapper">
			<div className={styles.connector} data-flx="channel.thread-preview-card.connector" />
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
				<div className={styles.topRow} data-flx="channel.thread-preview-card.top-row">
					<span className={styles.threadName} data-flx="channel.thread-preview-card.thread-name">
						{name}
					</span>
					<span className={styles.messageBadge} data-flx="channel.thread-preview-card.message-badge">
						{messageCount > 0
							? `${i18n._(MESSAGES_DESCRIPTOR, {count: messageCount})} ›`
							: i18n._(SEE_THREAD_DESCRIPTOR)}
					</span>
				</div>
				{preview?.lastMessagePreview && (
					<div className={styles.previewRow} data-flx="channel.thread-preview-card.preview-row">
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
						<span className={styles.previewText} data-flx="channel.thread-preview-card.preview-text">
							{preview.lastMessageAuthorUsername && (
								<span className={styles.previewAuthor}>{preview.lastMessageAuthorUsername} </span>
							)}
							{preview.lastMessagePreview}
						</span>
						{timeAgo && (
							<span className={styles.timestamp} data-flx="channel.thread-preview-card.timestamp">
								{timeAgo}
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
