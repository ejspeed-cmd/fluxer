// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPreviewCard.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import Threads from '@app/features/channel/state/Threads';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import {getRelativeDateString} from '@app/features/user/utils/DateFormatting';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const MESSAGES_DESCRIPTOR = msg({
	message: '· {count, plural, one {# message} other {# messages}}',
	comment: 'Message count shown on thread preview card.',
});
const NO_MESSAGES_DESCRIPTOR = msg({
	message: 'There are no recent messages in this thread.',
	comment: 'Placeholder shown on thread preview card when there are no messages.',
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
	const isOpen = thread ? thread.isOpen() : true;
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
		<div className={styles.wrap} data-flx="channel.thread-preview-card.wrap">
			<svg
				className={styles.branchArm}
				viewBox="0 0 32 28"
				fill="none"
				aria-hidden="true"
				data-flx="channel.thread-preview-card.branch-arm"
			>
				<path d="M4 0 V14 Q4 20 10 20 H32" stroke="currentColor" strokeWidth="2" fill="none" />
			</svg>
			<div
				role="button"
				tabIndex={0}
				className={clsx(styles.box, isOpen && styles.boxActive)}
				onClick={handleClick}
				onKeyDown={(e: React.KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						void handleClick();
					}
				}}
				data-flx="channel.thread-preview-card.box.click"
			>
				<div className={styles.header} data-flx="channel.thread-preview-card.header">
					<div className={styles.titleRow} data-flx="channel.thread-preview-card.title-row">
						<span
							className={clsx(styles.threadName, !isOpen && styles.threadNameClosed)}
							data-flx="channel.thread-preview-card.thread-name"
						>
							{name}
						</span>
						{messageCount > 0 && (
							<span className={styles.messageCount} data-flx="channel.thread-preview-card.message-count">
								{i18n._(MESSAGES_DESCRIPTOR, {count: messageCount})}
							</span>
						)}
					</div>
					<span className={styles.chevron} aria-hidden="true">›</span>
				</div>
				<div className={styles.preview} data-flx="channel.thread-preview-card.preview">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt=""
							className={styles.miniAvatar}
							data-flx="channel.thread-preview-card.mini-avatar"
						/>
					) : (
						<div className={styles.miniAvatarPlaceholder} data-flx="channel.thread-preview-card.mini-avatar-placeholder" />
					)}
					<div className={styles.previewTextWrap} data-flx="channel.thread-preview-card.preview-text-wrap">
						{preview?.lastMessageAuthorUsername && (
							<div className={styles.previewSender} data-flx="channel.thread-preview-card.preview-sender">
								{preview.lastMessageAuthorUsername}
							</div>
						)}
						<div className={styles.previewMsg} data-flx="channel.thread-preview-card.preview-msg">
							{preview?.lastMessagePreview ?? i18n._(NO_MESSAGES_DESCRIPTOR)}
						</div>
					</div>
					{timeAgo && (
						<div className={styles.previewTime} data-flx="channel.thread-preview-card.preview-time">
							{timeAgo}
						</div>
					)}
				</div>
			</div>
		</div>
	);
});
