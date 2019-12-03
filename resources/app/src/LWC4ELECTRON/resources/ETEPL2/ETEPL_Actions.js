/* eslint-disable no-console */
"use strict";

// Other files
const ETEPL_PauseMilliseconds = require("./ETEPL_PauseMilliseconds");

let config;

module.exports = class ETEPL_Actions {
	fifo = [];
	clock = null;
	peekData = { counter: 0, lastAction: null };

	constructor(_config) {
		if (!_config) throw new Error("Missing Parameters");

		config = _config;
		config.actions = this;
		config.actions.fifo = [];
	}

	add(action) {
		action.data.abort = null;
		action.data.readyToRemove = false;
		config.actions.fifo.push(action);
	}

	hasActions() {
		return this.fifo.length > 0;
	}

	closePage() {
		config.electron.mainHelper.loadPage(config.pages.trailhead, false);
	}

	reset(isForced) {
		config.logger.logs.addMessage(config.logger.levels.fatal, "ABORT", config.actions.fifo[0]);
		// config.actions.fifo[0].data.maxTime = 0;
		config.actions.fifo = [];
		config.actions.closePage();
		config.etEpl.resetTest();
		this.resetPeek();
		if (!isForced) {
			config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.reset.value)); // ET_TIME
		}
	}

	handleMessage(message) {
		// Handle message from UI
		try {
			const currentAction = config.actions.fifo[0];
			if (currentAction) {
				config.logger.logs.addMessage(config.logger.levels.info, "Handle Message", `Message for ${currentAction.data.name}`);
				config.logger.logs.addMessage(config.logger.levels.data, "Handle Message", message);
				if (currentAction.handleMessage) currentAction.handleMessage(message);
			}
		} catch (ex) {
			// Nothing, ignore it!
		}
	}

	getStatus() {
		debugger;
	}

	tick() {
		const that = this;

		try {
			if (config.electron.dialogOpen) {
				config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Skip action (dialog open)`);
				config.logger.logs.addMessage(config.logger.levels.data, "Master Tick (Skip)", action.data);
			} else {
				const action = config.actions.fifo[0];
				that.showStatus(action.getStatus());
				config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Tick for ${action.data.name}`);
				config.logger.logs.addMessage(config.logger.levels.data, "Master Tick", action.data);

				if (action.data.readyToRemove) {
					// Waste one cycle, but better to do so than to miss a beat and get lost in time :-)
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Cycle wasted`);
					config.actions.fifo.shift();
					that.resetPeek();
				} else if (action.data.maxTime === -1) {
					// Can't be aborted, so just do it!
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Must perform action`);
					action.tick(action);
					that.peek();
				} else if (!action.data.abort) {
					// Has not started, so do it now.
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Start action`);
					action.data.abort = config.etEpl.addMilliseconds(new Date(), action.data.maxTime);
					action.tick(action);
					that.resetPeek();
				} else if (new Date() < action.data.abort) {
					// I'll wait just a bit more...
					config.logger.logs.addMessage(
						config.logger.levels.trace,
						"Master Tick",
						`Waiting for ${action.data.name}. Aborting in ${config.etEpl.secondsRemaining(action.data.abort)} seconds`
					);
					that.peek();
				} else if (new Date() > action.data.abort) {
					// Must kill all Actions now!
					if (action.abort) {
						action.abort();
					}
					config.logger.logs.addMessage(
						config.logger.levels.error,
						"Master Tick",
						`ABORT "${action.data.name}" now! It expired at ${action.data.abort.toISOString()} (${action.data.abort.toLocaleTimeString()})`
					);
					config.actions.reset(false);
					that.resetPeek();
				} else {
					// Keep this debugger! - WHY am I here?
					debugger;
				}
			}
		} catch (ex) {
			config.electron.mainHelper.handleCriticalError(ex);
		}
	}

	peek() {
		const that = this;
		const action = config.actions.fifo[0];

		// To turn it on, set the "config.debug.peekInterval" value in the debug file (-1: Disabled, #: How many cycles to wait).
		if (config.debug.peekInterval > 0) {
			if (config.electron.dialogOpen) {
				config.logger.logs.addMessage(config.logger.levels.trace, "Peek", `Skip action: Peek (dialog open)`);
			} else {
				this.peekData.counter--;
				if (this.peekData.counter <= 0) {
					// if (action.data.name === "ETEPL_ComputerLogin") {
					// config.actions.peekData.counter = 60;
					// debugger;
					// } else {
					this.resetPeek();
					let electronJson = config.etEpl.readElectronJson();
					that.showStatus(`Peek (${config.debug.peekInterval} cycles): ...`);
					config.etEpl
						.requestWS(config.pages.peek, "POST", electronJson)
						.then(response => {
							config.logger.logs.addMessage(config.logger.levels.trace, "Peek", `Reply => ${response.serverDTTM}`);
							that.showStatus(`Peek (${config.debug.peekInterval} cycles): ${response.output.action}`);
							if (that.peekData.lastAction !== response.output.action) {
								if (response.output.action !== "SLEEP") {
									// CLEAR_ACTIONS
									config.logger.logs.addMessage(config.logger.levels.error, "Peek", `Action "${response.output.action}"`);
									config.actions.reset(true);
								}
							}
							that.peekData.lastAction = response.output.action;
						})
						.catch(err => {
							config.logger.logs.addMessage(config.logger.levels.fatal, "Peek", `Error on Webservice callout`);
							config.electron.mainHelper.handleCriticalError(err);
						});
					// }
				} else {
					config.logger.logs.addMessage(config.logger.levels.trace, "Peek", `Skip ${this.peekData.counter} of ${config.debug.peekInterval}`);
				}
			}
		} else {
			// Nothing!
		}
	}

	resetPeek() {
		this.peekData.counter = config.debug.peekInterval;
	}

	showStatus(msg) {
		console.error(`*** ${msg}`);
		if (config.debug.updateStatus.icon) {
			config.electron.tray.setToolTip(msg);
		} else {
			config.electron.tray.setToolTip("Trailhead internet tester");
		}
		if (config.debug.updateStatus.title) {
			config.electron.mainWindow.setTitle(msg);
		} else {
			config.electron.mainWindow.setTitle("Trailhead internet tester");
		}
	}
};
