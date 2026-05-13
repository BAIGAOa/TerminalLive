import { container } from "../../Container.js";
import KeysCenter from "../registry/KeysCenter.js";

export default class Key {
  constructor(
    protected id: string,
    protected operate: () => any,
  ) {
    container.resolve(KeysCenter).register(id, operate);
  }
}
