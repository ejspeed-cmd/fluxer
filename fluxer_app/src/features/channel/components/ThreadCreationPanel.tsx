// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/channel/components/ThreadCreationPanel.module.css';
import * as ThreadCommands from '@app/features/channel/commands/ThreadCommands';
import Threads from '@app/features/channel/state/Threads';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import {http} from '@app/features/platform/transport/RestTransport';
import {ThreadIcon} from '@app/features/ui/components/icons/ThreadIcon';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useRef, useState} from 'react';

const NEW_THREAD_DESCRIPTOR = msg({
	message: 'New Thread',
	comment: 'Header title in the thread creation panel.',
});
const CLOSE_DESCRIPTOR = msg({
	message: 'Close',
	comment: 'Accessible label on the close button in the thread creation panel.',
});
const THREAD_NAME_PLACEHOLDER_DESCRIPTOR = msg({
	message: 'Thread Name (Optional)',
	comment: 'Placeholder for the thread name input in the creation panel.',
});
const STARTER_MESSAGE_PLACEHOLDER_DESCRIPTOR = msg({
	message: 'Enter a message to start the conversation!',
	comment: 'Placeholder for the starter message textarea in the thread creation panel.',
});
const STARTER_REQUIRED_DESCRIPTOR = msg({
	message: 'Starter Message is required',
	comment: 'Validation hint shown when no message has been typed yet.',
});

interface ThreadCreationPanelProps {
	channelId: string;
	guildId: string;
	sourceMessageId?: string;
	sourceMessagePreview?: string;
	sourceMessageAuthor?: string;
	onClose: () => void;
}

export const ThreadCreationPanel = observer(({
	channelId,
	guildId,
	sourceMessageId,
	sourceMessagePreview,
	sourceMessageAuthor,
	onClose,
}: ThreadCreationPanelProps) => {
	const {i18n} = useLingui();
	const [threadName, setThreadName] = useState('');
	const [message, setMessage] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const submit = useCallback(async () => {
		const trimmed = message.trim();
		if (!trimmed || submitting) return;
		setSubmitting(true);
		try {
			const thread = await ThreadCommands.create(channelId, {
				name: threadName.trim() || undefined,
				source_message_id: sourceMessageId,
			});
			Threads.handleThreadCreate(thread);
			Threads.handleThreadMemberAdd({threadId: thread.id});
			await http.post(`/channels/${thread.id}/messages`, {body: {content: trimmed}});
			NavigationCommands.selectThread(guildId, channelId, thread.id);
		} finally {
			setSubmitting(false);
		}
	}, [channelId, guildId, sourceMessageId, threadName, message, submitting]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key !== 'Enter' || e.shiftKey) return;
			e.preventDefault();
			void submit();
		},
		[submit],
	);

	return (
		<div className={styles.panel} data-flx="channel.thread-creation-panel.panel">
			<div className={styles.header} data-flx="channel.thread-creation-panel.header">
				<ThreadIcon size={20} className={styles.headerIcon} data-flx="channel.thread-creation-panel.header-icon" />
				<span className={styles.headerTitle} data-flx="channel.thread-creation-panel.header-title">
					{i18n._(NEW_THREAD_DESCRIPTOR)}
				</span>
				<FocusRing data-flx="channel.thread-creation-panel.focus-ring">
					<button
						type="button"
						className={styles.closeButton}
						aria-label={i18n._(CLOSE_DESCRIPTOR)}
						onClick={onClose}
						data-flx="channel.thread-creation-panel.close-button.click"
					>
						<XIcon size={20} />
					</button>
				</FocusRing>
			</div>
			<div className={styles.body} data-flx="channel.thread-creation-panel.body">
				<div className={styles.graphic} data-flx="channel.thread-creation-panel.graphic" aria-hidden="true">
					<ThreadIcon size={48} className={styles.graphicIcon} />
				</div>
				<div className={styles.nameRow} data-flx="channel.thread-creation-panel.name-row">
					<label className={styles.nameLabel} data-flx="channel.thread-creation-panel.name-label">
						{i18n._(THREAD_NAME_PLACEHOLDER_DESCRIPTOR)}
					</label>
					<input
						className={styles.nameInput}
						type="text"
						maxLength={100}
						value={threadName}
						onChange={(e) => setThreadName(e.currentTarget.value)}
						autoFocus
						data-flx="channel.thread-creation-panel.name-input"
					/>
				</div>
				{sourceMessagePreview && (
					<div className={styles.sourceMessage} data-flx="channel.thread-creation-panel.source-message">
						{sourceMessageAuthor && (
							<span className={styles.sourceAuthor}>{sourceMessageAuthor}</span>
						)}
						<span className={styles.sourceContent}>{sourceMessagePreview}</span>
					</div>
				)}
			</div>
			<div className={styles.footer} data-flx="channel.thread-creation-panel.footer">
				{!message.trim() && (
					<div className={styles.validation} data-flx="channel.thread-creation-panel.validation">
						<span className={styles.validationIcon}>!</span>
						{i18n._(STARTER_REQUIRED_DESCRIPTOR)}
					</div>
				)}
				<div
					className={message.trim() ? styles.textareaWrapper : styles.textareaWrapperInvalid}
					data-flx="channel.thread-creation-panel.textarea-wrapper"
				>
					<textarea
						ref={textareaRef}
						className={styles.textarea}
						placeholder={i18n._(STARTER_MESSAGE_PLACEHOLDER_DESCRIPTOR)}
						value={message}
						onChange={(e) => setMessage(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						disabled={submitting}
						rows={1}
						data-flx="channel.thread-creation-panel.textarea"
					/>
				</div>
			</div>
		</div>
	);
});
