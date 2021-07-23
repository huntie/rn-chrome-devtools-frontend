// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {assert, expect} from 'chai';
import type {ElementHandle} from 'puppeteer';

import {click, step, typeText, waitFor, waitForElementWithTextContent, waitForMany} from '../../shared/helper.js';
import {describe, it} from '../../shared/mocha-extensions.js';
import {CONSOLE_TAB_SELECTOR, focusConsolePrompt} from '../helpers/console-helpers.js';
import {navigateToNetworkTab, selectRequestByName, waitForSomeRequestsToAppear} from '../helpers/network-helpers.js';

const SIMPLE_PAGE_REQUEST_NUMBER = 2;
const SIMPLE_PAGE_URL = `requests.html?num=${SIMPLE_PAGE_REQUEST_NUMBER}`;

describe('The Network Request view', async () => {
  it('re-opens the same tab after switching to another panel and navigating back to the "Network" tab (https://crbug.com/1184578)',
     async () => {
       await navigateToNetworkTab(SIMPLE_PAGE_URL);

       await step('wait for all requests to be shown', async () => {
         await waitForSomeRequestsToAppear(SIMPLE_PAGE_REQUEST_NUMBER + 1);
       });

       await step('select the first SVG request', async () => {
         await selectRequestByName('image.svg?id=0');
       });

       await step('select the "Timing" tab', async () => {
         const networkView = await waitFor('.network-item-view');
         const timingTabHeader = await waitFor('[aria-label=Timing][role="tab"]', networkView);
         await click(timingTabHeader);
         await waitFor('[aria-label=Timing][role=tab][aria-selected=true]', networkView);
       });

       await step('open the "Console" panel', async () => {
         await click(CONSOLE_TAB_SELECTOR);
         await focusConsolePrompt();
       });

       await step('open the "Network" panel', async () => {
         await click('#tab-network');
         await waitFor('.network-log-grid');
       });

       await step('ensure that the "Timing" tab is shown', async () => {
         const networkView = await waitFor('.network-item-view');
         const selectedTabHeader = await waitFor('[role=tab][aria-selected=true]', networkView);
         const selectedTabText = await selectedTabHeader.evaluate(element => element.textContent || '');

         assert.strictEqual(selectedTabText, 'Timing');
       });
     });

  it('shows webbundle content on preview tab', async () => {
    await navigateToNetworkTab('resources-from-webbundle.html');

    await waitForSomeRequestsToAppear(3);

    await selectRequestByName('webbundle.wbn');

    const networkView = await waitFor('.network-item-view');
    const previewTabHeader = await waitFor('[aria-label=Preview][role=tab]', networkView);
    await click(previewTabHeader);
    await waitFor('[aria-label=Preview][role=tab][aria-selected=true]', networkView);

    await waitForElementWithTextContent('webbundle.wbn', networkView);
    await waitForElementWithTextContent('urn:uuid:429fcc4e-0696-4bad-b099-ee9175f023ae', networkView);
    await waitForElementWithTextContent('urn:uuid:020111b3-437a-4c5c-ae07-adb6bbffb720', networkView);
  });

  it('stores websocket filter', async () => {
    const navigateToWebsocketMessages = async () => {
      await navigateToNetworkTab('websocket.html');

      await waitForSomeRequestsToAppear(2);

      await selectRequestByName('localhost');

      const networkView = await waitFor('.network-item-view');
      const messagesTabHeader = await waitFor('[aria-label=Messages][role=tab]', networkView);
      await click(messagesTabHeader);
      await waitFor('[aria-label=Messages][role=tab][aria-selected=true]', networkView);
      return waitFor('.websocket-frame-view');
    };

    let messagesView = await navigateToWebsocketMessages();
    let messages = await waitForMany('.data-column.websocket-frame-view-td', 4, messagesView);

    const filterInput =
        await waitFor('[aria-label="Enter regex, for example: (web)?socket"][role=textbox]', messagesView);
    filterInput.click();
    filterInput.focus();
    typeText('ping');

    async function elementTextContent(element: ElementHandle): Promise<string> {
      return await element.evaluate(node => node.textContent || '');
    }

    messages = await waitForMany('.data-column.websocket-frame-view-td', 2, messagesView);
    expect(messages.length).to.equal(2);
    expect(await elementTextContent(messages[0])).to.equal('ping');
    expect(await elementTextContent(messages[1])).to.equal('ping');


    messagesView = await navigateToWebsocketMessages();
    messages = await waitForMany('.data-column.websocket-frame-view-td', 2, messagesView);

    expect(messages.length).to.equal(2);
    expect(await elementTextContent(messages[0])).to.equal('ping');
    expect(await elementTextContent(messages[1])).to.equal('ping');
  });
});
