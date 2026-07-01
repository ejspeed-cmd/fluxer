// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadPreviewCard.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import Threads from '@app/features/channel/state/Threads';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import Permission from '@app/features/permissions/state/Permission';
import {MenuGroup} from '@app/features/ui/action_menu/MenuGroup';
import {MenuItem} from '@app/features/ui/action_menu/MenuItem';
import * as ContextMenuCommands from '@app/features/ui/commands/ContextMenuCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import {getFormattedShortDate} from '@app/features/user/utils/DateFormatting';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {CaretRightIcon, ClockIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const LEAVE_THREAD_DESCRIPTOR = msg({
	message: 'Leave Thread',
	comment: 'Context menu item to leave a thread.',
});
const CLOSE_THREAD_DESCRIPTOR = msg({
	message: 'Close Thread',
	comment: 'Context menu item to close a thread.',
});
const OPEN_THREAD_DESCRIPTOR = msg({
	message: 'Open Thread',
	comment: 'Context menu item to re-open a closed thread.',
});
const DELETE_THREAD_DESCRIPTOR = msg({
	message: 'Delete Thread',
	comment: 'Context menu item to delete a thread.',
});
const THREAD_CLOSED_DESCRIPTOR = msg({
	message: 'Thread closed',
	comment: 'Toast shown after closing a thread.',
});
const THREAD_OPENED_DESCRIPTOR = msg({
	message: 'Thread opened',
	comment: 'Toast shown after reopening a thread.',
});

const MESSAGES_DESCRIPTOR = msg({
	message: '· {count, plural, one {# message} other {# messages}}',
	comment: 'Message count shown on thread preview card.',
});
const NO_MESSAGES_DESCRIPTOR = msg({
	message: 'There are no recent messages in this thread.',
	comment: 'Placeholder shown on thread preview card when there are no messages.',
});
const CLOSES_IN_DESCRIPTOR = msg({
	message: 'Closes in {days, plural, one {# day} other {# days}} · {date}',
	comment: 'Expiry row on thread preview card when thread is still open.',
});
const EXPIRED_DESCRIPTOR = msg({
	message: 'Expired · {date}',
	comment: 'Expiry row on thread preview card when the thread has passed its expiry date.',
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
	const canManage = thread ? Permission.can(Permissions.MANAGE_CHANNELS, thread.toChannel()) : false;

	const name = thread?.name ?? threadName;
	const preview = thread?.preview;
	const isOpen = thread ? thread.isOpen() : false;
	const messageCount = thread?.messageCount ?? 0;
	const expiresAt = thread?.threadExpiresAt ?? null;

	const handleClick = useCallback(async () => {
		if (!isJoined) {
			await ThreadCommands.join(parentChannelId, threadId);
		}
		if (guildId) {
			NavigationCommands.selectThread(guildId, parentChannelId, threadId);
		}
	}, [threadId, parentChannelId, guildId, isJoined]);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuCommands.openFromEvent(event, ({onClose}) => (
				<MenuGroup data-flx="channel.thread-preview-card.context-menu.menu-group">
					{isJoined && (
						<MenuItem
							onClick={() => {
								void ThreadCommands.leave(parentChannelId, threadId);
								onClose();
							}}
							data-flx="channel.thread-preview-card.context-menu.leave"
						>
							{i18n._(LEAVE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && thread?.isOpen() && (
						<MenuItem
							onClick={async () => {
								await ThreadCommands.update(parentChannelId, threadId, {state: 1});
								ToastCommands.createToast({type: 'success', children: i18n._(THREAD_CLOSED_DESCRIPTOR)});
								onClose();
							}}
							data-flx="channel.thread-preview-card.context-menu.close"
						>
							{i18n._(CLOSE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && thread?.isClosed() && (
						<MenuItem
							onClick={async () => {
								await ThreadCommands.update(parentChannelId, threadId, {state: 0});
								ToastCommands.createToast({type: 'success', children: i18n._(THREAD_OPENED_DESCRIPTOR)});
								onClose();
							}}
							data-flx="channel.thread-preview-card.context-menu.open"
						>
							{i18n._(OPEN_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && (
						<MenuItem
							danger
							onClick={() => {
								void ThreadCommands.remove(parentChannelId, threadId);
								onClose();
							}}
							data-flx="channel.thread-preview-card.context-menu.delete"
						>
							{i18n._(DELETE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
				</MenuGroup>
			));
		},
		[thread, threadId, parentChannelId, isJoined, canManage, i18n],
	);

	const avatarUrl = preview?.lastMessageAuthorId
		? AvatarUtils.getUserAvatarURL({
				id: preview.lastMessageAuthorId,
				avatar: preview.lastMessageAuthorAvatar ?? null,
			})
		: null;

	const expiryLabel = (() => {
		if (!expiresAt) return null;
		const now = Date.now();
		const date = getFormattedShortDate(expiresAt);
		if (expiresAt.getTime() <= now) {
			return {expired: true, text: i18n._(EXPIRED_DESCRIPTOR, {date})};
		}
		const days = Math.ceil((expiresAt.getTime() - now) / 86_400_000);
		return {expired: false, text: i18n._(CLOSES_IN_DESCRIPTOR, {days, date})};
	})();

	return (
		<div className={styles.wrap} onContextMenu={handleContextMenu} data-flx="channel.thread-preview-card.wrap">
			<svg
				className={styles.branchArm}
				viewBox="0 0 56 32"
				preserveAspectRatio="none"
				fill="none"
				aria-hidden="true"
				data-flx="channel.thread-preview-card.branch-arm"
			>
				<path d="M28 0 V20 Q28 28 36 28 H56" stroke="currentColor" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
			</svg>
			<div className={styles.cardColumn} data-flx="channel.thread-preview-card.card-column">
				<div
					role="button"
					tabIndex={0}
					className={clsx(styles.box, isOpen ? styles.boxActive : undefined)}
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
								className={clsx(styles.threadName, !isOpen ? styles.threadNameClosed : undefined)}
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
						<CaretRightIcon size={14} className={styles.chevron} aria-hidden="true" data-flx="channel.thread-preview-card.chevron" />
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
								<span className={styles.previewSender} data-flx="channel.thread-preview-card.preview-sender">
									{preview.lastMessageAuthorUsername}
								</span>
							)}
							<span className={styles.previewMsg} data-flx="channel.thread-preview-card.preview-msg">
								{preview?.lastMessagePreview ?? i18n._(NO_MESSAGES_DESCRIPTOR)}
							</span>
						</div>
					</div>
				</div>
				{expiryLabel && (
					<div
						className={clsx(styles.expiryRow, expiryLabel.expired ? styles.expiryRowExpired : undefined)}
						data-flx="channel.thread-preview-card.expiry-row"
					>
						{expiryLabel.expired
							? <WarningCircleIcon size={12} aria-hidden="true" />
							: <ClockIcon size={12} aria-hidden="true" />
						}
						<span>{expiryLabel.text}</span>
					</div>
				)}
			</div>
		</div>
	);
});
