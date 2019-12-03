/* eslint-disable no-console */
"use strict";

let config;

module.exports = class ETEPL_ShowHide {
	data;

	constructor(_config, showHideData) {
		if (!showHideData) throw new Error("Missing Parameters");

		// Initialize action
		config = _config;
		this.data = {
			name: "ETEPL_ShowHide",
			loaded: false,
			isShow: showHideData.isShow,
			newUrl: showHideData.newUrl,
			maxTime: config.timer.pageLoad.value // ET_TIME
		};

		// Report it
		config.logger.logs.addMessage(config.logger.levels.info, "Show/Hide", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.data, "Show/Hide", this.data);
	}

	handleMessage(message) {
		this.data.readyToRemove = true;
	}

	getStatus() {
		let msg = "";
		if (this.data.isShow) {
			msg = `Show: ${this.data.newUrl} (${this.data.loaded ? "Waiting" : "Loaded"})`;
		} else {
			msg = `Hide`;
		}
		return msg;
	}

	tick() {
		const that = this;

		config.logger.logs.addMessage(config.logger.levels.debug, "Show/Hide", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Show/Hide", that.data);

		if (!that.data.loaded) {
			if (that.data.isShow) {
				config.electron.mainHelper.loadPage(that.data.newUrl, true).then(() => {
					that.data.readyToRemove = true;
				});
			} else {
				config.electron.mainHelper.loadPage(config.pages.trailhead, false).then(() => {
					that.data.readyToRemove = true;
				});
			}
			that.data.loaded = true;
		}
	}
};
