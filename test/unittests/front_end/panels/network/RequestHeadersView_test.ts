// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type * as Protocol from '../../../../../front_end/generated/protocol.js';
import * as Network from '../../../../../front_end/panels/network/network.js';
import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import {createTarget, deinitializeGlobalVars} from '../../helpers/EnvironmentHelpers.js';
import type * as Platform from '../../../../../front_end/core/platform/platform.js';
import * as Root from '../../../../../front_end/core/root/root.js';
import * as Workspace from '../../../../../front_end/models/workspace/workspace.js';
import * as Persistence from '../../../../../front_end/models/persistence/persistence.js';
import * as Bindings from '../../../../../front_end/models/bindings/bindings.js';
import {assertElement, renderElementIntoDOM} from '../../helpers/DOMHelpers.js';
import {describeWithMockConnection} from '../../helpers/MockConnection.js';

const {assert} = chai;

async function setUpEnvironment() {
  createTarget();
  const workspace = Workspace.Workspace.WorkspaceImpl.instance();
  const targetManager = SDK.TargetManager.TargetManager.instance();
  const debuggerWorkspaceBinding =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance({forceNew: true, targetManager, workspace});
  const breakpointManager = Bindings.BreakpointManager.BreakpointManager.instance(
      {forceNew: true, targetManager, workspace, debuggerWorkspaceBinding});
  Persistence.Persistence.PersistenceImpl.instance({forceNew: true, workspace, breakpointManager});
  const networkPersistenceManager =
      Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance({forceNew: true, workspace});

  const fileSystem = {
    fileSystemPath: () => 'file:///path/to/overrides',
    fileSystemBaseURL: 'file:///path/to/overrides/',
    type: () => Workspace.Workspace.projectTypes.FileSystem,
  } as unknown as Persistence.FileSystemWorkspaceBinding.FileSystem;

  const mockProject = {
    uiSourceCodes: () => [],
    id: () => 'file:///path/to/overrides',
    fileSystemPath: () => 'file:///path/to/overrides',
    type: () => Workspace.Workspace.projectTypes.Network,
    uiSourceCodeForURL: () => null,
  } as unknown as Workspace.Workspace.Project;
  workspace.addProject(mockProject);
  await networkPersistenceManager.setProject(mockProject);

  return {fileSystem, mockProject};
}

function renderHeadersView(request: SDK.NetworkRequest.NetworkRequest): Network.RequestHeadersView.RequestHeadersView {
  const component = new Network.RequestHeadersView.RequestHeadersView(request);
  const div = document.createElement('div');
  renderElementIntoDOM(div);
  component.markAsRoot();
  component.show(div);
  return component;
}

describeWithMockConnection('RequestHeadersView', () => {
  beforeEach(async () => {
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.HEADER_OVERRIDES, '');
    Root.Runtime.experiments.enableForTest(Root.Runtime.ExperimentName.HEADER_OVERRIDES);
  });
  afterEach(async () => {
    await deinitializeGlobalVars();
  });

  it('does not render a link to \'.headers\' if that file does not exist', async () => {
    await setUpEnvironment();
    const request = SDK.NetworkRequest.NetworkRequest.create(
        'requestId' as Protocol.Network.RequestId,
        'https://www.example.com/foo.html' as Platform.DevToolsPath.UrlString, '' as Platform.DevToolsPath.UrlString,
        null, null, null);
    request.responseHeaders = [{name: 'server', value: 'DevTools Test Server'}];
    const component = renderHeadersView(request);
    const headersTitle =
        component.responseHeadersCategory.treeOutline?.contentElement.querySelector('.headers-title') || null;
    assertElement(headersTitle, HTMLElement);
    const button = headersTitle.querySelector('button.headers-link');
    assert.isNull(button);
    component.detach();
  });

  it('renders a link to \'.headers\'', async () => {
    const {fileSystem, mockProject} = await setUpEnvironment();

    const uiSourceCode = {
      url: () => 'file:///path/to/overrides/www.example.com/.headers',
      project: () => fileSystem,
      name: () => '.headers',
    } as unknown as Workspace.UISourceCode.UISourceCode;
    const uiSourceCodeMap = new Map<string, Workspace.UISourceCode.UISourceCode>();
    uiSourceCodeMap.set(uiSourceCode.url(), uiSourceCode);

    mockProject.uiSourceCodes = () => [uiSourceCode];
    mockProject.uiSourceCodeForURL = (url: string): Workspace.UISourceCode.UISourceCode|null => {
      return uiSourceCodeMap.get(url) || null;
    };

    const request = SDK.NetworkRequest.NetworkRequest.create(
        'requestId' as Protocol.Network.RequestId,
        'https://www.example.com/foo.html' as Platform.DevToolsPath.UrlString, '' as Platform.DevToolsPath.UrlString,
        null, null, null);
    request.responseHeaders = [{name: 'server', value: 'DevTools Test Server'}];
    const component = renderHeadersView(request);
    const headersTitle =
        component.responseHeadersCategory.treeOutline?.contentElement.querySelector('.headers-title') || null;
    assertElement(headersTitle, HTMLElement);
    const button = headersTitle.querySelector('button.headers-link');
    assertElement(button, HTMLButtonElement);
    assert.strictEqual(button.textContent, 'Header overrides');
    component.detach();
  });

  it('renders without error when no overrides folder specified (i.e. there is no project)', async () => {
    createTarget();
    const workspace = Workspace.Workspace.WorkspaceImpl.instance();
    const targetManager = SDK.TargetManager.TargetManager.instance();
    const debuggerWorkspaceBinding =
        Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance({forceNew: true, targetManager, workspace});
    const breakpointManager = Bindings.BreakpointManager.BreakpointManager.instance(
        {forceNew: true, targetManager, workspace, debuggerWorkspaceBinding});
    Persistence.Persistence.PersistenceImpl.instance({forceNew: true, workspace, breakpointManager});
    Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance({forceNew: true, workspace});

    const request = SDK.NetworkRequest.NetworkRequest.create(
        'requestId' as Protocol.Network.RequestId,
        'https://www.example.com/foo.html' as Platform.DevToolsPath.UrlString, '' as Platform.DevToolsPath.UrlString,
        null, null, null);
    request.responseHeaders = [{name: 'server', value: 'DevTools Test Server'}];
    const component = renderHeadersView(request);
    const headersTitle =
        component.responseHeadersCategory.treeOutline?.contentElement.querySelector('.headers-title') || null;
    assertElement(headersTitle, HTMLElement);
    const button = headersTitle.querySelector('button.headers-link');
    assert.isNull(button);
    component.detach();
  });
});
