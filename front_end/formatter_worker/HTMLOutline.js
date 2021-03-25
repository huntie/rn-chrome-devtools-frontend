// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Platform from '../platform/platform.js';
import * as TextUtils from '../text_utils/text_utils.js';

import {javaScriptOutline} from './JavaScriptOutline.js';

/** @typedef {{title: string, subtitle: (string|undefined), line: number, column: number}} */
// @ts-ignore typedef
export let Item;

/**
 * @param {string} content
 * @param {function({chunk: !Array<!Item>, isLastChunk: boolean}):void} chunkCallback
 */
export function htmlOutline(content, chunkCallback) {
  const SCRIPT_OPENING_TAG = /<script[^>]*>/im;
  const SCRIPT_CLOSING_TAG = /<\/script\s*>/im;

  const textCursor = new TextUtils.TextCursor.TextCursor(Platform.StringUtilities.findLineEndingIndexes(content));
  while (true) {
    // Look for the opening <script> tag.
    const openingMatch = SCRIPT_OPENING_TAG.exec(content.substring(textCursor.offset()));
    if (!openingMatch) {
      break;
    }
    const scriptStart = textCursor.offset() + openingMatch.index + openingMatch[0].length;
    textCursor.advance(scriptStart);
    const scriptLine = textCursor.lineNumber();
    const scriptColumn = textCursor.columnNumber();
    // Look for the closing </script> tag.
    const closingMatch = SCRIPT_CLOSING_TAG.exec(content.substring(textCursor.offset()));
    if (!closingMatch) {
      break;
    }
    const scriptEnd = textCursor.offset() + closingMatch.index;
    textCursor.advance(scriptEnd + closingMatch[0].length);
    const scriptContent = content.substring(scriptStart, scriptEnd);
    javaScriptOutline(scriptContent, ({chunk}) => {
      chunk.forEach(item => {
        if (item.line === 0) {
          item.column += scriptColumn;
        }
        item.line += scriptLine;
      });
      chunkCallback({chunk, isLastChunk: false});
    });
  }
  chunkCallback({chunk: [], isLastChunk: true});
}
