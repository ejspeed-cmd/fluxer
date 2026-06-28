// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/app/components/layout/ThreadItem.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import type {Thread} from '@app/features/channel/state/Threads';
import Threads from '@app/features/channel/state/Threads';
import type {Guild} from '@app/features/guild/models/Guild';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import Permission from '@app/features/permissions/state/Permission';
import {MenuGroup} from '@app/features/ui/action_menu/MenuGroup';
import {MenuItem} from '@app/features/ui/action_menu/MenuItem';
import * as ContextMenuCommands from '@app/features/ui/commands/ContextMenuCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const THREAD_DESCRIPTOR = msg({
	message: 'thread',
	comment: 'Lowercase channel type label for threads in accessible text.',
});
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
const CLOSED_DESCRIPTOR = msg({
	message: 'Closed',
	comment: 'Badge label for a closed thread.',
});
const THREAD_CLOSED_DESCRIPTOR = msg({
	message: 'Thread closed',
	comment: 'Toast shown after closing a thread.',
});
const THREAD_OPENED_DESCRIPTOR = msg({
	message: 'Thread opened',
	comment: 'Toast shown after reopening a thread.',
});

interface ThreadItemProps {
	guild: Guild;
	thread: Thread;
	isSelectedByPath: boolean;
}

export const ThreadItem = observer(({guild, thread, isSelectedByPath}: ThreadItemProps) => {
	const {i18n} = useLingui();
	const isJoined = Threads.isJoined(thread.id);
	const canManage = Permission.can(Permissions.MANAGE_CHANNELS, thread);

	const handleClick = useCallback(async () => {
		if (!isJoined) {
			await ThreadCommands.join(thread.threadParentChannelId, thread.id);
		}
		NavigationCommands.selectChannel(guild.id, thread.id);
	}, [guild.id, thread.id, thread.threadParentChannelId, isJoined]);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuCommands.openFromEvent(event, ({onClose}) => (
				<MenuGroup data-flx="app.thread-item.handle-context-menu.menu-group">
					{isJoined && (
						<MenuItem
							onClick={() => {
								void ThreadCommands.leave(thread.threadParentChannelId, thread.id);
								onClose();
							}}
							data-flx="app.thread-item.handle-context-menu.leave"
						>
							{i18n._(LEAVE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && thread.isOpen() && (
						<MenuItem
							onClick={async () => {
								await ThreadCommands.update(thread.threadParentChannelId, thread.id, {state: 1});
								ToastCommands.createToast({type: 'success', children: i18n._(THREAD_CLOSED_DESCRIPTOR)});
								onClose();
							}}
							data-flx="app.thread-item.handle-context-menu.close"
						>
							{i18n._(CLOSE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && thread.isClosed() && (
						<MenuItem
							onClick={async () => {
								await ThreadCommands.update(thread.threadParentChannelId, thread.id, {state: 0});
								ToastCommands.createToast({type: 'success', children: i18n._(THREAD_OPENED_DESCRIPTOR)});
								onClose();
							}}
							data-flx="app.thread-item.handle-context-menu.open"
						>
							{i18n._(OPEN_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
					{canManage && (
						<MenuItem
							danger
							onClick={() => {
								void ThreadCommands.remove(thread.threadParentChannelId, thread.id);
								onClose();
							}}
							data-flx="app.thread-item.handle-context-menu.delete"
						>
							{i18n._(DELETE_THREAD_DESCRIPTOR)}
						</MenuItem>
					)}
				</MenuGroup>
			));
		},
		[thread, isJoined, canManage, i18n],
	);

	const ariaLabel = `${thread.name ?? ''}, ${i18n._(THREAD_DESCRIPTOR)}`;

	return (
		<FocusRing data-flx="app.thread-item.focus-ring">
			<div
				role="button"
				tabIndex={0}
				aria-label={ariaLabel}
				aria-current={isSelectedByPath ? 'page' : undefined}
				className={clsx(
					styles.threadItem,
					isSelectedByPath ? styles.threadItemSelected : styles.threadItemHoverable,
				)}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						void handleClick();
					}
				}}
				data-flx="app.thread-item.thread-item.click"
				data-channel-id={thread.id}
				data-channel-list-focus-item="true"
			>
				<div className={styles.connector} data-flx="app.thread-item.connector" />
				<span
					className={clsx(styles.name, isSelectedByPath && styles.nameSelected)}
					data-flx="app.thread-item.name"
				>
					{thread.name}
				</span>
				{!thread.isOpen() && (
					<span className={styles.closedBadge} data-flx="app.thread-item.closed-badge">
						{i18n._(CLOSED_DESCRIPTOR)}
					</span>
				)}
			</div>
		</FocusRing>
	);
});
