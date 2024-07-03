// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../core/sdk/sdk.js';
import * as ReactNativeModels from '../../models/react_native/react_native.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as Common from '../../core/common/common.js';

import type * as ReactDevToolsTypes from '../../third_party/react-devtools/react-devtools.js';

export const enum Events {
  Initialized = 'Initialized',
  Destroyed = 'Destroyed',
  MessageReceived = 'MessageReceived',
}

export type EventTypes = {
  [Events.Initialized]: SDK.RuntimeModel.ExecutionContext,
  [Events.Destroyed]: void,
  [Events.MessageReceived]: ReactDevToolsTypes.Message,
};

type ContextDestroyedEvent = Common.EventTarget.EventTargetEvent<SDK.RuntimeModel.EventTypes[SDK.RuntimeModel.Events.ExecutionContextDestroyed]>;
type ContextCreatedEvent = Common.EventTarget.EventTargetEvent<SDK.RuntimeModel.EventTypes[SDK.RuntimeModel.Events.ExecutionContextCreated]>;

// Hermes doesn't support Workers API yet, so there is a single execution context at the moment
// This will be used for an extra-check to future-proof this logic
// See https://github.com/facebook/react-native/blob/40b54ee671e593d125630391119b880aebc8393d/packages/react-native/ReactCommon/jsinspector-modern/InstanceTarget.cpp#L61
const MAIN_EXECUTION_CONTEXT_NAME = 'main';

function getCurrentMainExecutionContext(): SDK.RuntimeModel.ExecutionContext | null {
  const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
  if (executionContext?.name !== MAIN_EXECUTION_CONTEXT_NAME) {
    return null;
  }

  return executionContext;
}

export class ReactDevToolsModel extends SDK.SDKModel.SDKModel<EventTypes> {
  private static readonly FUSEBOX_BINDING_NAMESPACE = 'react-devtools';
  private readonly rdtModel: ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel | null;

  constructor(target: SDK.Target.Target) {
    super(target);

    const model = target.model(ReactNativeModels.ReactDevToolsBindingsModel.ReactDevToolsBindingsModel);
    if (!model) {
      throw new Error('Failed to construct ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    this.rdtModel = model;
    model.addEventListener(ReactNativeModels.ReactDevToolsBindingsModel.Events.Initialized, this.initialize, this);
  }

  private initialize(): void {
    const rdtModel = this.rdtModel;
    if (!rdtModel) {
      throw new Error('Failed to initialize ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    rdtModel.subscribeToDomainMessages(
      ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE,
        message => this.onMessage(message as ReactDevToolsTypes.Message),
    );
    void rdtModel.initializeDomain(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE).then(() => this.onInitialization());
  }

  private onInitialization(): void {
    const currentExecutionContext = getCurrentMainExecutionContext();

    if (currentExecutionContext) {
      this.dispatchEventToListeners(Events.Initialized, currentExecutionContext);
    }

    SDK.TargetManager.TargetManager.instance().addModelListener(
      SDK.RuntimeModel.RuntimeModel,
      SDK.RuntimeModel.Events.ExecutionContextCreated,
      this.onExecutionContextCreated,
      this,
    );

    SDK.TargetManager.TargetManager.instance().addModelListener(
      SDK.RuntimeModel.RuntimeModel,
      SDK.RuntimeModel.Events.ExecutionContextDestroyed,
      this.onExecutionContextDestroyed,
      this,
    );
  }

  private onExecutionContextCreated({data: executionContext}: ContextCreatedEvent): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    this.dispatchEventToListeners(Events.Initialized, executionContext);
  }

  private onExecutionContextDestroyed({data: executionContext}: ContextDestroyedEvent): void {
    if (executionContext.name !== MAIN_EXECUTION_CONTEXT_NAME) {
      return;
    }

    this.dispatchEventToListeners(Events.Destroyed);
  }

  private onMessage(message: ReactDevToolsTypes.Message): void {
    this.dispatchEventToListeners(Events.MessageReceived, message);
  }

  async sendMessage(message: ReactDevToolsTypes.Message): Promise<void> {
    const rdtModel = this.rdtModel;
    if (!rdtModel) {
      throw new Error('Failed to send message from ReactDevToolsModel: ReactDevToolsBindingsModel was null');
    }

    return rdtModel.sendMessage(ReactDevToolsModel.FUSEBOX_BINDING_NAMESPACE, message);
  }
}

SDK.SDKModel.SDKModel.register(ReactDevToolsModel, {capabilities: SDK.Target.Capability.JS, autostart: false});
