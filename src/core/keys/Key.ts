import { container } from "../../Container.js";
import KeysCenter from "./KeysCenter.js";

export default class Key {
    constructor(protected id: string, protected operate: () => any) {
        container.resolve(KeysCenter).register(id, operate);
    }
}