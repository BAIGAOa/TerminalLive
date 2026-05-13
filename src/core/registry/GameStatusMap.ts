import { Scope, Scoped } from "di-wise";
import React from "react";
import BaseRegistry from "./BaseRegistry.js";

@Scoped(Scope.Container)
export default class GameStatusMap extends BaseRegistry<
  (props?: any) => React.ReactNode
> {}