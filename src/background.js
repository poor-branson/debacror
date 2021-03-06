import { Storage, signal, isEmpty, recordPrefix } from './util';

/**
 * @typedef {Object} Record
 * @property {String} description
 * @property {Object[]} actions
 * @property {String} time
 * @property {String} initialURL
 */

let activeTabList = [];
let taskList = [];

const snapshotList = new Storage({
  namespace: 'SNAPSHOT_NAME_LIST',
});

/** clean up used storage space when tab is closed */
chrome.tabs.onRemoved.addListener(tabId => {
  const storage = new Storage({
    namespace: recordPrefix.concat(tabId),
  });
  storage.empty();
});

signal.onMessageForBG = async ({ action, data }, sender) => {
  const { tab } = sender;

  const actionMap = {
    /**
     * will be triggered by content script
     */
    async SAVE(data) {
      const name = recordPrefix.concat(tab.id);
      const store = new Storage({ namespace: name });
      let originData = await store.get();

      if (isEmpty(originData)) {
        originData = {
          actions: [],
          initialURL: tab.url,
          favIconUrl: tab.favIconUrl,
        };
      }

      originData.actions.push(data);

      store.set({ ...originData });
    },
    /**
     * will be triggered by popup
     */
    async CREATE_SNAPSHOT({ id, description, time }) {
      /**
       * [warn] this may cause issues when multiple snapshot
       * is created at the same time.
       */
      const name = recordPrefix.concat(id);
      const store = new Storage({ namespace: name });
      const originList = (await snapshotList.get('all')) || [];
      /**
       * @type {Record}
       */
      const frame = await store.get();
      const snapshotName = `snapshot-${originList.length + 1}`;
      const snapshotStore = new Storage({ namespace: snapshotName });
      snapshotList.set({
        all: [...originList, snapshotName],
      });
      snapshotStore.set({
        ...frame,
        description,
        time,
      });
    },
    /**
     * when extension is available
     *
     * triggered by content script
     */
    AVAILABLE() {
      chrome.browserAction.setIcon({
        tabId: tab.id,
        path: {
          32: 'img/bot_32.png',
          64: 'img/bot_64.png',
        },
      });
      chrome.browserAction.setPopup({
        tabId: tab.id,
        popup: 'popup.html',
      });

      /**
       * track the actived tabs that have been redirected to
       * new host, activate the recordation under the new host
       */
      if (activeTabList.find(i => i.id === tab.id)) {
        signal.toContentScript(tab.id, {
          action: 'START_RECORD',
          /**
           * tell content script that it has been redirected
           */
          from: 'BG',
        });
      }

      /** there is unfinished task */
      const stepIndex = taskList.findIndex(({ tabId }) => tabId === tab.id);
      if (stepIndex >= 0) {
        signal.toContentScript(tab.id, {
          action: 'RESTORE',
          step: taskList[stepIndex].step + 1,
          name: taskList[stepIndex].name
        });
        taskList.splice(stepIndex, 1);
      }
    },
    /** 
     * record restore statu when redirection
     * 
     * will be triggered by content script
     */
    async RESTORE_STATU({ step, name }) {
      taskList.push({
        tabId: tab.id,
        step,
        name
      });
    },
    /**
     * will be triggered by popup
     */
    async RM_SNAPSHOT({ name }) {
      const nameList = await snapshotList.get('all');
      if (nameList.includes(name)) {
        const storage = new Storage({ namespace: name });
        storage.empty();
        nameList.splice(nameList.indexOf(name), 1);
        snapshotList.set({
          all: nameList,
        });
      }
    },
    /**
     * wiil be triggered by popup
     *
     * since tab id is unique in a browser session,
     * so use it safely as identity.
     */
    START_RECORD(tabInfo) {
      activeTabList.push(tabInfo);
    },
    /**
     * will be triggered by popup
     */
    END_RECORD({ id }) {
      activeTabList = activeTabList.filter(tabInfo => {
        return tabInfo.id !== id;
      });
    },
  };

  const handler = actionMap[action];
  handler ? handler(data) : null;
};
