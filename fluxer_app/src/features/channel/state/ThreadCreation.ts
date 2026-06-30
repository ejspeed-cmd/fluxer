// SPDX-License-Identifier: AGPL-3.0-or-later

import {action, makeAutoObservable, observable} from 'mobx';

export interface PendingThread {
	channelId: string;
	sourceMessageId?: string;
	sourceMessagePreview?: string;
	sourceMessageAuthor?: string;
}

class ThreadCreationStore {
	@observable pending: PendingThread | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	@action
	open(params: PendingThread): void {
		this.pending = params;
	}

	@action
	close(): void {
		this.pending = null;
	}
}

export default new ThreadCreationStore();
