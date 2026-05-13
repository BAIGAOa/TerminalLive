import { Scope, Scoped } from "di-wise";
import BaseRegistry from "./BaseRegistry.js";

@Scoped(Scope.Container)
export default class KeysCenter extends BaseRegistry<() => any> {}